import { DiceRoller } from './DiceRoller.js';
import { DamageContextBuilder } from './DamageContextBuilder.js'; 
import { itemFactory } from '../core/ItemFactory.js';
import { FormulaParser } from './FormulaParser.js';

class BattleSystem {
    constructor(diceRoller = null) {
        this.battleLog = [];
        this.diceRoller = diceRoller || new DiceRoller();
        this.damageContextBuilder = new DamageContextBuilder();
        this.game = null;
        this.formulaParser = new FormulaParser();
    }
  
    startBattle(player, enemy) {
        return {
        player: player.getStats(),
        enemyId: enemy.id,
        enemyData: enemy.getInfo(),
        log: [`⚔️ Начался бой!`, `Вы встретили ${enemy.name}!`]
        };
    }
  
    playerAttack(player, enemy, statManager) {
        console.log('⚔️ playerAttack вызван с поддержкой способностей');
        
        let totalLog = [];
        let totalDamage = 0;
        let enemyDead = false;
        let playerDead = false;
        
        // ПОЛУЧАЕМ hitroll И damroll ИГРОКА
        const playerStats = player.getStats();
        const hitroll = playerStats.hitroll || 0;
        const damroll = playerStats.damroll || 0;
        
        // 1. Получаем ВСЕ атаки игрока (оружие + способность)
        const attacks = player.determineAutoAttacks();
        if (!attacks || attacks.length === 0) {
            totalLog.push('У вас нет оружия для атаки!');
            return {
                type: 'player_attack',
                damage: 0,
                enemyDead: false,
                playerDead: false,
                log: totalLog
            };
        }
        
        // 2. Обрабатываем КАЖДУЮ атаку отдельно
        for (const attack of attacks) {
            // 3. Определяем тип атаки
            const isAbilityAttack = attack.type === 'ability';
            const weaponName = attack.weapon ? attack.weapon.name : 
                            (isAbilityAttack ? attack.ability.name : 'кулаком');
            
            // 4. Бросок атаки (разная логика для оружия и способностей)
            let attackRoll;
            let naturalRoll = 0;
            let isCritical = false;
            let isFumble = false;
            
            if (isAbilityAttack) {
                // ЗАКЛИНАНИЯ/УМЕНИЯ: всегда попадают (если не провалена проверка canUse)
                attackRoll = { total: 999, rolls: [20] };
                naturalRoll = 20;
                isCritical = false;
            } else {
                // Физическая атака с использованием hitroll
                const attackFormula = `1d20+${hitroll}`;
                attackRoll = this.diceRoller.roll(attackFormula, {});
                naturalRoll = attackRoll.rolls[0] || 0;
                isCritical = naturalRoll === 20;
                isFumble = naturalRoll === 1;
            }
            
            const enemyStats = enemy.stats || enemy;
            const enemyAC = enemyStats.armorClass || enemy.armorClass || 6;
            
            // 5. Проверка попадания
            let hits = false;
            if (isAbilityAttack) {
                hits = true;
            } else if (isCritical) {
                hits = true;
            } else if (isFumble) {
                hits = false;
            } else {
                hits = attackRoll.total >= enemyAC;
            }
            
            // ПОЛУЧАЕМ БОНУСЫ ОТ УМЕНИЙ ВЛАДЕНИЯ ОРУЖИЕМ (только для обычных атак)
            let skillHitBonus = 0;
            let skillDamageBonus = 0;
            
            if (!isAbilityAttack && attack.weapon) {
                const weaponType = attack.weapon.weaponType;
                if (weaponType) {
                    const skillId = this._getWeaponSkillId(weaponType);
                    if (skillId) {
                        const mastery = window.game?.abilityService?.getMastery(player.id, skillId) || 0;
                        const skill = window.game?.abilityService?.getAbility(skillId);
                        
                        if (skill && skill.scaling) {
                            // Получаем бонусы из scaling
                            if (skill.scaling.hitroll) {
                                const hitFormula = skill.scaling.hitroll.replace(/mastery/g, mastery);
                                try {
                                    // Используем FormulaParser вместо new Function
                                    skillHitBonus = this.formulaParser.evaluate(hitFormula, {}) || 0;
                                } catch (e) {
                                    console.warn('Ошибка вычисления hitroll бонуса:', e);
                                }
                            }
                            if (skill.scaling.damroll) {
                                const dmgFormula = skill.scaling.damroll.replace(/mastery/g, mastery);
                                try {
                                    skillDamageBonus = this.formulaParser.evaluate(dmgFormula, {}) || 0;
                                } catch (e) {
                                    console.warn('Ошибка вычисления damroll бонуса:', e);
                                }
                            }
                        }
                    }
                }
            }
            
            // Применяем бонус от умения к попаданию
            if (!isAbilityAttack && skillHitBonus > 0) {
                const modifiedTotal = attackRoll.total + skillHitBonus;
                if (!hits && modifiedTotal >= enemyAC) {
                    hits = true;
                    totalLog.push(`✨ Бонус умения превратил промах в попадание!`);
                }
            }
            
            if (!hits) {
                totalLog.push(`🗡️ Вы ударили ${weaponName} но промахнулись`);
                continue;
            }
            
            // 6. Расчет урона
            const damageFormula = attack.damageFormula || '1d4';
            const damageContext = this.damageContextBuilder.buildForPlayer(player, {
                includeEquipment: !isAbilityAttack
            });
            
            let damageResult;
            if (!isAbilityAttack) {
                // Для обычных атак используем чистую формулу оружия
                damageResult = this.diceRoller.roll(damageFormula, damageContext);
            } else {
                // Для способностей — без изменений
                damageResult = this.diceRoller.roll(damageFormula, damageContext);
            }
            
            let damage = damageResult.total;
            
            // Добавляем damroll к урону и бонусы от умений (только для физических атак)
            if (!isAbilityAttack) {
                damage += damroll;
                
                // Добавляем бонус от умения к урону
                if (skillDamageBonus > 0) {
                    damage += skillDamageBonus;
                }
            }
            
            if (isCritical && !isAbilityAttack) {
                // Критический удар оружием: удваиваем кубы, damroll добавляется отдельно
                const diceTotal = damageResult.rolls.reduce((sum, roll) => sum + roll, 0);
                const modifierTotal = damageResult.total - diceTotal;
                damage = (diceTotal * 2) + modifierTotal + damroll;
                
                // При критическом ударе бонус умения тоже удваивается?
                if (skillDamageBonus > 0) {
                    damage += skillDamageBonus; // или тоже удвоить? пока оставим как есть
                }
            }
            
            // 7. Логирование
            const critText = isCritical ? " (крит!)" : "";
            const abilityText = isAbilityAttack ? "✨ " : "";
            totalLog.push(`${abilityText}Вы использовали ${weaponName} нанеся ${damage} урона${critText}`);
            
            // 8. Применяем урон с информацией о критическом ударе
            const enemyResult = enemy.takeDamage(damage, { isCritical: isCritical });
            totalDamage += enemyResult.damage;  
            
            // 9. Проверяем смерть врага
            if (enemyResult.isDead) {
                enemyDead = true;
                totalLog.push(`🎊 Вы победили ${enemy.name}!`);
                break;
            }
        }
        
        // 10. Проверяем смерть игрока
        if (this.game && this.game.combatSystem) {
            const playerStats = player.getStats ? player.getStats() : player;
            if (playerStats.health <= 0) {
                playerDead = true;
            }
        }
        
        // 11. Возвращаем результат
        return {
            type: 'player_attack',
            damage: totalDamage,
            enemyDead: enemyDead,
            playerDead: playerDead,
            log: totalLog
        };
    }

    /**
     * Получить ID умения по типу оружия
     * @private
     */
    _getWeaponSkillId(weaponType) {
        const mapping = {
            'длинные_лезвия': 'длинные_лезвия',
            'короткие_лезвия': 'короткие_лезвия',
            'топоры': 'топоры',
            'двуручники': 'двуручники',
            'посохи_и_дубины': 'посохи_и_дубины',
            'копья': 'копья',
            'луки': 'луки',
            'проникающее_оружие': 'проникающее_оружие',
            'иное_оружие': 'иное_оружие',
            'unarmed': 'кулачный_бой'
        };
        return mapping[weaponType] || null;
    }
    usePotionInBattle(player, itemId) {
        if (!window.itemsData || !window.itemsData[itemId]) {
        return {
            success: false,
            log: [`Предмет не найден`]
        };
        }
        
        const itemData = window.itemsData[itemId];
        let log = [`Вы использовали ${itemData.name}`];
        let effects = [];
        
        if (itemData.stats.health > 0) {
        const healed = player.heal(itemData.stats.health);
        effects.push(`Восстановлено ${healed} здоровья`);
        }
        
        return {
        success: true,
        effects,
        log
        };
    }
    
    tryEscape(player, enemy) {
        const escapeChance = 0.5;
        const success = Math.random() < escapeChance;
        
        let log = [];
        
        if (success) {
        log.push("Вы успешно сбежали!");
        return { success: true, log };
        } else {
        log.push("Не удалось сбежать!");
        
        return {
            success: false,
            enemyDamage: 0,
            playerDead: false,
            log
        };
        }
    }

    endBattleVictory(player, enemy) {
        const expReward = enemy.expReward;
        const goldReward = enemy.goldReward;
        
        const expResult = player.gainExp(expReward);
        
        let log = [
            `Вы получили:`,
            `Опыт: ${expReward}`,
        ];
        
        if (expResult.levelsGained > 0) {
            log.push(`🎉 Вы достигли ${player.getStats().level} уровня!`);
        }

        return {
            exp: expReward,
            gold: goldReward,
            levelsGained: expResult.levelsGained,
            gotDrop: false,
            dropName: null,
            log
        };
        
    }
    
}

export { BattleSystem };
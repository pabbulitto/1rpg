/**
 * CombatSystem - система управления боем
 * Получает выбранные действия игрока через combat:playerSelectedAction
 * Управляет текущим боем и последовательностью раундов
 */
import { mechanics } from './mechanics.js';

class CombatSystem {
    constructor(battleSystem, eventBus) {
        this.battleSystem = battleSystem;
        this.eventBus = eventBus;
        this.currentBattle = null;
        this.playerAction = null;
        
        // Состояния активных механик
        this.dodgeState = null;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.eventBus.on('battle:start', (data) => {
            this.startBattle(data.player, data.enemyId || data.enemy);
        });
        
        this.eventBus.on('time:tick', () => this.processRound());
        this.eventBus.on('combat:playerSelectedAction', (data) => {
            this.playerAction = data.action;
        });
    }
    
    startBattle(player, enemyId) {
        let enemyInstance;
        
        if (enemyId && typeof enemyId === 'object') {
            enemyInstance = enemyId;
        } else if (typeof enemyId === 'string' || typeof enemyId === 'number') {
            enemyInstance = window.game?.enemyService?.getEnemyById(enemyId);
            if (!enemyInstance) {
                console.error('CombatSystem: враг не найден по ID', enemyId);
                return;
            }
        } else {
            console.error('CombatSystem: некорректный enemyId', enemyId);
            return;
        }
        
        this.currentBattle = {
            player: player,
            enemies: [enemyInstance],
            round: 1,
            turn: 'player'
        };
        this.playerAction = null;
        this.dodgeState = null;
    }
    
    endBattle(victory = true, defeatedEnemy = null) {
        if (window.game?.abilityService) {
            const abilityService = window.game.abilityService;
            for (const ability of abilityService.abilities.values()) {
                if (ability.currentCooldown > 0) {
                    ability.currentCooldown = 0;
                }
            }
        }
        
        if (window.game?.battleOrchestrator) {
            if (victory) {
                window.game.battleOrchestrator.endBattleVictory(defeatedEnemy);
            } else {
                window.game.battleOrchestrator.endBattleDefeat();
            }
        }
        
        this.currentBattle = null;
        this.playerAction = null;
        this.dodgeState = null;
        
        this.eventBus.emit(victory ? 'battle:victory' : 'battle:defeat');
        this.eventBus.emit('battle:end');
    }
    
    onEnemyDefeated(enemy) {
        if (enemy && typeof enemy.die === 'function') {
            enemy.die();
        }
        
        const index = this.currentBattle.enemies.indexOf(enemy);
        if (index !== -1) {
            this.currentBattle.enemies.splice(index, 1);
        }
        
        if (this.currentBattle.enemies.length === 0) {
            this.endBattle(true, enemy);
        }
    }
    
    onPlayerDefeated(player) {
        this.endBattle(false);
    }
    
    processRound() {
        if (!this.currentBattle) return;
        
        const player = this.currentBattle.player;
        let enemies = this.currentBattle.enemies.filter(e => e.getStats().health > 0);
        
        if (enemies.length === 0 || player.getStats().health <= 0) return;
        
        const logMessages = [];
        const results = {
            playerAttacks: [],
            enemyAttacks: [],
            playerAction: null,
            deaths: []
        };
        
        // 1. Сначала действие игрока (умения и заклинания)
        this._processPlayerAction(player, enemies, results, logMessages);
        
        // 2. Потом автоатаки игрока (оружие/кулаки)
        this._processPlayerAttacks(player, enemies, results, logMessages);
        
        // 3. Потом атаки врагов
        this._processEnemyAttacks(enemies, player, results, logMessages);
        
        // 4. Обработка смертей
        this._processDeaths(results.deaths, player, enemies);
        
        // 5. Завершение раунда
        this._endRound(player, enemies, results, logMessages);
    }
    
    _processPlayerAction(player, enemies, results, logMessages) {
        if (!this.playerAction || player.getStats().health <= 0) return;
        
        const target = enemies[0];
        if (!target || target.getStats().health <= 0) return;
        
        if (this.playerAction.type === 'ability') {
            const ability = this.playerAction.data;
            
            if (ability.mechanic && mechanics[ability.mechanic]) {
                mechanics[ability.mechanic].activate(this, ability, player);
                this._applyMasteryGain(player, ability);
                results.playerAction = {
                    type: 'ability',
                    name: ability.name,
                    mechanic: ability.mechanic
                };
                this.playerAction = null;
                return;
            }
            
            const abilityResult = ability.use(player, target);
            
            if (abilityResult.success) {
                this._applyMasteryGain(player, ability);
               if (abilityResult.appliedEffects && abilityResult.appliedEffects.length > 0) {
                    abilityResult.appliedEffects.forEach(effect => {
                        logMessages.push({
                            message: `✨ ${effect.name} наложен на ${target.name}!`,
                            type: 'success'
                        });
                    });
                }
                if (abilityResult.damage > 0) {
                    target.takeDamage(abilityResult.damage, {
                        damageType: 'magical',
                        isCritical: false
                    });
                    
                    // Добавляем сообщение о уроне в лог
                    logMessages.push({ 
                        message: `${ability.name} наносит ${abilityResult.damage} урона ${target.name}`, 
                        type: 'battle' 
                    });
                }
                
                results.playerAction = {
                    type: 'ability',
                    name: ability.name,
                    target: target.id,
                    result: abilityResult
                };
                
                if (abilityResult.message) {
                    logMessages.push({ message: abilityResult.message, type: 'battle' });
                }
                
                if (target.getStats().health <= 0) {
                    results.deaths.push(target.id);
                    logMessages.push({ 
                        message: `🎊 ${target.name} побежден!`, 
                        type: 'victory' 
                    });
                }
            } else if (abilityResult.message) {
                logMessages.push({ message: abilityResult.message, type: 'error' });
            }
            
            this.playerAction = null;
            
        } else if (this.playerAction.type === 'item') {
            const item = this.playerAction.data;
            const useResult = item.use(player);
            
            if (useResult.success) {
                results.playerAction = {
                    type: 'item',
                    name: item.name,
                    result: useResult
                };
                
                if (useResult.effects) {
                    useResult.effects.forEach(effect => {
                        logMessages.push({ message: effect, type: 'success' });
                    });
                }
            } else if (useResult.message) {
                logMessages.push({ message: useResult.message, type: 'error' });
            }
            
            this.playerAction = null;
        }
    }

    _processPlayerAttacks(player, enemies, results, logMessages) {
        if (player.getStats().health <= 0) return;
        
        for (const enemy of enemies) {
            if (enemy.getStats().health <= 0) continue;
            
            const attackResult = this.battleSystem.playerAttack(player, enemy);
            
            if (attackResult.damage > 0) {
                const equipment = player.getEquipment();
                const rightHand = equipment?.right_hand;
                
                if (rightHand?.weaponType) {
                    const weaponSkillId = this._getWeaponSkillId(rightHand.weaponType);
                    if (weaponSkillId && window.game?.abilityService) {
                        window.game.abilityService.addMastery(
                            player.id,
                            weaponSkillId,
                            0.02
                        );
                    }
                } else {
                    if (window.game?.abilityService) {
                        window.game.abilityService.addMastery(
                            player.id,
                            'кулачный_бой',
                            0.02
                        );
                    }
                }
            }
            
            results.playerAttacks.push({
                target: enemy.id,
                result: attackResult
            });
            
            if (attackResult.log && attackResult.log.length > 0) {
                attackResult.log.forEach(msg => {
                    logMessages.push({ message: msg, type: 'battle' });
                });
            }
            
            if (attackResult.enemyDead) {
                results.deaths.push(enemy.id);
                logMessages.push({ 
                    message: `🎊 ${enemy.name} побежден!`, 
                    type: 'victory' 
                });
            }
        }
    }
    
    _processEnemyAttacks(enemies, player, results, logMessages) {
        if (player.getStats().health <= 0) return;
        
        for (const enemy of enemies) {
            if (enemy.getStats().health <= 0) continue;
            
            const dodged = mechanics.dodge.processAttack(this, enemy, player);
            if (dodged) {
                results.enemyAttacks.push({
                    attacker: enemy.id,
                    attackerName: enemy.name,
                    damage: 0,
                    evaded: true
                });
                continue;
            }
            
            const attackResult = enemy.attackPlayer(player.getStats());
            
            if (attackResult && attackResult.damage > 0) {
                const damageResult = player.takeDamage(attackResult.damage, {
                    isCritical: attackResult.isCritical
                });
                
                results.enemyAttacks.push({
                    attacker: enemy.id,
                    attackerName: enemy.name,
                    damage: attackResult.damage,
                    isCritical: attackResult.isCritical
                });
                
                const critText = attackResult.isCritical ? ' (КРИТ!)' : '';
                logMessages.push({ 
                    message: `${enemy.name} наносит вам ${attackResult.damage} урона${critText}!`, 
                    type: 'battle' 
                });
                
                if (damageResult.isDead) {
                    results.deaths.push(player.id);
                    logMessages.push({ 
                        message: '💀 Вы погибли...', 
                        type: 'defeat' 
                    });
                }
            } else {
                logMessages.push({ 
                    message: `${enemy.name} промахнулся по вам!`, 
                    type: 'battle' 
                });
                results.enemyAttacks.push({
                    attacker: enemy.id,
                    attackerName: enemy.name,
                    damage: 0,
                    isCritical: false
                });
            }
        }
    }
    
    _processDeaths(deathIds, player, enemies) {
        for (const deadId of deathIds) {
            if (deadId === player.id) {
                this.onPlayerDefeated(player);
                return;
            } else {
                const deadEnemy = enemies.find(e => e.id === deadId);
                if (deadEnemy) {
                    this.onEnemyDefeated(deadEnemy);
                }
            }
        }
    }
    
    _endRound(player, enemies, results, logMessages) {
        // Сначала обновляем кулдауны (уменьшаем старые)
        if (window.game?.abilityService) {
            window.game.abilityService.updateCooldowns();
        }
        
        // Потом вызываем endRound для ВСЕХ механик, у которых есть такой метод
        for (const mechanicName in mechanics) {
            if (mechanics[mechanicName].endRound) {
                mechanics[mechanicName].endRound(this);
            }
        }
        
        if (logMessages.length > 0) {
            this.eventBus.emit('log:batch', logMessages);
        }
        
        this.eventBus.emit('battle:update', {
            player: player.getStats(),
            enemies: enemies.map(e => e.getInfo())
        });
        
        this.eventBus.emit('battle:roundComplete', results);
    }

    _applyMasteryGain(player, ability) {
        if (!window.game?.abilityService) return;
        
        window.game.abilityService.addMastery(
            player.id,
            ability.id,
            ability.masteryGain || 0.03
        );
        
        if (ability.type === 'spell' && ability.school) {
            const schoolSkillId = this._getSchoolSkillId(ability.school);
            if (schoolSkillId) {
                window.game.abilityService.addMastery(
                    player.id,
                    schoolSkillId,
                    0.02
                );
            }
        }
    }
    
    getBattleInfo() {
        if (!this.currentBattle) return null;
        
        return {
            round: this.currentBattle.round,
            playerHealth: this.currentBattle.player.health,
            enemies: this.currentBattle.enemies.map(e => ({
                id: e.id,
                name: e.name,
                health: e.health
            }))
        };
    }
    
    isInCombat() {
        return !!this.currentBattle;
    }
    
    _getSchoolSkillId(school) {
        const mapping = {
            'fire': 'магия_огня',
            'water': 'магия_воды',
            'air': 'магия_воздуха',
            'earth': 'магия_земли',
            'life': 'магия_жизни',
            'mind': 'магия_разума',
            'dark': 'магия_тьмы'
        };
        return mapping[school] || null;
    }

    _getWeaponSkillId(weaponType) {
        return weaponType || null;
    }
}

export { CombatSystem };
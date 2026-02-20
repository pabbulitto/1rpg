import { DiceRoller } from './DiceRoller.js';
import { DamageContextBuilder } from './DamageContextBuilder.js'; 
import { itemFactory } from '../core/ItemFactory.js';

class BattleSystem {
  constructor(diceRoller = null) {
    this.battleLog = [];
    this.diceRoller = diceRoller || new DiceRoller();
    this.damageContextBuilder = new DamageContextBuilder();
    this.game = null;
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
              attackRoll = { total: 999, rolls: [20] }; // Автопопадание
              naturalRoll = 20;
              isCritical = false; // Критики для способностей отдельно настраиваются
          } else {
              // ОРУЖИЕ: стандартный бросок
              const strMod = player.getStats().strengthMod || 0;
              const attackBonus = strMod + 2;
              const attackFormula = `1d20+${attackBonus}`;
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
              // Способности всегда попадают (магические атаки)
              hits = true;
          } else if (isCritical) {
              hits = true;
          } else if (isFumble) {
              hits = false;
          } else {
              hits = attackRoll.total >= enemyAC;
          }
          
          if (!hits) {
              totalLog.push(`🗡️ Вы ударили ${weaponName} но промахнулись`);
              continue;
          }
          
          // 6. Расчет урона
          const damageFormula = attack.damageFormula || '1d4';
          const damageContext = this.damageContextBuilder.buildForPlayer(player, {
              includeEquipment: !isAbilityAttack
          })
          
          const damageResult = this.diceRoller.roll(damageFormula, damageContext);
          let damage = damageResult.total;
          
          if (isCritical && !isAbilityAttack) {
              // Критический удар оружием: удваиваем кубы
              const diceTotal = damageResult.rolls.reduce((sum, roll) => sum + roll, 0);
              const modifierTotal = damageResult.total - diceTotal;
              damage = (diceTotal * 2) + modifierTotal;
          }
          
          // 7. Логирование
          const critText = isCritical ? " (крит!)" : "";
          const abilityText = isAbilityAttack ? "✨ " : "";
          totalLog.push(`${abilityText}Вы использовали ${weaponName} нанеся ${damage} урона${critText}`);
          
          // 8. Применяем урон
          const enemyResult = enemy.takeDamage(damage);
          totalDamage += damage;
          
          // 9. Проверяем смерть врага
          if (enemyResult.isDead) {
              enemyDead = true;
              totalLog.push(`🎊 Вы победили ${enemy.name}!`);
              break;
          }
      }
      
      // 10. Проверяем смерть игрока (если враг контратаковал бы)
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
      `Золото: ${goldReward}`
    ];
    
    if (expResult.levelsGained > 0) {
      log.push(`🎉 Вы достигли ${player.getStats().level} уровня!`);
    }
    
    const gotDrop = this.tryGenerateLoot(enemy, player);
    if (gotDrop) {
      log.push(`🎁 Дополнительная добыча: ${gotDrop}`);
    }
    
    return {
      exp: expReward,
      gold: goldReward,
      levelsGained: expResult.levelsGained,
      gotDrop: !!gotDrop,
      dropName: gotDrop,
      log
    };
  }
  /**
   * Сгенерировать лут после победы
   * @param {Object} enemy - побежденный враг
   * @param {Object} player - игрок
   * @returns {string|null} сообщения о луте
   */
  tryGenerateLoot(enemy, player) {
      const lootMessages = [];
      
      if (enemy.manualLoot && enemy.manualLoot.length > 0) {
          enemy.manualLoot.forEach(lootConfig => {
              // ===== СПЕЦОБРАБОТКА ДЛЯ ЗОЛОТА =====
              if (lootConfig.itemId === 'gold') {
                  const goldAmount = Math.floor(
                      (lootConfig.minCount || 1) + 
                      Math.random() * ((lootConfig.maxCount || lootConfig.minCount || 1) - (lootConfig.minCount || 1))
                  );
                  player.gameState.addGold(goldAmount);
                  lootMessages.push(`${goldAmount} золота`);
                  return;
              }
              
              // Обычные предметы
              if (Math.random() <= lootConfig.chance) {
                  // Создаем предмет через фабрику
                  const item = itemFactory.create(
                      lootConfig.itemId, 
                      lootConfig.count || 1
                  );
                  
                  if (item) {
                      // ИСПРАВЛЕНО: добавляем напрямую в контейнер игрока
                      const added = player.gameState.playerContainer.addItem(item);
                      if (added) {
                          lootMessages.push(item.name);
                      }
                  }
              }
          });
      }

      return lootMessages.length > 0 ? lootMessages.join(', ') : null;
  }
}

export { BattleSystem };
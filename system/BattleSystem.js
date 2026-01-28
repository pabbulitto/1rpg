class BattleSystem {
  constructor() {
    this.battleLog = [];
  }
  
  startBattle(player, enemy) {
    return {
      player: player.getStats(),
      enemy: enemy.getInfo(),
      log: [`⚔️ Начался бой!`, `Вы встретили ${enemy.name}!`]
    };
  }
  
  playerAttack(player, enemy, statManager) {
    const isDefending = statManager ? statManager.hasModifier('temp_defense_buff') : false;
    const playerStats = player.getStats();
    
    let log = [];
    let playerDamage = 0; 
    let enemyResult = null;
    
    if (isDefending) {
      // Режим защиты - пропускаем атаку
      log.push(`🎯 Вы сконцентрированы на защите и пропускаете атаку.`);
    } else {
      // Обычная атака
      playerDamage = Math.max(1, playerStats.attack - Math.floor(Math.random() * 3));
      enemyResult = enemy.takeDamage(playerDamage);
      
      log.push(`🗡️ Вы нанесли ${playerDamage} урона ${enemy.name}!`);
      
      if (enemyResult.isDead) {
        // Враг убит - возвращаем полный объект
        log.push(`🎊 Вы победили ${enemy.name}!`);
        return {
          type: 'player_attack',
          damage: playerDamage,
          enemyDead: true,
          enemyDamage: 0, // Враг не атаковал
          playerDead: false,
          isDefending: false,
          log
        };
      }
    }
       
    const enemyDamage = enemy.attackPlayer(playerStats);
    const playerResult = player.takeDamage(enemyDamage);
    
    log.push(`👹 ${enemy.name} нанес вам ${enemyDamage} урона!`);
    
    if (playerResult.isDead) {
      log.push("💀 Вы погибли...");
      return {
        type: 'player_attack',
        damage: playerDamage,
        enemyDead: false,
        enemyDamage,
        playerDead: true,
        isDefending,
        log
      };
    }
    
    return {
      type: 'player_attack',
      damage: playerDamage,
      enemyDead: false,
      enemyDamage,
      playerDead: false,
      isDefending,
      log
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
      
      const playerStats = player.getStats();
      const enemyDamage = enemy.attackPlayer(playerStats);
      const playerResult = player.takeDamage(enemyDamage);
      
      log.push(`${enemy.name} атаковал вас!`);
      log.push(`Получено ${enemyDamage} урона`);
      
      return {
        success: false,
        enemyDamage,
        playerDead: playerResult.isDead,
        log
      };
    }
  }
  
  endBattleVictory(player, enemy, inventorySystem) {
    const expReward = enemy.expReward;
    const goldReward = enemy.goldReward;
    
    const expResult = player.gainExp(expReward);
    
    let log = [
      `🎊 Победа! Вы получили:`,
      `Опыт: ${expReward}`,
      `Золото: ${goldReward}`
    ];
    
    if (expResult.levelsGained > 0) {
      log.push(`🎉 Вы достигли ${player.getStats().level} уровня!`);
    }
    
    const gotDrop = this.tryGenerateLoot(enemy, inventorySystem, player);
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
  
  tryGenerateLoot(enemy, inventorySystem, player) {
    const lootMessages = [];
    // НОВАЯ система ручного лута
    if (enemy.manualLoot && enemy.manualLoot.length > 0) {
      enemy.manualLoot.forEach(lootConfig => {
        if (Math.random() <= lootConfig.chance) {
          const added = inventorySystem.addItemById(
            lootConfig.itemId, 
            lootConfig.count || 1
          );
          if (added && window.itemsData?.[lootConfig.itemId]) {
            lootMessages.push(window.itemsData[lootConfig.itemId].name);
          }
        }
      });
    }

    return lootMessages.length > 0 ? lootMessages.join(', ') : null;
  }
  
  clearLog() {
    this.battleLog = [];
  }
}

export { BattleSystem };

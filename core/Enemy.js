class Enemy {
  constructor(enemyType, targetLevel = 1) {
    const baseData = window.enemiesData?.[enemyType] || this.getDefaultData();
    
    const scale = targetLevel / baseData.baseLevel;
    
    this.id = `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = enemyType;
    this.type = enemyType;
    this.level = targetLevel;
    
    this.health = Math.floor(baseData.baseHealth * scale);
    this.maxHealth = Math.floor(baseData.baseHealth * scale);
    this.attack = Math.floor(baseData.baseAttack * scale);
    this.defense = Math.floor(baseData.baseDefense * scale);
    
    this.expReward = Math.floor(baseData.baseExp * scale);
    this.goldReward = Math.floor(baseData.baseGold * scale);
    
    this.specialAbilities = baseData.specialAbilities || [];
    this.manualLoot = baseData.manualLoot || [];

  }
  
  getDefaultData() {
    return {
      baseHealth: 20,
      baseAttack: 5,
      baseDefense: 0,
      baseLevel: 1,
      baseExp: 10,
      baseGold: 5,
      specialAbilities: []
    };
  }
  
  takeDamage(damage) {
    const actualDamage = Math.max(1, damage - this.defense);
    this.health -= actualDamage;
    
    return {
      damage: actualDamage,
      isDead: this.health <= 0,
      healthRemaining: this.health
    };
  }
  
  attackPlayer(player) {
      let damage = this.attack;
      
      if (this.specialAbilities.includes("Сильный удар")) {
          damage = Math.floor(damage * 1.5);
      }
      
      if (this.specialAbilities.includes("Критический удар") && Math.random() < 0.2) {
          damage = Math.floor(damage * 2);
      }
      
      // НОВОЕ: учитываем модификаторы защиты игрока
      const game = window.game;
      if (game && game.gameState && game.gameState.statManager) {
          const playerStats = game.gameState.statManager.getFinalStats();
          const playerDefense = playerStats.defense || 0;
          
          // Учитываем уворот и блок из StatManager
          if (playerStats.dodge > 0 && Math.random() * 100 < playerStats.dodge) {
              return 0; // Уворот
          }
          
          if (playerStats.blockChance > 0 && Math.random() * 100 < playerStats.blockChance) {
              damage = Math.floor(damage * 0.1); // Блокируем 90% урона
          }
          
          // Защита уменьшает урон
          damage = Math.max(1, damage - playerDefense);
      }
      
      return damage;
  }
  
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      level: this.level,
      health: this.health,
      maxHealth: this.maxHealth,
      attack: this.attack,
      defense: this.defense,
      expReward: this.expReward,
      goldReward: this.goldReward,
      specialAbilities: this.specialAbilities
    };
  }
  static createEnemy(enemyType, targetLevel = 1) {
    return new Enemy(enemyType, targetLevel);
  }

}
export { Enemy };

class Player {
  constructor(gameState) {
    this.gameState = gameState;
  }

  takeDamage(damage) {
    const player = this.gameState.getPlayer();
    const actualDamage = Math.max(1, damage - player.defense);
    const newHealth = player.health - actualDamage;
    
    this.gameState.updatePlayerHealth(newHealth);
    
    return {
      damage: actualDamage,
      isDead: newHealth <= 0,
      healthRemaining: newHealth
    };
  }
  
  heal(amount) {
    const player = this.gameState.getPlayer(); 
    const oldHealth = player.health;
    const newHealth = Math.min(player.maxHealth, player.health + amount);
    
    this.gameState.updatePlayerHealth(newHealth);
    return newHealth - oldHealth;
  }

  gainExp(amount) {
    const levelsGained = this.gameState.addExp(amount);
    return { 
      levelsGained, 
      expRemaining: this.gameState.getPlayer().expToNext - this.gameState.getPlayer().exp 
    };
  }

  equipItem(item, slot = null) {
    if (!item || !item.slot) return false;
    
    const actualSlot = slot || item.slot;
    this.gameState.updateEquipment(actualSlot, item);
    return true;
  }

  unequipItem(slot) {
    const equipment = this.gameState.getEquipment();
    const item = equipment[slot];
    
    if (!item) return null;
    
    this.gameState.updateEquipment(slot, null);
    return item;
  }

  getStats() {
    return this.gameState.getPlayer();
  }

  toJSON() {
    return this.gameState.getPlayer();
  }
}

export { Player };
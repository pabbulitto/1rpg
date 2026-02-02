class Player {
  constructor(gameState) {
    this.gameState = gameState;
  }

  takeDamage(damage) {
    const playerStats = this.gameState.getStatManager().getFinalStats();
    const playerDefense = playerStats.defense || 0;
    const actualDamage = Math.max(1, damage - playerDefense);
    
    const currentHealth = this.gameState.getStatManager().getResource('health');
    const newHealth = Math.max(0, currentHealth - actualDamage);
    
    this.gameState.getStatManager().setResource('health', newHealth);
    
    this.gameState.eventBus.emit('player:statsChanged', this.gameState.getPlayer());
    return {
      damage: actualDamage,
      isDead: newHealth <= 0,
      healthRemaining: newHealth
    };
  }

  takeStamina(amount) {
    const statManager = this.gameState.getStatManager();
    const currentStamina = statManager.getResource('stamina');
    
    if (currentStamina < amount) {
      return { 
        success: false, 
        staminaRemaining: currentStamina,
        needed: amount,
        message: `Недостаточно выносливости. Нужно: ${amount}, имеется: ${currentStamina}`
      };
    }
    
    const newStamina = statManager.modifyResource('stamina', -amount);
    
    this.gameState.eventBus.emit('player:statsChanged', this.gameState.getPlayer());
    return { 
      success: true, 
      staminaRemaining: newStamina,
      staminaUsed: amount,
      message: `Потрачено ${amount} выносливости`
    };
  } 
  
  heal(amount) {
    const statManager = this.gameState.getStatManager();
    const currentHealth = statManager.getResource('health');
    const maxHealth = statManager.getFinalStats().maxHealth;
    
    const newHealth = Math.min(maxHealth, currentHealth + amount);
    statManager.setResource('health', newHealth);
    
    this.gameState.eventBus.emit('player:statsChanged', this.gameState.getPlayer());

    return newHealth - currentHealth;
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
import { StatManager } from './StatManager.js';
import { TimeSystem } from '../system/TimeSystem.js';
import { EventBus } from './EventBus.js';

class GameState {
  constructor() {
    this.eventBus = new EventBus();
    window.EventBus = this.eventBus;
    
    this.player = {
      name: "Герой",
      level: 1,
      exp: 0,
      expToNext: 100,
      gold: 50,
      potions: 2,
      equipment: {
        head: null,
        neck1: null,
        neck2: null,
        arms: null,
        hands: null,
        ring1: null,
        ring2: null,
        body: null,
        belt: null,
        legs: null,
        feet: null,
        right_hand: null,
        left_hand: null
      },
      activeEffects: []
    };
    
    this.statManager = new StatManager({
      health: 100,
      maxHealth: 100,
      attack: 15,
      defense: 5,
      strength: 10,
      agility: 10,
      constitution: 10,
      wisdom: 10,
      intelligence: 10,
      charisma: 10,
      mana: 50,
      maxMana: 50,
      stamina: 100,
      maxStamina: 100,
      fireResistance: 0,
      waterResistance: 0,
      earthResistance: 0,
      airResistance: 0,
      darkResistance: 0,
      poisonResistance: 0,
      physicalResistance: 0
    });
    
    this.position = {
      zone: 'village',
      room: 'village_square',
      visitedRooms: new Set(['village:village_square'])
    };
    
    this.inventory = {
      items: [],
      capacity: 30
    };
    
    this.battle = {
      inBattle: false,
      currentEnemy: null,
      battleLog: []
    };
    
    this.shop = {
      currentShop: null,
      shopItems: []
    };
    
    this.progress = {
      gameTime: 0,
      kills: 0,
      goldEarned: 0,
      goldSpent: 0
    };
    
    this.conditions = {
      hungry: false,
      thirsty: false,
      poisoned: false,
      blessed: false,
      cursed: false
    };
    
    this.timeSystem = new TimeSystem(this);
    this.setupTimeListeners();
  }
  
  getEventBus() {
    return this.eventBus;
  }

  setupTimeListeners() {
    const timeSystem = this.timeSystem;
    
    timeSystem.registerCondition(() => {
      this.updateConditionsOverTime();
    });
    
    timeSystem.registerCustom('gameState', (tick, gameTime) => {
      this.progress.gameTime = tick;
    });
    
    timeSystem.registerCustom('resource_regeneration', (tick, gameTime) => {
      this.regenerateResources();
    });
  }
  
  updateConditionsOverTime() {
    const gameTime = this.timeSystem.getGameTime();
    
    if (gameTime.hour % 4 === 0 && gameTime.minute === 0) {
      if (!this.conditions.hungry) this.conditions.hungry = true;
      if (!this.conditions.thirsty) this.conditions.thirsty = true;
      this.applyConditionEffects();
    }
  }

  regenerateResources() {
    const stats = this.statManager.getFinalStats();
    
    if (stats.healthRegen > 0) {
      const currentHealth = this.statManager.getResource('health');
      if (currentHealth > 0 && currentHealth < stats.maxHealth) {
        const newHealth = Math.min(currentHealth + stats.healthRegen, stats.maxHealth);
        this.statManager.setResource('health', newHealth);
        this.eventBus.emit('player:statsChanged', this.getPlayer());
      }
    }
    
    if (stats.manaRegen > 0) {
      const currentMana = this.statManager.getResource('mana');
      if (currentMana < stats.maxMana) {
        const newMana = Math.min(currentMana + stats.manaRegen, stats.maxMana);
        this.statManager.setResource('mana', newMana);
        this.eventBus.emit('player:statsChanged', this.getPlayer());
      }
    }
    
    if (stats.staminaRegen > 0) {
      const currentStamina = this.statManager.getResource('stamina');
      if (currentStamina < stats.maxStamina) {
        const newStamina = Math.min(currentStamina + stats.staminaRegen, stats.maxStamina);
        this.statManager.setResource('stamina', newStamina);
        this.eventBus.emit('player:statsChanged', this.getPlayer());
      }
    }
  }
    
  addEffect(effect) {
    if (!effect || !effect.id) return false;
    
    const existingIndex = this.player.activeEffects.findIndex(e => e.id === effect.id);
    
    if (existingIndex >= 0) {
      const existing = this.player.activeEffects[existingIndex];
      if (existing.addStack) {
        existing.addStack(1);
      }
      return false;
    } else {
      this.player.activeEffects.push(effect);
      
      if (effect.apply) {
        effect.apply(this);
      }
      
      return true;
    }
  }
  
  removeEffect(effectId) {
    const index = this.player.activeEffects.findIndex(e => e.id === effectId);
    if (index >= 0) {
      const effect = this.player.activeEffects[index];
      
      if (effect.remove) {
        effect.remove(this);
      }
      
      this.player.activeEffects.splice(index, 1);
      return true;
    }
    return false;
  }
  
  getActiveEffects() {
    return [...this.player.activeEffects];
  }
  
  hasEffect(effectId) {
    return this.player.activeEffects.some(e => e.id === effectId);
  }
  
  getTimeSystem() {
    return this.timeSystem;
  }
  
  getPlayer() {
    const finalStats = this.statManager.getFinalStats();
    const statsForUI = this.statManager.getStatsForUI();

    return {
      ...this.player,
      health: this.statManager.getResource('health'),
      maxHealth: finalStats.maxHealth,
      attack: finalStats.attack,
      defense: finalStats.defense,
      mana: this.statManager.getResource('mana'),
      maxMana: finalStats.maxMana,
      stamina: this.statManager.getResource('stamina'),
      maxStamina: finalStats.maxStamina,
      strength: finalStats.strength,
      agility: finalStats.agility,
      constitution: finalStats.constitution,
      wisdom: finalStats.wisdom,
      intelligence: finalStats.intelligence,
      charisma: finalStats.charisma,
      initiative: finalStats.initiative,
      hitChance: finalStats.hitChance,
      critChance: finalStats.critChance,
      critPower: finalStats.critPower,
      dodge: finalStats.dodge,
      blockChance: finalStats.blockChance,
      healthRegen: finalStats.healthRegen,
      manaRegen: finalStats.manaRegen,
      staminaRegen: finalStats.staminaRegen,
      activeEffects: this.getActiveEffects().map(effect => effect.getInfo ? effect.getInfo() : effect),
      conditions: this.getConditions()
    };
  }
  
  getPosition() {
    return { ...this.position };
  }
  
  getBattleState() {
    return { ...this.battle };
  }
  
  getInventory() {
    return { 
      items: [...this.inventory.items],
      equipment: { ...this.player.equipment },
      capacity: this.inventory.capacity
    };
  }
  
  getInventoryItems() {
    return [...this.inventory.items];
  }
  
  getEquipment() {
    return { ...this.player.equipment };
  }
  
  getShopState() {
    return { ...this.shop };
  }
  
  getStatManager() {
    return this.statManager;
  }
  
  getConditions() {
    return { ...this.conditions };
  }
  
  getAllStats() {
    return this.statManager.getStatsForUI();
  }
  
  updatePlayer(updates) {
    this.player = { ...this.player, ...updates };
    this.eventBus.emit('player:statsChanged', this.getPlayer());
  }
  
  updatePlayerHealth(health) {
    const finalStats = this.statManager.getFinalStats();
    const newHealth = Math.max(0, Math.min(health, finalStats.maxHealth));
    this.statManager.setResource('health', newHealth);
    this.eventBus.emit('player:statsChanged', this.getPlayer());
  }
  
  addEffect(effect) {
    if (!effect || !effect.id) return false;
    
    const existingIndex = this.player.activeEffects.findIndex(e => e.id === effect.id);
    
    if (existingIndex >= 0) {
      const existing = this.player.activeEffects[existingIndex];
      if (existing.addStack) {
        existing.addStack(1);
      }
      return false;
    } else {
      this.player.activeEffects.push(effect);
      
      if (effect.apply) {
        effect.apply(this);
      }
      
      return true;
    }
  }
  
  removeEffect(effectId) {
    const index = this.player.activeEffects.findIndex(e => e.id === effectId);
    if (index >= 0) {
      const effect = this.player.activeEffects[index];
      
      if (effect.remove) {
        effect.remove(this);
      }
      
      this.player.activeEffects.splice(index, 1);
      return true;
    }
    return false;
  }
  
  updatePosition(zone, room) {
    this.position.zone = zone;
    this.position.room = room;
    this.position.visitedRooms.add(`${zone}:${room}`);
  }
  
  updateBattle(enemy = null, inBattle = false) {
    this.battle.currentEnemy = enemy;
    this.battle.inBattle = inBattle;
    if (!inBattle) {
      this.battle.battleLog = [];
    }
  }
  
  addBattleLog(message) {
    this.battle.battleLog.push(message);
    if (this.battle.battleLog.length > 50) {
      this.battle.battleLog.shift();
    }
  }
  
  addInventoryItem(item) {
    this.inventory.items.push(item);
  }

  removeInventoryItem(index) {
    if (index >= 0 && index < this.inventory.items.length) {
      const removedItem = this.inventory.items[index];
      this.inventory.items.splice(index, 1);
      return removedItem;
    }
    return null;
  }
  
  updateEquipment(slot, item) {
    this.player.equipment[slot] = item;
  }
  
  updateShop(shopData, items) {
    this.shop.currentShop = shopData;
    this.shop.shopItems = items || [];
  }
  
  addGold(amount) {
    this.player.gold += amount;
    if (amount > 0) {
      this.progress.goldEarned += amount;
    }
    this.eventBus.emit('player:statsChanged', this.getPlayer());
    return true;
  }
  
  spendGold(amount) {
    if (this.player.gold >= amount) {
      this.player.gold -= amount;
      this.progress.goldSpent += amount;
      this.eventBus.emit('player:statsChanged', this.getPlayer());
      return true;
    }
    return false;
  }
  
  addExp(amount) {
    this.player.exp += amount;
    let levelsGained = 0;
    
    while (this.player.exp >= this.player.expToNext) {
      this.player.exp -= this.player.expToNext;
      this.player.level++;
      this.player.expToNext = Math.floor(this.player.expToNext * 2);
      levelsGained++;
      
      const baseStats = this.statManager.getBaseStats();
      const newBaseStats = {
        ...baseStats,
        maxHealth: baseStats.maxHealth + 20,
        health: (baseStats.health || 0) + 20,
        attack: baseStats.attack + 5,
        defense: baseStats.defense + 2,
        strength: baseStats.strength + 1,
        agility: baseStats.agility + 1,
        constitution: baseStats.constitution + 1,
        wisdom: baseStats.wisdom + 1,
        intelligence: baseStats.intelligence + 1,
        charisma: baseStats.charisma + 1,
        maxMana: baseStats.maxMana + 10,
        maxStamina: baseStats.maxStamina + 15
      };
      
      this.statManager.setBaseStats(newBaseStats);
    }

    if (levelsGained > 0) {
      this.eventBus.emit('player:levelUp', {
        newLevel: this.player.level,
        newStats: this.statManager.getFinalStats()
      });
    }
    this.eventBus.emit('player:statsChanged', this.getPlayer());

    return levelsGained;
  }
  
  setCondition(condition, value) {
    if (this.conditions.hasOwnProperty(condition)) {
      this.conditions[condition] = value;
      this.applyConditionEffects();
    }
  }
  
  applyConditionEffects() {
    let modifiers = {};
    
    if (this.conditions.hungry) {
      modifiers.healthRegen = -0.5;
      modifiers.manaRegen = -0.5;
      modifiers.staminaRegen = -0.5;
    }
    
    if (this.conditions.thirsty) {
      modifiers.healthRegen = (modifiers.healthRegen || 1) * 0.5;
      modifiers.manaRegen = (modifiers.manaRegen || 1) * 0.5;
      modifiers.staminaRegen = (modifiers.staminaRegen || 1) * 0.5;
    }
    
    if (this.conditions.poisoned) {
      modifiers.strength = -0.1;
      modifiers.agility = -0.1;
      modifiers.constitution = -0.1;
    }
    
    this.statManager.removeModifier('conditions_effects');
    if (Object.keys(modifiers).length > 0) {
      this.statManager.addModifier('conditions_effects', modifiers);
    }
  }
  
  toJSON() {
    const savedEffects = this.player.activeEffects.map(effect => {
      if (effect.getInfo) {
        return {
          ...effect.getInfo(),
          className: effect.constructor.name
        };
      }
      return effect;
    });
    
    return {
      player: {
        ...this.player,
        activeEffects: savedEffects
      },
      position: {
        ...this.position,
        visitedRooms: Array.from(this.position.visitedRooms)
      },
      inventory: this.inventory,
      battle: this.battle,
      shop: this.shop,
      progress: this.progress,
      conditions: this.conditions,
      statManager: this.statManager.toJSON(),
      timeState: this.timeSystem.saveTimeState()
    };
  }
  
  fromJSON(data) {
    this.player = data.player || this.player;
    this.position = {
      ...data.position,
      visitedRooms: new Set(data.position.visitedRooms || [])
    };
    this.inventory = data.inventory || this.inventory;
    this.battle = data.battle || this.battle;
    this.shop = data.shop || this.shop;
    this.progress = data.progress || this.progress;
    this.conditions = data.conditions || this.conditions;
    
    if (data.statManager) {
      this.statManager.fromJSON(data.statManager);
      this.applyConditionEffects();
    }
    
    if (data.timeState) {
      this.timeSystem.loadTimeState(data.timeState);
    }
    
    if (data.player?.activeEffects) {
      this.player.activeEffects = data.player.activeEffects;
    }
    
    setTimeout(() => {
      if (this.timeSystem && !this.timeSystem.isRunning) {
        this.timeSystem.start();
      }
    }, 1000);
  }
  
  pauseTime() {
    if (this.timeSystem) {
      this.timeSystem.stop();
    }
  }
  
  resumeTime() {
    if (this.timeSystem && !this.timeSystem.isRunning) {
      this.timeSystem.start();
    }
  }
  
  fastForwardTime(ticks) {
    if (this.timeSystem) {
      this.timeSystem.fastForward(ticks);
    }
  }
}

export { GameState };
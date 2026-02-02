class StatManager {
  constructor(baseStats = {}) {
    this.baseStats = {
      health: baseStats.health || 100,
      maxHealth: baseStats.maxHealth || 100,
      attack: baseStats.attack || 15,
      defense: baseStats.defense || 5,
      strength: baseStats.strength || 10,
      agility: baseStats.agility || 10,
      constitution: baseStats.constitution || 10,
      wisdom: baseStats.wisdom || 10,
      intelligence: baseStats.intelligence || 10,
      charisma: baseStats.charisma || 10,
      mana: baseStats.mana || 50,
      maxMana: baseStats.maxMana || 50,
      stamina: baseStats.stamina || 100,
      maxStamina: baseStats.maxStamina || 100,
      fireResistance: baseStats.fireResistance || 0,
      waterResistance: baseStats.waterResistance || 0,
      earthResistance: baseStats.earthResistance || 0,
      airResistance: baseStats.airResistance || 0,
      darkResistance: baseStats.darkResistance || 0,
      poisonResistance: baseStats.poisonResistance || 0,
      physicalResistance: baseStats.physicalResistance || 0
    };

    this.currentResources = {
      health: baseStats.health || this.baseStats.health,
      mana: baseStats.mana || this.baseStats.mana,
      stamina: baseStats.stamina || this.baseStats.stamina
    };

    this.modifiers = [];
    this.finalStats = this.calculateFinalStats();
    this.needsRecalculation = false;
  }

  addModifier(source, stats) {
    if (!source || typeof source !== 'string') {
      console.error('StatManager: source должен быть непустой строкой');
      return false;
    }

    const processedStats = { ...stats };
    if (processedStats.health !== undefined) {
      processedStats.maxHealth = (processedStats.maxHealth || 0) + processedStats.health;
      delete processedStats.health;
    }

    const existingIndex = this.modifiers.findIndex(m => m.source === source);
    
    if (existingIndex >= 0) {
      this.modifiers[existingIndex].stats = { ...processedStats };
      this.needsRecalculation = true;
      this.finalStats = this.calculateFinalStats();
      return false;
    } else {
      this.modifiers.push({
        source,
        stats: { ...processedStats }
      });
      this.needsRecalculation = true;
      this.finalStats = this.calculateFinalStats();
      return true;
    }
  }

  removeModifier(source) {
    const initialLength = this.modifiers.length;
    this.modifiers = this.modifiers.filter(m => m.source !== source);
    
    if (this.modifiers.length !== initialLength) {
      this.needsRecalculation = true;
      this.finalStats = this.calculateFinalStats();
      return true;
    }
    return false;
  }

  calculateFinalStats() {
    const result = { ...this.baseStats };

    for (const modifier of this.modifiers) {
      for (const [statKey, value] of Object.entries(modifier.stats)) {
        if (result[statKey] === undefined) {
          result[statKey] = 0;
        }
        
        if (typeof value === 'number') {
          result[statKey] += value;
        } else {
          console.warn(`StatManager: некорректное значение для ${statKey}:`, value);
        }
      }
    }

    this.calculateDerivedStats(result);
    this.applyMinimumValues(result);

    return result;
  }

  calculateDerivedStats(result) {
    result.attack = (result.attack || 0) + Math.floor(result.strength * 1.5);
    result.defense = (result.defense || 0) + Math.floor(result.constitution * 0.5);
    
    result.hitChance = 75 + Math.floor(result.agility * 1.2);
    result.critChance = 5 + Math.floor(result.agility * 0.8);
    result.critPower = 150 + Math.floor(result.strength * 3);
    result.dodge = Math.floor(result.agility * 1.5);
    result.initiative = 10 + Math.floor(result.agility * 2);
    
    result.blockChance = Math.min(50, Math.floor((result.defense || 0) / 2));
    
    const baseHealth = Math.floor(result.constitution * 10);
    result.maxHealth = (result.maxHealth || 0) + baseHealth;
    
    const baseMana = Math.floor(result.wisdom * 12 + result.intelligence * 3);
    result.maxMana = (result.maxMana || 0) + baseMana;
    
    const baseStamina = Math.floor(result.agility * 10 + result.constitution * 3);
    result.maxStamina = (result.maxStamina || 0) + baseStamina;
    
    result.healthRegen = (result.healthRegen || 0) + Math.floor(result.constitution * 0.5);
    result.manaRegen = (result.manaRegen || 0) + Math.floor(result.wisdom * 0.8);
    result.staminaRegen = (result.staminaRegen || 0) + Math.floor(result.agility * 1.2);
  }

  applyMinimumValues(result) {
    if (result.health !== undefined && result.health < 0) result.health = 0;
    if (result.maxHealth !== undefined && result.maxHealth < 1) result.maxHealth = 1;
    if (result.mana !== undefined && result.mana < 0) result.mana = 0;
    if (result.maxMana !== undefined && result.maxMana < 0) result.maxMana = 0;
    if (result.stamina !== undefined && result.stamina < 0) result.stamina = 0;
    if (result.maxStamina !== undefined && result.maxStamina < 0) result.maxStamina = 0;
    
    if (result.attack !== undefined && result.attack < 0) result.attack = 0;
    if (result.defense !== undefined && result.defense < 0) result.defense = 0;
    if (result.hitChance !== undefined) result.hitChance = Math.max(1, Math.min(result.hitChance, 95));
    if (result.critChance !== undefined) result.critChance = Math.max(0, Math.min(result.critChance, 50));
    if (result.critPower !== undefined && result.critPower < 100) result.critPower = 100;
    if (result.dodge !== undefined) result.dodge = Math.max(0, Math.min(result.dodge, 80));
    if (result.blockChance !== undefined) result.blockChance = Math.max(0, Math.min(result.blockChance, 90));
    if (result.initiative !== undefined && result.initiative < 0) result.initiative = 0;
    
    const attributes = ['strength', 'agility', 'constitution', 'wisdom', 'intelligence', 'charisma'];
    attributes.forEach(attr => {
      if (result[attr] !== undefined && result[attr] < 1) result[attr] = 1;
    });
    
    const resistances = ['fireResistance', 'waterResistance', 'earthResistance', 
                         'airResistance', 'darkResistance', 'poisonResistance', 'physicalResistance'];
    resistances.forEach(res => {
      if (result[res] !== undefined) {
        result[res] = Math.max(-100, Math.min(result[res], 100));
      }
    });
  }

  setBaseStats(newBaseStats) {
    this.baseStats = { 
      ...this.baseStats,
      ...newBaseStats 
    };
    this.needsRecalculation = true;
    this.finalStats = this.calculateFinalStats();
  }

  getFinalStats() {
    if (this.needsRecalculation) {
      this.finalStats = this.calculateFinalStats();
      this.needsRecalculation = false;
    }
    
    const result = { ...this.finalStats };
    
    result.health = this.getResource('health');
    result.mana = this.getResource('mana');
    result.stamina = this.getResource('stamina');
    
    return result;
  }

  getBaseStats() {
    return { ...this.baseStats };
  }

  getModifiers() {
    return this.modifiers.map(m => ({ ...m }));
  }

  hasModifier(source) {
    return this.modifiers.some(m => m.source === source);
  }

  clearAllModifiers() {
    const count = this.modifiers.length;
    this.modifiers = [];
    this.needsRecalculation = true;
    this.finalStats = this.calculateFinalStats();
    return count;
  }

  // === НОВЫЕ МЕТОДЫ ДЛЯ РЕСУРСОВ ===
  setResource(name, value) {
    if (!['health', 'mana', 'stamina'].includes(name)) {
      console.error(`StatManager: неизвестный ресурс ${name}`);
      return false;
    }

    const maxValue = this.getFinalStats()[`max${name.charAt(0).toUpperCase() + name.slice(1)}`];
    const clampedValue = Math.max(0, Math.min(value, maxValue || value));
    
    this.currentResources[name] = clampedValue;
    return true;
  }

  getResource(name) {
    if (!['health', 'mana', 'stamina'].includes(name)) {
      console.error(`StatManager: неизвестный ресурс ${name}`);
      return 0;
    }
    return this.currentResources[name] || 0;
  }

  modifyResource(name, delta) {
    if (!['health', 'mana', 'stamina'].includes(name)) {
      console.error(`StatManager: неизвестный ресурс ${name}`);
      return false;
    }

    const current = this.getResource(name);
    const maxValue = this.getFinalStats()[`max${name.charAt(0).toUpperCase() + name.slice(1)}`];
    const newValue = Math.max(0, Math.min(current + delta, maxValue));
    
    this.currentResources[name] = newValue;
    return newValue;
  }

  getStatsForUI() {
    const stats = this.getFinalStats();
    return {
      player: {
        health: this.getResource('health'),
        maxHealth: stats.maxHealth,
        attack: stats.attack,
        defense: stats.defense,
        mana: this.getResource('mana'),
        maxMana: stats.maxMana,
        stamina: this.getResource('stamina'),
        maxStamina: stats.maxStamina
      },
      attributes: {
        strength: stats.strength,
        agility: stats.agility,
        constitution: stats.constitution,
        wisdom: stats.wisdom,
        intelligence: stats.intelligence,
        charisma: stats.charisma
      },
      combat: {
        attack: stats.attack,
        defense: stats.defense,
        initiative: stats.initiative,
        hitChance: stats.hitChance,
        critChance: stats.critChance,
        critPower: stats.critPower,
        dodge: stats.dodge,
        blockChance: stats.blockChance
      },
      resources: {
        health: this.getResource('health'),
        maxHealth: stats.maxHealth,
        mana: this.getResource('mana'),
        maxMana: stats.maxMana,
        stamina: this.getResource('stamina'),
        maxStamina: stats.maxStamina,
        healthRegen: stats.healthRegen,
        manaRegen: stats.manaRegen,
        staminaRegen: stats.staminaRegen
      },
      resistances: {
        fireResistance: stats.fireResistance,
        waterResistance: stats.waterResistance,
        earthResistance: stats.earthResistance,
        airResistance: stats.airResistance,
        darkResistance: stats.darkResistance,
        poisonResistance: stats.poisonResistance,
        physicalResistance: stats.physicalResistance
      }
    };
  }

  fromJSON(data) {
    if (data.baseStats) {
      this.baseStats = { ...data.baseStats };
    }
    
    if (data.modifiers && Array.isArray(data.modifiers)) {
      this.modifiers = data.modifiers.map(m => ({ ...m }));
    }
    
    if (data.currentResources) {
      this.currentResources = { ...data.currentResources };
    } else {
      this.currentResources = {
        health: this.baseStats.health || 100,
        mana: this.baseStats.mana || 50,
        stamina: this.baseStats.stamina || 100
      };
    }
    
    this.needsRecalculation = true;
    this.finalStats = this.calculateFinalStats();
  }
}

export { StatManager };
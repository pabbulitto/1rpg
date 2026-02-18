// core/StatManager.js
import { FormulaCalculator } from '../system/FormulaCalculator.js';
import { FormulaParser } from '../system/FormulaParser.js';

class StatManager {
  constructor(baseStats = {}, formulaCalculator = null, formulaParser = null) {
    this.baseStats = {
      strength: baseStats.strength || 15,
      dexterity: baseStats.dexterity || 15,
      constitution: baseStats.constitution || 14,
      intelligence: baseStats.intelligence || 11,
      wisdom: baseStats.wisdom || 11,
      charisma: baseStats.charisma || 12,
      baseHealth: baseStats.baseHealth || 20,   
      baseMana: baseStats.baseMana || 20,         
      baseStamina: baseStats.baseStamina || 25,  
      health: baseStats.health || 20,
      mana: baseStats.mana || 20,
      stamina: baseStats.stamina || 25,
      attack: baseStats.attack || 0,
      defense: baseStats.defense || 0,
      armorClass: baseStats.armorClass || 0
    };

    this.currentResources = {
      health: baseStats.health || this.baseStats.health,
      mana: baseStats.mana || this.baseStats.mana,
      stamina: baseStats.stamina || this.baseStats.stamina
    };

    this.modifiers = [];
    this.needsRecalculation = false;
    
    this.formulaCalculator = formulaCalculator || new FormulaCalculator();
    this.formulaParser = formulaParser || new FormulaParser();
    
    this.finalStats = this.calculateFinalStats();
  }

  // === МОДИФИКАТОРЫ ===
  addModifier(source, stats) {
    if (!source || typeof source !== 'string') {
      console.error('StatManager: source должен быть непустой строкой');
      return false;
    }

    const processedStats = { ...stats };
    
    const existingIndex = this.modifiers.findIndex(m => m.source === source);
    
    if (existingIndex >= 0) {
      this.modifiers[existingIndex].stats = { ...processedStats };
    } else {
      this.modifiers.push({
        source,
        stats: { ...processedStats }
      });
    }
    
    this.needsRecalculation = true;
    this.finalStats = this.calculateFinalStats();
    return true;
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

  // === ОСНОВНОЙ РАСЧЁТ ===
  calculateFinalStats() {
    const result = { ...this.baseStats };

    // Применяем модификаторы
    for (const modifier of this.modifiers) {
      for (const [statKey, value] of Object.entries(modifier.stats)) {
        if (result[statKey] === undefined) result[statKey] = 0;
        if (typeof value === 'number') {
          result[statKey] += value;
        }
      }
    }

    // Суммируем бонусы из модификаторов
    let healthBonus = 0;
    let manaBonus = 0;
    let maxStaminaBonus = 0;
    let armorBonus = 0;
    let defenseBonus = 0;

    for (const modifier of this.modifiers) {
      if (modifier.stats.maxHealth) healthBonus += modifier.stats.maxHealth;
      if (modifier.stats.maxMana) manaBonus += modifier.stats.maxMana;
      if (modifier.stats.maxStamina) maxStaminaBonus += modifier.stats.maxStamina;
      if (modifier.stats.armor) armorBonus += modifier.stats.armor;
      if (modifier.stats.defense) defenseBonus += modifier.stats.defense;
    }

    // === МОДИФИКАТОРЫ ХАРАКТЕРИСТИК ===
    result.strengthMod = this.formulaCalculator.calculateModifier(result.strength);
    result.dexterityMod = this.formulaCalculator.calculateModifier(result.dexterity);
    result.constitutionMod = this.formulaCalculator.calculateModifier(result.constitution);
    result.intelligenceMod = this.formulaCalculator.calculateModifier(result.intelligence);
    result.wisdomMod = this.formulaCalculator.calculateModifier(result.wisdom);
    result.charismaMod = this.formulaCalculator.calculateModifier(result.charisma);

    // === БОЕВЫЕ ХАРАКТЕРИСТИКИ ===
    const totalDefense = (result.defense || 0) + defenseBonus;
    result.armorClass = this.formulaCalculator.calculateArmorClass(result.dexterity, totalDefense);
    
    result.damageReduction = this.formulaCalculator.calculateDamageReduction(armorBonus);
    result.armorValue = armorBonus;
    
    result.physicalAttackMod = this.formulaCalculator.calculateAttackMod(result.strength, 'physical');
    result.rangedAttackMod = this.formulaCalculator.calculateAttackMod(result.dexterity, 'ranged');
    result.magicAttackMod = this.formulaCalculator.calculateAttackMod(result.intelligence, 'magic');
    
    // === РЕСУРСЫ ===
    result.maxHealth = this.formulaCalculator.calculateMaxHealth(result.baseHealth, result.constitution, healthBonus);
    result.healthPerLevel = this.formulaCalculator.calculateHealthPerLevel(result.constitution);
    result.healthBonus = healthBonus;
    result.healthRegen = this.formulaCalculator.calculateHealthRegen();

    result.maxMana = this.formulaCalculator.calculateMaxMana(result.baseMana, result.intelligence, result.wisdom, manaBonus);
    result.manaPerLevel = 3;
    result.manaRegen = this.formulaCalculator.calculateManaRegen(result.wisdom);
    
    result.spellPower = this.formulaCalculator.calculateSpellPower(result.wisdom);
    
    result.magicArmorClass = this.formulaCalculator.calculateMagicArmorClass(result.intelligence);
    
    result.maxStamina = this.formulaCalculator.calculateMaxStamina(result.baseStamina, result.dexterityMod, maxStaminaBonus);
    result.staminaRegen = this.formulaCalculator.calculateStaminaRegen(result.dexterity);
    
    // === ДОПОЛНИТЕЛЬНЫЕ ХАРАКТЕРИСТИКИ ===
    result.luckBonus = this.formulaCalculator.calculateLuckBonus(result.charisma);
    result.initiative = result.dexterity;
    result.carryCapacity = this.formulaCalculator.calculateCarryCapacity(result.strengthMod, result.dexterityMod);
    
    // === СОПРОТИВЛЕНИЯ ===
    result.poisonResistance = this.formulaCalculator.calculateResistance(result.constitutionMod);
    result.diseaseResistance = this.formulaCalculator.calculateResistance(result.constitutionMod);
    result.spellResistance = this.formulaCalculator.calculateResistance(result.wisdomMod);
    result.mentalResistance = this.formulaCalculator.calculateResistance(result.wisdomMod, result.charismaMod * 5);
    
    // === СОЦИАЛЬНЫЕ ===
    result.charmChance = this.formulaCalculator.calculateCharmChance(result.charismaMod);
    result.persuasionDC = this.formulaCalculator.calculatePersuasionDC(result.charisma);
    
    // === ДЛЯ СОВМЕСТИМОСТИ ===
    result.attack = result.physicalAttackMod;
    
    this.applyMinimumValues(result);
    
    return result;
  }

  applyMinimumValues(result) {
    const attributes = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    attributes.forEach(attr => {
      if (result[attr] !== undefined && result[attr] < 1) result[attr] = 1;
    });
    
    if (result.health !== undefined && result.health < 0) result.health = 0;
    if (result.maxHealth !== undefined && result.maxHealth < 1) result.maxHealth = 1;
    if (result.mana !== undefined && result.mana < 0) result.mana = 0;
    if (result.maxMana !== undefined && result.maxMana < 0) result.maxMana = 0;
    if (result.stamina !== undefined && result.stamina < 0) result.stamina = 0;
    if (result.maxStamina !== undefined && result.maxStamina < 0) result.maxStamina = 0;
    
    if (result.armorClass !== undefined && result.armorClass < 0) result.armorClass = 0;
    if (result.physicalAttackMod !== undefined && result.physicalAttackMod < 0) result.physicalAttackMod = 0;
    
    if (result.armorValue !== undefined && result.armorValue < 0) result.armorValue = 0;
    if (result.damageReduction !== undefined) {
      result.damageReduction = Math.max(0, Math.min(result.damageReduction, 90));
    }
    
    const resistances = ['poisonResistance', 'diseaseResistance', 'spellResistance', 'mentalResistance'];
    resistances.forEach(res => {
      if (result[res] !== undefined) {
        result[res] = Math.max(0, Math.min(result[res], 90));
      }
    });
  }

  // === ГЕТТЕРЫ ===
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

  // === УПРАВЛЕНИЕ РЕСУРСАМИ ===
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

  // === ДЛЯ UI ===
  getStatsForUI() {
    const stats = this.getFinalStats();
    
    return {
      attributes: {
        strength: stats.strength,
        dexterity: stats.dexterity,
        constitution: stats.constitution,
        intelligence: stats.intelligence,
        wisdom: stats.wisdom,
        charisma: stats.charisma
      },
      
      modifiers: {
        strength: stats.strengthMod,
        dexterity: stats.dexterityMod,
        constitution: stats.constitutionMod,
        intelligence: stats.intelligenceMod,
        wisdom: stats.wisdomMod,
        charisma: stats.charismaMod
      },
      
      resources: {
        health: this.getResource('health'),
        maxHealth: stats.maxHealth,
        healthBonus: stats.healthBonus || 0,
        mana: this.getResource('mana'),
        maxMana: stats.maxMana,
        stamina: this.getResource('stamina'),
        maxStamina: stats.maxStamina,
        healthPerLevel: stats.healthPerLevel,
        manaPerLevel: stats.manaPerLevel,
        manaRegen: stats.manaRegen,
        staminaRegen: stats.staminaRegen
      },
      
      combat: {
        armorClass: stats.armorClass,
        armorValue: stats.armorValue || 0,
        damageReduction: stats.damageReduction || 0,
        magicArmorClass: stats.magicArmorClass,
        physicalAttackMod: stats.physicalAttackMod,
        rangedAttackMod: stats.rangedAttackMod,
        magicAttackMod: stats.magicAttackMod,
        initiative: stats.initiative,
        spellPower: stats.spellPower
      },
      
      resistances: {
        poisonResistance: stats.poisonResistance,
        diseaseResistance: stats.diseaseResistance,
        spellResistance: stats.spellResistance,
        mentalResistance: stats.mentalResistance
      },
      
      utility: {
        carryCapacity: stats.carryCapacity,
        luckBonus: stats.luckBonus,
        charmChance: stats.charmChance,
        persuasionDC: stats.persuasionDC
      },
      
      player: {
        health: this.getResource('health'),
        maxHealth: stats.maxHealth,
        attack: stats.attack,
        defense: stats.defense,
        mana: this.getResource('mana'),
        maxMana: stats.maxMana,
        stamina: this.getResource('stamina'),
        maxStamina: stats.maxStamina
      }
    };
  }

  // === СЕРИАЛИЗАЦИЯ ===
  toJSON() {
    return {
      baseStats: { ...this.baseStats },
      modifiers: this.modifiers.map(m => ({ ...m })),
      currentResources: { ...this.currentResources }
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
        health: this.baseStats.health || 20,
        mana: this.baseStats.mana || 20,
        stamina: this.baseStats.stamina || 25
      };
    }
    
    // Синхронизируем currentResources с новыми максимумами
    if (data.baseStats) {
      const finalStats = this.calculateFinalStats();
      
      const maxHealth = finalStats.maxHealth || 0;
      if (this.currentResources.health > maxHealth) {
        this.currentResources.health = maxHealth;
      }
      
      const maxMana = finalStats.maxMana || 0;
      if (this.currentResources.mana > maxMana) {
        this.currentResources.mana = maxMana;
      }
      
      const maxStamina = finalStats.maxStamina || 0;
      if (this.currentResources.stamina > maxStamina) {
        this.currentResources.stamina = maxStamina;
      }
    }
    
    this.needsRecalculation = true;
    this.finalStats = this.calculateFinalStats();
  }
  
  // === НОВЫЕ МЕТОДЫ ===
  
  /**
   * Установить пресет характеристик
   * @param {string} presetName - имя пресета
   * @param {Object} presetData - данные пресета
   */
  applyStatPreset(presetData) {
    if (!presetData || !presetData.baseStats) {
      console.error('StatManager: некорректные данные пресета');
      return false;
    }
    
    this.baseStats = { 
      ...this.baseStats,
      ...presetData.baseStats
    };
    
    // Применяем бонусы ресурсов
    if (presetData.resourceBonuses) {
      const bonuses = presetData.resourceBonuses;
      if (bonuses.health) this.baseStats.health = (this.baseStats.health || 20) + bonuses.health;
      if (bonuses.mana) this.baseStats.mana = (this.baseStats.mana || 20) + bonuses.mana;
      if (bonuses.stamina) this.baseStats.stamina = (this.baseStats.stamina || 25) + bonuses.stamina;
    }
    
    this.needsRecalculation = true;
    this.finalStats = this.calculateFinalStats();
    return true;
  }
  
  /**
   * Вычислить формулу с текущими характеристиками
   * @param {string} formula - строка формулы
   * @returns {number} результат
   */
  evaluateFormula(formula) {
    const stats = this.getFinalStats();
    return this.formulaParser.evaluate(formula, stats);
  }
  
  /**
   * Получить FormulaCalculator для внешнего использования
   */
  getFormulaCalculator() {
    return this.formulaCalculator;
  }
  
  /**
   * Получить FormulaParser для внешнего использования
   */
  getFormulaParser() {
    return this.formulaParser;
  }
}

export { StatManager }; 
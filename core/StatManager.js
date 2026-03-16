// core/StatManager.js
import { FormulaCalculator } from '../system/FormulaCalculator.js';
import { FormulaParser } from '../system/FormulaParser.js';

class StatManager {
  constructor(baseStats = {}, formulaCalculator = null, formulaParser = null) {
    this.baseStats = {
      // Основные атрибуты
      strength: baseStats.strength || 15,
      dexterity: baseStats.dexterity || 15,
      constitution: baseStats.constitution || 14,
      intelligence: baseStats.intelligence || 11,
      wisdom: baseStats.wisdom || 11,
      charisma: baseStats.charisma || 12,
      
      // Базовые ресурсы (используются в формулах)
      baseHealth: baseStats.baseHealth || 20,
      baseMana: baseStats.baseMana || 20,
      baseStamina: baseStats.baseStamina || 25,
      
      // Регенерация (по умолчанию 0, можно задать в JSON)
      healthRegen: baseStats.healthRegen || 0,
      manaRegen: baseStats.manaRegen || 0,
      staminaRegen: baseStats.staminaRegen || 0,
      
      // Броня и защита (базовые значения)
      armor: baseStats.armor || 0,
      defense: baseStats.defense || 0,
      
      // Для обратной совместимости (могут быть перезаписаны формулами)
      health: baseStats.health || 20,
      mana: baseStats.mana || 20,
      stamina: baseStats.stamina || 25,
      attack: baseStats.attack || 0,
      armorClass: baseStats.armorClass || 0
    };

    this.currentResources = {
        health: baseStats.baseHealth || this.baseStats.baseHealth || 20,
        mana: baseStats.maxMana || this.baseStats.maxMana || 0,
        stamina: baseStats.maxStamina || this.baseStats.maxStamina || 25
    };

    this.modifiers = [];
    this.needsRecalculation = false;
    
    this.formulaCalculator = formulaCalculator || new FormulaCalculator();
    this.formulaParser = formulaParser || new FormulaParser();
    
    this.finalStats = this.calculateFinalStats();
  }
  /**
   * Получить уровень игрока
   * @returns {number}
   */
  getPlayerLevel() {
      if (this.gameState?.getPlayer) {
          return this.gameState.getPlayer().level || 1;
      }
      return 1;
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
      // 1. Начинаем с базовых статов
      const result = { ...this.baseStats };
      
      // 2. Сохраняем все значения из модификаторов во временный объект
      //    Это нужно чтобы не потерять бонусы от предметов при перезаписи
      const modifierValues = {};
      for (const modifier of this.modifiers) {
          for (const [statKey, value] of Object.entries(modifier.stats)) {
              if (modifierValues[statKey] === undefined) modifierValues[statKey] = 0;
              modifierValues[statKey] += value;
          }
      }
      
      // 3. Применяем все модификаторы к result (для непротиворечивости)
      for (const [statKey, value] of Object.entries(modifierValues)) {
          if (result[statKey] === undefined) result[statKey] = 0;
          result[statKey] += value;
      }

      // 4. Суммируем специальные бонусы (для обратной совместимости)
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

      // 5. Модификаторы характеристик (зависят только от базовых значений)
      result.strengthMod = this.formulaCalculator.calculateModifier(result.strength);
      result.dexterityMod = this.formulaCalculator.calculateModifier(result.dexterity);
      result.constitutionMod = this.formulaCalculator.calculateModifier(result.constitution);
      result.intelligenceMod = this.formulaCalculator.calculateModifier(result.intelligence);
      result.wisdomMod = this.formulaCalculator.calculateModifier(result.wisdom);
      result.charismaMod = this.formulaCalculator.calculateModifier(result.charisma);

      // 6. БОЕВЫЕ ХАРАКТЕРИСТИКИ
      // hitroll: базовый + бонусы
      const baseHitroll = this.formulaCalculator.calculateHitroll(result.strength);
      result.hitroll = baseHitroll + (modifierValues.hitroll || 0);
      
      // damroll: базовый + бонусы
      const baseDamroll = this.formulaCalculator.calculateDamroll(result.strength);
      result.damroll = baseDamroll + (modifierValues.damroll || 0);
      
      // Класс защиты
      const totalDefense = (result.defense || 0) + defenseBonus;
      result.armorClass = this.formulaCalculator.calculateArmorClass(result.dexterity, totalDefense);
      
      // Поглощение урона
      result.damageReduction = this.formulaCalculator.calculateDamageReduction(armorBonus);
      result.armorValue = armorBonus;

      // 7. РЕСУРСЫ (максимумы)
      result.maxHealth = this.formulaCalculator.calculateMaxHealth(result.baseHealth, result.constitution, healthBonus);
      result.maxMana = this.formulaCalculator.calculateMaxMana(result.baseMana, result.intelligence, result.wisdom, manaBonus);
      result.maxStamina = this.formulaCalculator.calculateMaxStamina(result.baseStamina, result.dexterity, maxStaminaBonus);
      
      // Сохраняем бонусы для отладки
      result.healthBonus = healthBonus;

      // 8. РЕГЕНЕРАЦИЯ (базовая + бонусы)
      const playerLevel = this.getPlayerLevel ? this.getPlayerLevel() : 1;
      
      const baseHealthRegen = this.baseStats.healthRegen || this.formulaCalculator.calculateHealthRegen(result.constitution, playerLevel);
      result.healthRegen = baseHealthRegen + (modifierValues.healthRegen || 0);
      
      const baseManaRegen = this.baseStats.manaRegen || this.formulaCalculator.calculateManaRegen(result.wisdom, playerLevel);
      result.manaRegen = baseManaRegen + (modifierValues.manaRegen || 0);
      
      const baseStaminaRegen = this.baseStats.staminaRegen || this.formulaCalculator.calculateStaminaRegen(result.dexterity, playerLevel);
      result.staminaRegen = baseStaminaRegen + (modifierValues.staminaRegen || 0);

      // 9. ПРИРОСТ ЗА УРОВЕНЬ
      result.healthPerLevel = this.formulaCalculator.calculateHealthPerLevel(result.constitution);
      result.manaPerLevel = this.formulaCalculator.calculateManaPerLevel(result.wisdom);
      result.staminaPerLevel = this.formulaCalculator.calculateStaminaPerLevel(result.dexterity);

      // 10. МАГИЯ
      const baseSpellPower = this.formulaCalculator.calculateSpellPower(result.wisdom);
      result.spellPower = baseSpellPower + (modifierValues.spellPower || 0);
      
      result.magicArmorClass = this.formulaCalculator.calculateMagicArmorClass(result.intelligence);

      // 11. ДОПОЛНИТЕЛЬНЫЕ ХАРАКТЕРИСТИКИ
      const baseLuckBonus = this.formulaCalculator.calculateLuckBonus(result.charisma);
      result.luckBonus = baseLuckBonus + (modifierValues.luckBonus || 0);
      
      result.initiative = result.dexterity + (modifierValues.initiative || 0);
      
      const baseCarryCapacity = this.formulaCalculator.calculateCarryCapacity(result.strengthMod, result.dexterityMod);
      result.carryCapacity = baseCarryCapacity + (modifierValues.carryCapacity || 0);

      // 12. СОПРОТИВЛЕНИЯ
      const basePoisonResistance = this.formulaCalculator.calculateResistance(result.constitutionMod);
      result.poisonResistance = basePoisonResistance + (modifierValues.poisonResistance || 0);
      
      const baseDiseaseResistance = this.formulaCalculator.calculateResistance(result.constitutionMod);
      result.diseaseResistance = baseDiseaseResistance + (modifierValues.diseaseResistance || 0);
      
      const baseSpellResistance = this.formulaCalculator.calculateResistance(result.wisdomMod);
      result.spellResistance = baseSpellResistance + (modifierValues.spellResistance || 0);
      
      const baseMentalResistance = this.formulaCalculator.calculateResistance(result.wisdomMod, result.charismaMod * 5);
      result.mentalResistance = baseMentalResistance + (modifierValues.mentalResistance || 0);
      
      const baseCritResistance = this.formulaCalculator.calculateCritResistance(result.constitution);
      result.critResistance = baseCritResistance + (modifierValues.critResistance || 0);

      // 13. СОЦИАЛЬНЫЕ
      const baseCharmChance = this.formulaCalculator.calculateCharmChance(result.charismaMod);
      result.charmChance = baseCharmChance + (modifierValues.charmChance || 0);
      
      const basePersuasionDC = this.formulaCalculator.calculatePersuasionDC(result.charisma);
      result.persuasionDC = basePersuasionDC + (modifierValues.persuasionDC || 0);

      // 14. АТАКА (производное от hitroll)
      result.attack = result.hitroll || 0;

      // 15. ПОЛЯ-ЗАГЛУШКИ (для будущего, пока = 0)
      // Спасброски
      result.will = 0;
      result.healthSave = 0;
      result.fortitude = 0;
      result.reflex = 0;
      
      // Магические сопротивления
      result.fireResist = 0;
      result.waterResist = 0;
      result.earthResist = 0;
      result.airResist = 0;
      result.darkResist = 0;
      result.mindResist = 0;
      
      // Тяжёлые раны
      result.heavyWounds = 0;

      // 16. Минимальные значения
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
          // Защита (влияет на AC)
          defense: stats.defense || 0,
          
          // Броня (влияет на поглощение)
          armorValue: stats.armorValue || 0,
          damageReduction: stats.damageReduction || 0,
          
          // Результирующие показатели
          armorClass: stats.armorClass,
          magicArmorClass: stats.magicArmorClass,
          magicAttack: stats.magicAttack || 0,
          initiative: stats.initiative,
          spellPower: stats.spellPower,
          
          // Бонусы атаки
          hitroll: stats.hitroll || 0,
          damroll: stats.damroll || 0
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
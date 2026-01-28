/**
 * StatManager - система управления модификаторами характеристик
 * Расширенная версия с поддержкой 27 характеристик
 */
class StatManager {
  /**
   * @param {Object} baseStats - Базовые характеристики (без модификаторов)
   * @param {number} baseStats.health - Базовое здоровье
   * @param {number} baseStats.maxHealth - Базовое максимальное здоровье
   * @param {number} baseStats.attack - Базовая атака
   * @param {number} baseStats.defense - Базовая защита
   */
  constructor(baseStats = {}) {
    // Базовые характеристики (старые + новые)
    this.baseStats = {
      // Старые характеристики (для обратной совместимости)
      health: baseStats.health || 100,
      maxHealth: baseStats.maxHealth || 100,
      attack: baseStats.attack || 15,
      defense: baseStats.defense || 5,
      
      // БЛОК А: АТРИБУТЫ (6)
      strength: baseStats.strength || 10,      // Сила
      agility: baseStats.agility || 10,       // Ловкость
      constitution: baseStats.constitution || 10, // Телосложение
      wisdom: baseStats.wisdom || 10,         // Мудрость
      intelligence: baseStats.intelligence || 10, // Интеллект
      charisma: baseStats.charisma || 10,     // Обаяние
      
      // БЛОК Б: БОЕВЫЕ (8) - будут расчитываться из атрибутов
      // attack уже есть выше
      // defense уже есть выше
      initiative: 0,          // Инициатива
      hitChance: 0,           // Попадание
      critChance: 0,          // Крит шанс
      critPower: 0,           // Сила крита
      dodge: 0,               // Уворот
      blockChance: 0,         // Блок
      
      // БЛОК В: РЕСУРСЫ (6)
      // health, maxHealth уже есть выше
      mana: 0,                // Мана
      maxMana: 0,             // Макс. мана
      stamina: 0,             // Выносливость
      maxStamina: 0,          // Макс. выносливость
      healthRegen: 0,         // Восстановление здоровья
      manaRegen: 0,           // Восстановление маны
      staminaRegen: 0,        // Восстановление выносливости
      
      // БЛОК Г: СОПРОТИВЛЕНИЯ (7)
      fireResistance: 0,      // Огонь
      waterResistance: 0,     // Вода
      earthResistance: 0,     // Земля
      airResistance: 0,       // Воздух
      darkResistance: 0,      // Тьма
      poisonResistance: 0,    // Яды
      physicalResistance: 0   // Физические приёмы
    };
    
    // Массив активных модификаторов
    this.modifiers = []; // { source: string, stats: Object }
    
    // Финальные характеристики (база + модификаторы + формулы)
    this.finalStats = this.calculateFinalStats();
    
    // Флаги для отслеживания необходимости пересчёта
    this.needsRecalculation = false;
  }

  /**
   * Добавить или обновить модификатор
   * @param {string} source - Уникальный идентификатор источника
   * @param {Object} stats - Объект с изменяемыми характеристиками
   * @returns {boolean} true если добавлен новый модификатор
   */
  addModifier(source, stats) {
    if (!source || typeof source !== 'string') {
      console.error('StatManager: source должен быть непустой строкой');
      return false;
    }
  
    // Копируем и обрабатываем статы
    const processedStats = { ...stats };
    
    // Совместимость со старым кодом: health -> maxHealth
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

  /**
   * Удалить модификатор по источнику
   * @param {string} source - Идентификатор источника для удаления
   * @returns {boolean} true если модификатор был удален
   */
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

  /**
   * Рассчитать финальные характеристики с учётом формул зависимостей
   * @private
   */
  calculateFinalStats() {
    // 1. Начинаем с копии базовых характеристик
    const result = { ...this.baseStats };

    // 2. Суммируем все модификаторы
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

    // 3. РАСЧЁТ ФОРМУЛ ЗАВИСИМОСТЕЙ (новое)
    this.calculateDerivedStats(result);

    // 4. Гарантируем минимальные значения
    this.applyMinimumValues(result);

    return result;
  }

  /**
   * Расчёт зависимых характеристик (формулы)
   * @private
   */
  calculateDerivedStats(result) {
    // БЛОК А → БЛОК Б: Боевые характеристики из атрибутов
    result.attack = (result.attack || 0) + Math.floor(result.strength * 1.5); // Сила влияет на атаку
    result.defense = (result.defense || 0) + Math.floor(result.constitution * 0.5); // Телосложение влияет на защиту
    
    result.hitChance = 75 + Math.floor(result.agility * 1.2); // Ловкость → попадание
    result.critChance = 5 + Math.floor(result.agility * 0.8); // Ловкость → крит шанс
    result.critPower = 150 + Math.floor(result.strength * 3); // Сила → сила крита
    result.dodge = Math.floor(result.agility * 1.5); // Ловкость → уворот
    result.initiative = 10 + Math.floor(result.agility * 2); // Ловкость → инициатива
    
    // Блок: каждые 100 защиты +5% шанса блока
    result.blockChance = Math.min(50, Math.floor((result.defense || 0) / 2));
    
    // БЛОК А → БЛОК В: Ресурсы из атрибутов
    result.maxHealth = (result.maxHealth || 0) + Math.floor(result.constitution * 15);
    result.maxMana = Math.floor(result.wisdom * 12 + result.intelligence * 8);
    result.maxStamina = Math.floor(result.agility * 10 + result.constitution * 8);
    
    result.healthRegen = Math.floor(result.constitution * 0.5);
    result.manaRegen = Math.floor(result.wisdom * 0.8);
    result.staminaRegen = Math.floor(result.agility * 1.2);
    
    // Инициализируем текущие ресурсы если они нулевые
    if (result.health === undefined || result.health <= 0) {
      result.health = result.maxHealth;
    }
    if (result.mana === undefined || result.mana <= 0) {
      result.mana = result.maxMana;
    }
    if (result.stamina === undefined || result.stamina <= 0) {
      result.stamina = result.maxStamina;
    }
    
    // Гарантируем что текущие ресурсы не превышают максимум
    result.health = Math.min(result.health, result.maxHealth);
    result.mana = Math.min(result.mana, result.maxMana);
    result.stamina = Math.min(result.stamina, result.maxStamina);
  }

  /**
   * Применить минимальные значения для характеристик
   * @private
   */
  applyMinimumValues(result) {
    // Ресурсы
    if (result.health !== undefined && result.health < 0) result.health = 0;
    if (result.maxHealth !== undefined && result.maxHealth < 1) result.maxHealth = 1;
    if (result.mana !== undefined && result.mana < 0) result.mana = 0;
    if (result.maxMana !== undefined && result.maxMana < 0) result.maxMana = 0;
    if (result.stamina !== undefined && result.stamina < 0) result.stamina = 0;
    if (result.maxStamina !== undefined && result.maxStamina < 0) result.maxStamina = 0;
    
    // Боевые
    if (result.attack !== undefined && result.attack < 0) result.attack = 0;
    if (result.defense !== undefined && result.defense < 0) result.defense = 0;
    if (result.hitChance !== undefined) result.hitChance = Math.max(1, Math.min(result.hitChance, 95));
    if (result.critChance !== undefined) result.critChance = Math.max(0, Math.min(result.critChance, 50));
    if (result.critPower !== undefined && result.critPower < 100) result.critPower = 100;
    if (result.dodge !== undefined) result.dodge = Math.max(0, Math.min(result.dodge, 80));
    if (result.blockChance !== undefined) result.blockChance = Math.max(0, Math.min(result.blockChance, 90));
    if (result.initiative !== undefined && result.initiative < 0) result.initiative = 0;
    
    // Атрибуты
    const attributes = ['strength', 'agility', 'constitution', 'wisdom', 'intelligence', 'charisma'];
    attributes.forEach(attr => {
      if (result[attr] !== undefined && result[attr] < 1) result[attr] = 1;
    });
    
    // Сопротивления
    const resistances = ['fireResistance', 'waterResistance', 'earthResistance', 
                         'airResistance', 'darkResistance', 'poisonResistance', 'physicalResistance'];
    resistances.forEach(res => {
      if (result[res] !== undefined) {
        result[res] = Math.max(-100, Math.min(result[res], 100)); // От -100% до +100%
      }
    });
  }

  /**
   * Обновить базовые характеристики (при повышении уровня)
   * @param {Object} newBaseStats - Новые базовые характеристики
   */
  setBaseStats(newBaseStats) {
    // Сохраняем совместимость со старым кодом
    this.baseStats = { 
      ...this.baseStats,
      ...newBaseStats 
    };
    this.needsRecalculation = true;
    this.finalStats = this.calculateFinalStats();
  }

  /**
   * Получить копию финальных характеристик
   * @returns {Object} Финальные характеристики
   */
  getFinalStats() {
    if (this.needsRecalculation) {
      this.finalStats = this.calculateFinalStats();
      this.needsRecalculation = false;
    }
    return { ...this.finalStats };
  }

  /**
   * Получить копию базовых характеристик
   * @returns {Object} Базовые характеристики
   */
  getBaseStats() {
    return { ...this.baseStats };
  }

  /**
   * Получить список активных модификаторов
   * @returns {Array} Копия массива модификаторов
   */
  getModifiers() {
    return this.modifiers.map(m => ({ ...m }));
  }

  /**
   * Проверить наличие модификатора от источника
   * @param {string} source - Идентификатор источника
   * @returns {boolean}
   */
  hasModifier(source) {
    return this.modifiers.some(m => m.source === source);
  }

  /**
   * Очистить все модификаторы
   * @returns {number} Количество удаленных модификаторов
   */
  clearAllModifiers() {
    const count = this.modifiers.length;
    this.modifiers = [];
    this.needsRecalculation = true;
    this.finalStats = this.calculateFinalStats();
    return count;
  }
  
  /**
   * НОВЫЙ МЕТОД: Получить характеристики для отображения в UI
   * @returns {Object} Сгруппированные характеристики
   */
  getStatsForUI() {
    const stats = this.getFinalStats();
    return {
      // Для обратной совместимости
      player: {
        health: stats.health,
        maxHealth: stats.maxHealth,
        attack: stats.attack,
        defense: stats.defense
      },
      // Блоки характеристик
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
        health: stats.health,
        maxHealth: stats.maxHealth,
        mana: stats.mana,
        maxMana: stats.maxMana,
        stamina: stats.stamina,
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
}

export { StatManager };

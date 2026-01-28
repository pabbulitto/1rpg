/**
 * StatManager - система управления модификаторами характеристик
 * Позволяет добавлять/удалять бонусы от экипировки, заклинаний, эффектов
 * и автоматически пересчитывает финальные характеристики
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
    // Копируем базовые характеристики
    this.baseStats = { ...baseStats };
    
    // Массив активных модификаторов
    this.modifiers = []; // { source: string, stats: Object }
    
    // Финальные характеристики (база + модификаторы)
    this.finalStats = this.calculateFinalStats();
  }

  /**
   * Добавить или обновить модификатор
   * @param {string} source - Уникальный идентификатор источника (напр. 'equipment_head', 'spell_fire')
   * @param {Object} stats - Объект с изменяемыми характеристиками { health: +10, attack: +5 }
   * @returns {boolean} true если добавлен новый модификатор, false если обновлен существующий
   */
  addModifier(source, stats) {
    if (!source || typeof source !== 'string') {
      console.error('StatManager: source должен быть непустой строкой');
      return false;
    }
  
    // Копируем и обрабатываем статы
    const processedStats = { ...stats };
    
      if (processedStats.health !== undefined) {
      // Если уже есть maxHealth, добавляем к нему
      processedStats.maxHealth = (processedStats.maxHealth || 0) + processedStats.health;
      delete processedStats.health; // Удаляем старый ключ
    }
  
    const existingIndex = this.modifiers.findIndex(m => m.source === source);
    
    if (existingIndex >= 0) {
      this.modifiers[existingIndex].stats = { ...processedStats };
      this.finalStats = this.calculateFinalStats();
      return false;
    } else {
      this.modifiers.push({
        source,
        stats: { ...processedStats }
      });
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
      this.finalStats = this.calculateFinalStats();
      return true;
    }
    return false;
  }

  /**
   * Удалить все модификаторы определенного типа (по префиксу)
   * @param {string} prefix - Префикс источника (напр. 'equipment_' для удаления всей экипировки)
   * @returns {number} Количество удаленных модификаторов
   */
  removeModifiersByPrefix(prefix) {
    const initialLength = this.modifiers.length;
    this.modifiers = this.modifiers.filter(m => !m.source.startsWith(prefix));
    
    const removedCount = initialLength - this.modifiers.length;
    if (removedCount > 0) {
      this.finalStats = this.calculateFinalStats();
    }
    return removedCount;
  }

  /**
   * Рассчитать финальные характеристики
   * @private
   */
  calculateFinalStats() {
    // Начинаем с копии базовых характеристик
    const result = { ...this.baseStats };

    // Суммируем все модификаторы
    for (const modifier of this.modifiers) {
      for (const [statKey, value] of Object.entries(modifier.stats)) {
        // Если характеристики еще нет в результате - инициализируем нулем
        if (result[statKey] === undefined) {
          result[statKey] = 0;
        }
        
        // Добавляем значение модификатора
        if (typeof value === 'number') {
          result[statKey] += value;
        } else {
          console.warn(`StatManager: некорректное значение для ${statKey}:`, value);
        }
      }
    }

    // Гарантируем минимальные значения
    if (result.health !== undefined && result.health < 0) result.health = 0;
    if (result.maxHealth !== undefined && result.maxHealth < 1) result.maxHealth = 1;
    if (result.attack !== undefined && result.attack < 0) result.attack = 0;
    if (result.defense !== undefined && result.defense < 0) result.defense = 0;

    return result;
  }

  /**
   * Обновить базовые характеристики (при повышении уровня)
   * @param {Object} newBaseStats - Новые базовые характеристики
   */
  setBaseStats(newBaseStats) {
    this.baseStats = { ...newBaseStats };
    this.finalStats = this.calculateFinalStats();
  }

  /**
   * Получить копию финальных характеристик
   * @returns {Object} Финальные характеристики
   */
  getFinalStats() {
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
   * Получить список активных модификаторов (для отладки/UI)
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
   * Очистить все модификаторы (например, при смерти игрока)
   * @returns {number} Количество удаленных модификаторов
   */
  clearAllModifiers() {
    const count = this.modifiers.length;
    this.modifiers = [];
    this.finalStats = this.calculateFinalStats();
    return count;
  }
}

export { StatManager };
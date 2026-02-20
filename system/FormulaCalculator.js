// system/FormulaCalculator.js - обновлённый
/**
 * FormulaCalculator - вынесенные формулы расчета характеристик из StatManager
 * Отвечает ТОЛЬКО за вычисления, не содержит состояния
 */
class FormulaCalculator {
    constructor() {
        this.cache = new Map();
    }
    
    /**
     * Рассчитать модификатор характеристики по D&D правилу
     * @param {number} statValue - значение характеристики (сила, ловкость и т.д.)
     * @returns {number} модификатор
     */
    calculateModifier(statValue) {
        return Math.floor((statValue - 10) / 2);
    }
    
    /**
     * Броня класса (Armor Class)
     * @param {number} dexterity - ловкость
     * @param {number} totalDefense - общая защита
     * @returns {number} AC
     */
    calculateArmorClass(dexterity, totalDefense) {
        const armorBonusAC = Math.floor(totalDefense / 15);
        return Math.floor((dexterity - 18) / 2) + armorBonusAC;
    }
    
    /**
     * Снижение урона от брони
     * @param {number} totalArmor - общая броня
     * @returns {number} процент снижения урона
     */
    calculateDamageReduction(totalArmor) {
        return Math.floor(totalArmor / 3); // 3 брони = 1%
    }
    
    /**
     * Максимальное здоровье
     * @param {number} baseHealth - базовое здоровье (из пресета класса)
     * @param {number} constitution - телосложение
     * @param {number} healthBonus - бонус здоровья
     * @returns {number} максимальное здоровье
     */
    calculateMaxHealth(baseHealth, constitution, healthBonus = 0) {
        return baseHealth + (constitution - 10) + healthBonus;
    }
    //Регенерация здоровья за тик    
    calculateHealthRegen() {
        return 5; // Фиксированное значение для баланса
    }
    /**
     * Прирост здоровья за уровень
     * @param {number} constitution - телосложение
     * @returns {number} HP за уровень
     */
    calculateHealthPerLevel(constitution) {
        return 4 + Math.floor((constitution - 10) / 4);
    }
    
    /**
     * Максимальная мана
     * @param {number} baseMana - базовая мана (из пресета класса)
     * @param {number} intelligence - интеллект
     * @param {number} wisdom - мудрость
     * @param {number} manaBonus - бонус маны
     * @returns {number} максимальная мана
     */
    calculateMaxMana(baseMana, intelligence, wisdom, manaBonus = 0) {
        return baseMana + (intelligence - 10) * 2 + (wisdom - 10) + manaBonus;
    }
    
    /**
     * Регенерация маны
     * @param {number} wisdom - мудрость
     * @returns {number} мана за тик
     */
    calculateManaRegen(wisdom) {
        return 1 + Math.floor((wisdom - 10) / 10);
    }
    
    /**
     * Сила заклинаний (с 23 мудрости)
     * @param {number} wisdom - мудрость
     * @returns {number} множитель силы заклинаний
     */
    calculateSpellPower(wisdom) {
        if (wisdom >= 23) {
            return 1.0 + (wisdom - 22) * 0.05;
        }
        return 1.0;
    }
    
    /**
     * Магическая защита
     * @param {number} intelligence - интеллект
     * @returns {number} магический КЗ
     */
    calculateMagicArmorClass(intelligence) {
        return Math.floor((intelligence - 10) / 4);
    }
    
    /**
     * Модификаторы атаки
     * @param {number} statValue - характеристика (сила/ловкость/интеллект)
     * @param {string} type - тип атаки ('physical'|'ranged'|'magic')
     * @returns {number} модификатор атаки
     */
    calculateAttackMod(statValue, type = 'physical') {
        const baseMod = Math.floor((statValue - 10) / 4) + 3;
        return baseMod;
    }
    
    /**
     * Максимальная выносливость
     * @param {number} baseStamina - базовая выносливость (из пресета класса)
     * @param {number} dexterityMod - модификатор ловкости
     * @param {number} staminaBonus - бонус выносливости
     * @returns {number} максимальная выносливость
     */
    calculateMaxStamina(baseStamina, dexterityMod, staminaBonus = 0) {
        return baseStamina + dexterityMod * 5 + staminaBonus;
    }
    
    /**
     * Регенерация выносливости
     * @param {number} dexterity - ловкость
     * @returns {number} выносливость за тик
     */
    calculateStaminaRegen(dexterity) {
        return 3 + Math.floor((dexterity - 10) / 10);
    }
    
    /**
     * Бонус удачи
     * @param {number} charisma - харизма
     * @returns {number} бонус удачи
     */
    calculateLuckBonus(charisma) {
        return Math.floor((charisma - 10) / 5);
    }
    
    /**
     * Грузоподъемность
     * @param {number} strengthMod - модификатор силы
     * @param {number} dexterityMod - модификатор ловкости
     * @returns {number} грузоподъемность
     */
    calculateCarryCapacity(strengthMod, dexterityMod) {
        return 10 + strengthMod * 5 + dexterityMod * 2;
    }
    
    /**
     * Сопротивления (%)
     * @param {number} statMod - модификатор характеристики
     * @param {number} additionalMod - дополнительный модификатор (опционально)
     * @returns {number} сопротивление (0-90%)
     */
    calculateResistance(statMod, additionalMod = 0) {
        const rawValue = statMod * 10 + additionalMod;
        return Math.max(0, Math.min(rawValue, 90));
    }
    
    /**
     * Шанс чар
     * @param {number} charismaMod - модификатор харизмы
     * @returns {number} шанс чар (0-50%)
     */
    calculateCharmChance(charismaMod) {
        const rawChance = charismaMod * 5;
        return Math.max(0, Math.min(rawChance, 50));
    }
    
    /**
     * Сложность уговора (Persuasion DC)
     * @param {number} charisma - харизма
     * @returns {number} DC
     */
    calculatePersuasionDC(charisma) {
        return 10 + Math.floor((charisma - 10) / 2);
    }
    
    /**
     * Очистить кэш
     */
    clearCache() {
        this.cache.clear();
    }
    
    /**
     * Получить ключ для кэша
     */
    _getCacheKey(methodName, ...args) {
        return `${methodName}_${args.join('_')}`;
    }
}

export { FormulaCalculator };
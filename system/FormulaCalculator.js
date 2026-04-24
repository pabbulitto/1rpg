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
        const armorBonusAC = Math.floor(totalDefense / 16);
        return Math.floor((dexterity - 18) / 2) + armorBonusAC;
    }
    
    /**
     * Снижение урона от брони
     * @param {number} totalArmor - общая броня
     * @returns {number} процент снижения урона
     */
    calculateDamageReduction(totalArmor) {
        return Math.floor(totalArmor / 4); // 4 брони = 1%
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
    calculateHealthRegen(constitution, playerLevel) {
        const baseRegen = 4;
        const conBonus = Math.max(0, Math.floor((constitution - 14) / 2));
        const levelBonus = Math.floor(playerLevel / 5); // +1 за каждые 5 уровней
        
        return baseRegen + conBonus + levelBonus;
    }
    /**
     * Прирост здоровья за уровень
     * @param {number} constitution - телосложение
     * @returns {number} HP за уровень
     */
    calculateHealthPerLevel(constitution, playerLevel) {
        const baseGain = 5;
        
        if (constitution <= 14) return baseGain;
        
        const pointsAbove14 = constitution - 14;
        let totalBonus = 0;
        // Для каждого очка выше 14 свой случайный множитель
        for (let i = 0; i < pointsAbove14; i++) {
            const randomMultiplier = 0.8 + (Math.random() * 0.4); // 0.8-1.2
            totalBonus += randomMultiplier;
        }
        
        return baseGain + totalBonus;
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
        const intBonus = Math.max(0, Math.floor((intelligence - 10) / 2));
        const wisBonus = Math.max(0, Math.floor((wisdom - 10) / 2));
        return baseMana + intBonus + wisBonus + manaBonus;
    }
    /**
     * Регенерация маны
     * @param {number} wisdom - мудрость
     * @returns {number} мана за тик
     */
    calculateManaRegen(wisdom, playerLevel) {
        const baseRegen = 4;
        const wisBonus = Math.max(0, Math.floor((wisdom - 14) / 2));
        const levelBonus = Math.floor(playerLevel / 5);
        return baseRegen + wisBonus + levelBonus;
    }
    /**
     * Прирост маны за уровень
    * @param {number} wisdom - мудрость
    * @returns {number} мана за уровень
    */
    calculateManaPerLevel(wisdom) {
        const baseGain = 3;
        
        if (wisdom <= 14) return baseGain;
        
        const pointsAbove14 = wisdom - 14;
        let totalBonus = 0;
        
        for (let i = 0; i < pointsAbove14; i++) {
            const randomMultiplier = 0.8 + (Math.random() * 0.4);
            totalBonus += randomMultiplier;
        }
        
        return baseGain + totalBonus;
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
     * Рассчитать бонус попадания (hitroll) от силы
     * @param {number} strength - значение силы
     * @returns {number} бонус к атаке
     */
    calculateHitroll(strength) {
        if (strength <= 18) return 0;
        const above18 = strength - 18;
        return Math.floor(above18 / 4); // +1 за каждые 4 силы после 18
    }
    /**
     * Рассчитать бонус повреждений (damroll) от силы
     * @param {number} strength - значение силы
     * @returns {number} бонус к урону
     */
    calculateDamroll(strength) {
        if (strength <= 18) return 0;
        const above18 = strength - 18;
        return Math.floor(above18 / 2); // +1 за каждые 2 силы после 18
    }
    /**
     * Максимальная выносливость
     * @param {number} baseStamina - базовая выносливость а)
     * @param {number} dexterityMod - модификатор ловкости
     * @param {number} staminaBonus - бонус выносливости
     * @returns {number} максимальная выносливость
     */
    calculateMaxStamina(baseStamina, dexterity, staminaBonus = 0) {
        return baseStamina + Math.max(0, dexterity - 10) + staminaBonus;
    }
    /**
     * Регенерация выносливости
     * @param {number} dexterity - ловкость
     * @returns {number} выносливость за тик
     */
    calculateStaminaRegen(dexterity, playerLevel) {
        const baseRegen = 4;
        const dexBonus = Math.max(0, Math.floor((dexterity - 14) / 2));
        const levelBonus = Math.floor(playerLevel / 5);
        return baseRegen + dexBonus + levelBonus;
    }
    /**
     * Прирост выносливости за уровень
     * @param {number} dexterity - ловкость
     * @returns {number} выносливость за уровень
     */
    calculateStaminaPerLevel(dexterity) {
        const baseGain = 5;
        
        if (dexterity <= 14) return baseGain;
        
        const pointsAbove14 = dexterity - 14;
        let totalBonus = 0;
        
        for (let i = 0; i < pointsAbove14; i++) {
            const randomMultiplier = 0.8 + (Math.random() * 0.4);
            totalBonus += randomMultiplier;
        }
        
        return baseGain + totalBonus;
    }       
    /**
     * Бонус удачи
     * @param {number} charisma - харизма
     * @returns {number} бонус удачи
     */
    calculateLuckBonus(charisma) {
        return Math.floor((charisma - 10) / 4);
    }
    
    /**
     * Грузоподъемность
     * @param {number} strengthMod - модификатор силы
     * @param {number} dexterityMod - модификатор ловкости
     * @returns {number} грузоподъемность
     */
    calculateCarryCapacity(strengthMod, dexterityMod) {
        return 250 + strengthMod * 5 + dexterityMod * 2;
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
     * Рассчитать сопротивление критическим ударам от телосложения
     * @param {number} constitution - значение телосложения
     * @returns {number} процент снижения урона при критическом ударе (0-50)
     */
    calculateCritResistance(constitution) {
        if (constitution <= 18) return 0;
        
        // Каждое очко после 18 даёт 1% сопротивления
        const above18 = constitution - 18;
        return Math.min(50, above18); // максимум 50%
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
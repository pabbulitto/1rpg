// system/DamageContextBuilder.js
/**
 * DamageContextBuilder - создает контекст для вычисления формул урона
 * Собирает ВСЕ возможные параметры: статы, экипировку, временные модификаторы
 * Изолирует BattleSystem от деталей структуры предметов/игрока
 */
class DamageContextBuilder {
    constructor() {
        // Кэш для производительности
        this.cache = new Map();
    }
    
    /**
     * Создать контекст для игрока
     * @param {CharacterBase} player - игрок или персонаж
     * @param {Object} options - опции контекста
     * @returns {Object} контекст для формулы
     */
    buildForPlayer(player, options = {}) {
        const cacheKey = this._getCacheKey(player.id, options);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // 1. Базовые модификаторы характеристик
        const stats = player.getStats ? player.getStats() : player;
        const context = {
            // Основные статы
            strength: stats.strength || 10,
            dexterity: stats.dexterity || 10,
            constitution: stats.constitution || 10,
            intelligence: stats.intelligence || 10,
            wisdom: stats.wisdom || 10,
            charisma: stats.charisma || 10,
            
            // Модификаторы (рассчитываем по D&D правилу)
            strengthMod: Math.floor(((stats.strength || 10) - 10) / 2),
            dexterityMod: Math.floor(((stats.dexterity || 10) - 10) / 2),
            constitutionMod: Math.floor(((stats.constitution || 10) - 10) / 2),
            intelligenceMod: Math.floor(((stats.intelligence || 10) - 10) / 2),
            wisdomMod: Math.floor(((stats.wisdom || 10) - 10) / 2),
            charismaMod: Math.floor(((stats.charisma || 10) - 10) / 2),
            // Параметры экипировки (всегда присутствуют)
            bootWeight: 0,
            bootMaterial: 'none',
            weaponWeight: 0,
            weaponMaterial: 'none',
            weaponType: 'none',
            offhandWeight: 0,
            offhandType: 'none',
            armorWeight: 0,
            armorType: 'none',
            // Ресурсы (для формул типа "healthPercent")
            health: stats.health || 0,
            maxHealth: stats.maxHealth || 0,
            mana: stats.mana || 0,
            maxMana: stats.maxMana || 0,
            stamina: stats.stamina || 0,
            maxStamina: stats.maxStamina || 0,
            
            // Боевые характеристики
            armorClass: stats.armorClass || 0,
            attack: stats.attack || 0,
            defense: stats.defense || 0,
            damageReduction: stats.damageReduction || 0,
        };
        
        // 2. Параметры из экипировки (если нужно)
        if (options.includeEquipment !== false) {
            this._addEquipmentContext(player, context, options);
        }
        
        // 3. Временные модификаторы (баффы/дебаффы)
        if (options.includeTemporary) {
            this._addTemporaryContext(player, context);
        }
        
        // 4. Целевые параметры (если указана цель)
        if (options.target) {
            this._addTargetContext(options.target, context);
        }
        
        // 5. Дополнительные опции
        if (options.additionalContext) {
            Object.assign(context, options.additionalContext);
        }
        
        // Кэшируем на короткое время
        this.cache.set(cacheKey, context);
        setTimeout(() => this.cache.delete(cacheKey), 100); // 100ms кэш
        
        return context;
    }
    
    /**
     * Добавить параметры из экипировки
     * @private
     */
    _addEquipmentContext(player, context, options) {
        try {
            const equipment = player.equipment;
            if (!equipment) return;
            
            // Обувь (для удара ногой)
            const feetItem = equipment.feet;
            if (feetItem) {
                context.bootWeight = feetItem.bootWeight || 0;
                context.bootMaterial = feetItem.material || 'none';
            }
            
            // Оружие в правой руке
            const rightHand = equipment.right_hand;
            if (rightHand) {
                context.weaponWeight = rightHand.weight || 0;
                context.weaponMaterial = rightHand.material || 'none';
                context.weaponType = rightHand.weaponType || 'none';
            }
            
            // Щит/оружие в левой руке
            const leftHand = equipment.left_hand;
            if (leftHand) {
                context.offhandWeight = leftHand.weight || 0;
                context.offhandType = leftHand.type || 'none';
            }
            
            // Доспехи
            const bodyArmor = equipment.body;
            if (bodyArmor) {
                context.armorWeight = bodyArmor.weight || 0;
                context.armorType = bodyArmor.armorType || 'none';
            }
            
        } catch (error) {
            console.warn('DamageContextBuilder: ошибка получения экипировки', error);
        }
    }
    
    /**
     * Добавить временные модификаторы
     * @private
     */
    _addTemporaryContext(player, context) {
        // В будущем можно добавить баффы из player.activeEffects
        // Пока оставляем заглушку
        context.tempBonus = 0;
        context.tempPenalty = 0;
    }
    
    /**
     * Добавить параметры цели
     * @private
     */
    _addTargetContext(target, context) {
        try {
            const targetStats = target.getStats ? target.getStats() : target;
            context.targetHealth = targetStats.health || 0;
            context.targetMaxHealth = targetStats.maxHealth || 0;
            context.targetArmorClass = targetStats.armorClass || 0;
            
            // Проценты для формул типа "урон зависит от недостающего ХП"
            context.targetHealthPercent = targetStats.maxHealth > 0 ? 
                (targetStats.health / targetStats.maxHealth) * 100 : 0;
        } catch (error) {
            console.warn('DamageContextBuilder: ошибка получения статов цели', error);
        }
    }
    
    /**
     * Создать контекст для конкретной способности
     * @param {CharacterBase} player - исполнитель
     * @param {string} abilityId - ID способности
     * @param {Object} target - цель (опционально)
     * @returns {Object} контекст
     */
    buildForAbility(player, abilityId, target = null) {
        // Получаем данные способности
        const ability = window.game?.abilityService?.getAbility(abilityId);
        if (!ability) {
            console.warn(`DamageContextBuilder: способность ${abilityId} не найдена`);
            return this.buildForPlayer(player, {});
        }
        
        const options = {
            includeEquipment: ability.type !== 'spell', // Заклинания не зависят от экипировки
            includeTemporary: true,
            target: target
        };
        
        return this.buildForPlayer(player, options);
    }
    
    /**
     * Создать мок-контекст для тестирования
     * @param {Object} overrides - переопределения
     * @returns {Object} тестовый контекст
     */
    buildMock(overrides = {}) {
        const baseContext = {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
            strengthMod: 0,
            dexterityMod: 0,
            constitutionMod: 0,
            intelligenceMod: 0,
            wisdomMod: 0,
            charismaMod: 0,
            health: 50,
            maxHealth: 50,
            mana: 20,
            maxMana: 20,
            stamina: 30,
            maxStamina: 30,
            armorClass: 10,
            attack: 0,
            defense: 0,
            damageReduction: 0,
            bootWeight: 0,
            bootMaterial: 'none',
            weaponWeight: 0,
            weaponMaterial: 'none',
            weaponType: 'none'
        };
        
        return { ...baseContext, ...overrides };
    }
    
    /**
     * Очистить кэш
     */
    clearCache() {
        this.cache.clear();
    }
    
    /**
     * Создать ключ для кэша
     * @private
     */
    _getCacheKey(playerId, options) {
        const optionsStr = JSON.stringify(options);
        return `${playerId}_${optionsStr}`;
    }
}

export { DamageContextBuilder };
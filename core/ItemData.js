// core/ItemData.js
import { ItemDataRegistry } from '../data/ItemDataRegistry.js';

/**
 * Чистые данные предмета, без логики.
 * Содержит только поля и базовые геттеры.
 * Не зависит от других сервисов и классов.
 */
class ItemData {
    /**
     * @param {string} itemId - ID предмета из items.json
     * @param {number} count - количество
     * @param {Object} options - дополнительные параметры
     * @param {string} options.instanceId - уникальный ID экземпляра
     * @param {number} options.durability - текущая прочность
     * @param {Array} options.sockets - камни в слотах
     */
    constructor(itemId, count = 1, options = {}) {
        const template = ItemDataRegistry.get(itemId);
        
        // ===== БАЗОВЫЕ ДАННЫЕ =====
        /** @type {string} ID предмета из items.json */
        this.id = itemId;
        
        /** @type {string} Уникальный ID экземпляра */
        this.instanceId = options.instanceId || this._generateId();
        
        /** @type {string} Отображаемое имя */
        this.name = template?.name || 'Неизвестный предмет';
        
        /** @type {string} Тип предмета (weapon, armor, consumable, etc) */
        this.type = template?.type || 'misc';
        
        /** @type {string|null} Слот экипировки */
        this.slot = template?.slot || null;
        
        /** @type {number} Количество в стаке */
        this.count = count;
        
        // ===== ХАРАКТЕРИСТИКИ =====
        /** @type {Object} Бонусы к характеристикам */
        this.stats = template?.stats ? { ...template.stats } : {};
        
        /** @type {number} Цена покупки */
        this.price = template?.price || 1;
        
        /** @type {number} Вес в единицах */
        this.weight = template?.weight || 0;
        
        // ===== СТАКИ =====
        /** @type {boolean} Можно ли стакать */
        this.stackable = template?.stackable || false;
        
        /** @type {number} Максимальный размер стака */
        this.maxStack = template?.maxStack || 99;
        
        // ===== БОЕВЫЕ ПАРАМЕТРЫ =====
        /** @type {string|null} Формула урона */
        this.damage = template?.damage || null;
        
        /** @type {string|null} Тип урона */
        this.damageType = template?.damageType || null;
        
        /** @type {string|null} Тип оружия (sword, bow, etc) */
        this.weaponType = template?.weaponType || null;
        
        /** @type {string|null} Дальность (melee/ranged) */
        this.range = template?.range || null;
        
        /** @type {Array} Свойства оружия (light, heavy, etc) */
        this.properties = template?.properties ? [...template.properties] : [];
        
        /** @type {string|null} Материал */
        this.material = template?.material || null;
        
        // ===== БРОНЯ =====
        /** @type {string|null} Тип брони (light/medium/heavy) */
        this.armorType = template?.armorType || null;
        
        /** @type {boolean} Штраф к скрытности */
        this.stealthDisadvantage = template?.stealthDisadvantage || false;
        
        /** @type {number|null} Максимальный бонус ловкости */
        this.maxDexBonus = template?.maxDexBonus || null;
        
        // ===== ПРОЧНОСТЬ И СРОК ЖИЗНИ =====
        /** @type {number|null} Текущая прочность */
        this.durability = options.durability ?? template?.durability ?? null;
        
        /** @type {number|null} Максимальная прочность */
        this.maxDurability = template?.maxDurability ?? null;
        
        /** @type {number|null} Срок жизни в днях */
        this.lifetimeDays = template?.lifetimeDays ?? null;
        
        // ===== СОКЕТЫ =====
        /** @type {number} Количество сокетов */
        this.socketCount = template?.socketCount || 0;
        
        /** @type {Array} Заполненные сокеты */
        this.sockets = options.sockets || [];
        
        // ===== ЛИМИТИРОВАННЫЕ ПРЕДМЕТЫ =====
        /** @type {boolean} Есть ли глобальный лимит */
        this.isLimited = (template?.globalLimit || 0) > 0;
        
        // ===== МЕТАДАННЫЕ =====
        /** @type {number} Время создания */
        this.createdAt = Date.now();
    }

    /**
     * Генерирует уникальный ID для экземпляра
     * @private
     */
    _generateId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${this.id}_${timestamp}_${random}`;
    }

    /**
     * Получить цену продажи
     * @returns {number}
     */
    getSellPrice() {
        return Math.floor((this.price / 2) * this.count);
    }

    /**
     * Получить информацию для UI
     * @returns {Object}
     */
    getInfo() {
        return {
            instanceId: this.instanceId,
            id: this.id,
            name: this.name,
            type: this.type,
            slot: this.slot,
            stats: { ...this.stats },
            price: this.price,
            stackable: this.stackable,
            count: this.count,
            sellPrice: this.getSellPrice(),
            durability: this.durability,
            maxDurability: this.maxDurability,
            weight: this.weight,
            isLimited: this.isLimited,
            lifetimeDays: this.lifetimeDays
        };
    }

    /**
     * Проверить, можно ли стакаться с другим предметом
     * @param {ItemData} otherItem
     * @returns {boolean}
     */
    canStackWith(otherItem) {
        if (!this.stackable || !otherItem?.stackable) return false;
        if (this.id !== otherItem.id) return false;
        if (this.durability !== otherItem.durability) return false;
        if (this.socketCount !== otherItem.socketCount) return false;
        if (this.isLimited || otherItem.isLimited) return false;
        return true;
    }
    /**
     * Использовать предмет
     * @param {Object} player - игрок
     * @returns {Object} результат использования
     */
    use(player) {
        if (this.type !== 'consumable') {
            return { success: false, message: 'Нельзя использовать этот предмет' };
        }
        
        const result = { success: true, effects: [] };
        
        if (this.stats.health > 0) {
            const healed = player.heal(this.stats.health);
            result.effects.push(`Восстановлено ${healed} здоровья`);
        }
        
        if (this.stats.mana > 0) {
            // TODO: восстановление маны
            result.effects.push(`Восстановлено ${this.stats.mana} маны`);
        }
        
        if (this.stats.stamina > 0) {
            // TODO: восстановление выносливости
            result.effects.push(`Восстановлено ${this.stats.stamina} выносливости`);
        }
        
        return result;
    }
}

export { ItemData };
// core/ItemRegistry.js
import { ItemData } from './ItemData.js';

/**
 * Глобальный реестр всех экземпляров предметов в мире.
 * 
 * Отвечает за:
 * - Хранение ссылок на все существующие предметы
 * - Контроль лимитов для редких предметов
 * - Поиск предметов по instanceId
 * - Удаление предметов при уничтожении
 * 
 * Singleton — один экземпляр на всю игру.
 */
class ItemRegistry {
    constructor() {
        /** @type {Map<string, ItemData>} Реестр всех экземпляров */
        this.worldItems = new Map(); // instanceId -> ItemData
        
        /** @type {Map<string, number>} Счётчики лимитированных предметов */
        this.limitedCounts = new Map(); // itemId -> currentCount
        
        /** @type {Map<string, number>} Лимиты из items.json */
        this.itemLimits = new Map(); // itemId -> maxCount
        
        /** @type {boolean} Флаг инициализации */
        this.initialized = false;
    }

    /**
     * Инициализация реестра (загружает лимиты из ItemDataRegistry)
     */
    init() {
        if (this.initialized) return;
        
        // Лимиты будем получать при регистрации через ItemData
        // Здесь ничего не загружаем, чтобы не создавать зависимость
        
        this.initialized = true;
        console.log(`ItemRegistry: инициализирован`);
    }

    /**
     * Зарегистрировать предмет в мире
     * @param {ItemData} item - экземпляр предмета
     * @returns {boolean} - успех регистрации (false если превышен лимит)
     */
    registerItem(item) {
        if (!item || !item.instanceId) {
            console.warn('ItemRegistry: попытка зарегистрировать предмет без instanceId');
            return false;
        }

        // Проверка лимита для лимитированных предметов
        if (item.isLimited) {
            const currentCount = this.limitedCounts.get(item.id) || 0;
            
            // Получаем лимит из данных предмета
            const limit = this._getItemLimit(item.id);
            
            if (limit && currentCount >= limit) {
                console.warn(`ItemRegistry: превышен глобальный лимит для ${item.id} (${limit})`);
                return false;
            }
            
            this.limitedCounts.set(item.id, currentCount + 1);
        }

        // Регистрация в реестре
        this.worldItems.set(item.instanceId, item);
        
        return true;
    }

    /**
     * Получить лимит для предмета
     * @private
     */
    _getItemLimit(itemId) {
        // В будущем можно кэшировать, пока просто проверяем через ItemDataRegistry
        // Не импортируем напрямую, чтобы избежать циклических зависимостей
        if (window.ItemDataRegistry) {
            const template = window.ItemDataRegistry.get(itemId);
            return template?.globalLimit || null;
        }
        return null;
    }

    /**
     * Удалить предмет из реестра
     * @param {string} instanceId 
     */
    unregisterItem(instanceId) {
        const item = this.worldItems.get(instanceId);
        if (!item) return;

        // Уменьшаем счётчик лимитированных предметов
        if (item.isLimited) {
            const currentCount = this.limitedCounts.get(item.id) || 0;
            if (currentCount > 0) {
                this.limitedCounts.set(item.id, currentCount - 1);
            }
        }

        this.worldItems.delete(instanceId);
    }

    /**
     * Получить предмет по instanceId
     * @param {string} instanceId 
     * @returns {ItemData|null}
     */
    getItem(instanceId) {
        return this.worldItems.get(instanceId) || null;
    }

    /**
     * Проверить, можно ли создать новый экземпляр лимитированного предмета
     * @param {string} itemId 
     * @returns {boolean}
     */
    canSpawn(itemId) {
        const limit = this._getItemLimit(itemId);
        if (!limit) return true; // без лимита

        const current = this.limitedCounts.get(itemId) || 0;
        return current < limit;
    }

    /**
     * Получить текущее количество экземпляров лимитированного предмета
     * @param {string} itemId 
     * @returns {number}
     */
    getCurrentCount(itemId) {
        return this.limitedCounts.get(itemId) || 0;
    }

    /**
     * Проверить, зарегистрирован ли предмет
     * @param {string} instanceId 
     * @returns {boolean}
     */
    hasItem(instanceId) {
        return this.worldItems.has(instanceId);
    }

    /**
     * Получить количество зарегистрированных предметов
     * @returns {number}
     */
    getTotalCount() {
        return this.worldItems.size;
    }

    /**
     * Получить статистику реестра
     * @returns {Object}
     */
    getStats() {
        return {
            totalItems: this.worldItems.size,
            limitedItems: this.limitedCounts.size,
            limits: Object.fromEntries(this.itemLimits)
        };
    }

    /**
     * Очистить реестр (для тестов/перезагрузки)
     */
    reset() {
        this.worldItems.clear();
        this.limitedCounts.clear();
        this.itemLimits.clear();
        this.initialized = false;
    }

    /**
     * Сериализация для сохранений (только данные, не сам реестр)
     * @returns {Object}
     */
    toJSON() {
        return {
            limitedCounts: Object.fromEntries(this.limitedCounts)
        };
    }

    /**
     * Загрузка из сохранения
     * @param {Object} data 
     */
    fromJSON(data) {
        if (data?.limitedCounts) {
            this.limitedCounts = new Map(Object.entries(data.limitedCounts));
        }
    }
}

// Создаём и экспортируем единственный экземпляр
export const itemRegistry = new ItemRegistry();
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
 * - Генерацию уникальных ID для экземпляров
 * 
 * Содержит заготовки для будущих механик:
 * - Срок жизни предметов (lifetime) через TimeSystem
 * - Поиск предметов по владельцам (для заклинаний)
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
        
        // ========== ЗАГОТОВКИ НА БУДУЩЕЕ ==========
        
        /** @type {Map<string, Object>} Данные для срока жизни (lifetime) */
        this.lifetimeData = new Map(); // instanceId -> { createdAt, totalLifetime, remainingMs }
        
        /** @type {Map<string, Object>} Индекс владельцев для поиска предметов */
        this.ownerIndex = new Map(); // instanceId -> { ownerType, ownerId, roomId }
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

    // ========== ГЕНЕРАЦИЯ ID ==========

    /**
     * Сгенерировать уникальный ID для экземпляра предмета
     * @param {string} itemId - ID предмета из items.json
     * @param {boolean} isLimited - является ли предмет лимитированным
     * @returns {string} уникальный instanceId
     */
    generateInstanceId(itemId, isLimited = false) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        
        if (isLimited) {
            return `limited_${itemId}_${timestamp}_${random}`;
        } else {
            return `item_${itemId}_${timestamp}_${random}`;
        }
    }

    // ========== РЕГИСТРАЦИЯ ПРЕДМЕТОВ ==========

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
        
        // ЗАГОТОВКА: здесь будет вызов _scheduleExpiry(item)
        // для установки срока жизни через TimeSystem
        
        return true;
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

        // ЗАГОТОВКА: здесь будет очистка таймера/подписки TimeSystem
        
        // ЗАГОТОВКА: очистка ownerIndex
        this.ownerIndex.delete(instanceId);
        
        // ЗАГОТОВКА: очистка lifetimeData
        this.lifetimeData.delete(instanceId);

        this.worldItems.delete(instanceId);
    }

    /**
     * Получить лимит для предмета
     * @private
     */
    _getItemLimit(itemId) {
        // В будущем можно кэшировать, пока просто проверяем через ItemDataRegistry
        if (window.ItemDataRegistry) {
            const template = window.ItemDataRegistry.get(itemId);
            return template?.globalLimit || null;
        }
        return null;
    }

    // ========== ПОИСК ПРЕДМЕТОВ ==========

    /**
     * Получить предмет по instanceId
     * @param {string} instanceId 
     * @returns {ItemData|null}
     */
    getItem(instanceId) {
        return this.worldItems.get(instanceId) || null;
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

    // ========== РАБОТА С ЛИМИТАМИ ==========

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

    // ========== ЗАГОТОВКИ ДЛЯ СРОКА ЖИЗНИ (LIFETIME) ==========

    /**
     * ЗАГОТОВКА: запланировать истечение срока жизни предмета
     * @private
     */
    _scheduleExpiry(item) {
        // БУДЕТ РЕАЛИЗОВАНО В БУДУЩЕМ:
        // - Проверка item.lifetimeDays
        // - Создание записи в lifetimeData
        // - Подписка на TimeSystem
        // - Эмит события item:expired при истечении
    }

    /**
     * ЗАГОТОВКА: принудительно истечь срок жизни предмета
     * @param {string} instanceId
     */
    expireItem(instanceId) {
        // БУДЕТ РЕАЛИЗОВАНО В БУДУЩЕМ:
        // - Удаление предмета из реестра
        // - Эмит события 'item:expired'
        // - Очистка таймеров
    }

    /**
     * ЗАГОТОВКА: получить оставшееся время жизни предмета
     * @param {string} instanceId
     * @returns {number|null} оставшееся время в миллисекундах или null
     */
    getRemainingTime(instanceId) {
        // БУДЕТ РЕАЛИЗОВАНО В БУДУЩЕМ
        return null;
    }

    /**
     * ЗАГОТОВКА: уменьшить оставшееся время жизни предмета
     * @param {string} instanceId
     * @param {number} factor - множитель уменьшения (0.5 = вдвое)
     * @returns {boolean} успех операции
     */
    reduceLifetime(instanceId, factor) {
        // БУДЕТ РЕАЛИЗОВАНО В БУДУЩЕМ
        return false;
    }

    /**
     * ЗАГОТОВКА: увеличить время жизни предмета
     * @param {string} instanceId
     * @param {number} days - количество добавляемых дней
     * @returns {boolean} успех операции
     */
    extendLifetime(instanceId, days) {
        // БУДЕТ РЕАЛИЗОВАНО В БУДУЩЕМ
        return false;
    }

    // ========== ЗАГОТОВКИ ДЛЯ ПОИСКА ПО ВЛАДЕЛЬЦАМ ==========

    /**
     * ЗАГОТОВКА: зарегистрировать предмет с информацией о владельце
     * @param {ItemData} item
     * @param {Object} ownerInfo - { ownerType, ownerId, roomId }
     * @returns {boolean}
     */
    registerItemWithOwner(item, ownerInfo) {
        // БУДЕТ РЕАЛИЗОВАНО В БУДУЩЕМ:
        // - Сначала обычная регистрация
        // - Затем сохранение в ownerIndex
        return this.registerItem(item);
    }

    /**
     * ЗАГОТОВКА: обновить информацию о владельце предмета
     * @param {string} instanceId
     * @param {Object} newOwnerInfo
     * @returns {boolean}
     */
    updateItemOwner(instanceId, newOwnerInfo) {
        // БУДЕТ РЕАЛИЗОВАНО В БУДУЩЕМ
        return false;
    }

    /**
     * ЗАГОТОВКА: найти все экземпляры предмета по ID шаблона
     * @param {string} itemId
     * @returns {Array<{instanceId: string, count: number, owner: Object}>}
     */
    findItemsByTemplate(itemId) {
        // БУДЕТ РЕАЛИЗОВАНО В БУДУЩЕМ
        return [];
    }

    // ========== СТАТИСТИКА И ОТЛАДКА ==========

    /**
     * Получить статистику реестра
     * @returns {Object}
     */
    getStats() {
        return {
            totalItems: this.worldItems.size,
            limitedItems: this.limitedCounts.size,
            limits: Object.fromEntries(this.itemLimits),
            counts: Object.fromEntries(this.limitedCounts)
        };
    }

    /**
     * Очистить реестр (для тестов/перезагрузки)
     */
    reset() {
        // ЗАГОТОВКА: очистка всех таймеров
        this.worldItems.clear();
        this.limitedCounts.clear();
        this.itemLimits.clear();
        this.lifetimeData.clear();
        this.ownerIndex.clear();
        this.initialized = false;
    }

    // ========== СЕРИАЛИЗАЦИЯ ==========

    /**
     * Сериализация для сохранений (только данные, не сам реестр)
     * @returns {Object}
     */
    toJSON() {
        return {
            limitedCounts: Object.fromEntries(this.limitedCounts)
            // ЗАГОТОВКА: добавить lifetimeData
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
        // ЗАГОТОВКА: восстановить lifetimeData
    }
}

// Создаём и экспортируем единственный экземпляр
export const itemRegistry = new ItemRegistry();
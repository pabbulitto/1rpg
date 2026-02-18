// services/ItemService.js
import { ItemDataRegistry } from '../data/ItemDataRegistry.js';

/**
 * ItemService - глобальный реестр всех предметов в мире
 * 
 * Отвечает за:
 * - Уникальные ID экземпляров (instanceId)
 * - Лимитированные предметы (глобальный лимит на количество)
 * - Срок жизни предметов (lifetime)
 * - Поиск предметов по instanceId
 * 
 * Singleton — один экземпляр на всю игру.
 */
class ItemService {
    constructor() {
        // Реестр всех существующих предметов в мире
        this.worldItems = new Map(); // instanceId -> Item
        
        // Счётчики лимитированных предметов
        this.limitedCounts = new Map(); // itemId -> currentCount
        
        // Таймеры для срока жизни
        this.expiryTimers = new Map(); // instanceId -> timerId
        
        // Лимиты из items.json (кэш)
        this.itemLimits = new Map(); // itemId -> maxCount
        
        this.initialized = false;
    }
    
    /**
     * Инициализация сервиса
     * Загружает лимиты из реестра данных
     */
    init() {
        if (this.initialized) return;
        
        const allItems = ItemDataRegistry.getAll();
        Object.entries(allItems).forEach(([itemId, data]) => {
            if (data.globalLimit && data.globalLimit > 0) {
                this.itemLimits.set(itemId, data.globalLimit);
            }
        });
        
        this.initialized = true;
        console.log(`ItemService: инициализирован, лимитированных предметов: ${this.itemLimits.size}`);
    }
    
    /**
     * Зарегистрировать предмет в мире
     * @param {Item} item 
     * @returns {boolean} - успех регистрации (false если превышен лимит)
     */
    registerItem(item) {
        if (!item || !item.instanceId) return false;
        
        // Проверка лимита для лимитированных предметов
        const limit = this.itemLimits.get(item.id);
        if (limit) {
            const currentCount = this.limitedCounts.get(item.id) || 0;
            if (currentCount >= limit) {
                console.warn(`ItemService: превышен глобальный лимит для ${item.id} (${limit})`);
                return false;
            }
            this.limitedCounts.set(item.id, currentCount + 1);
            item.isLimited = true;
        }
        
        // Регистрация в реестре
        this.worldItems.set(item.instanceId, item);
        
        // Установка таймера на срок жизни
        if (item.lifetimeDays && item.lifetimeDays > 0) {
            this._scheduleExpiry(item);
        }
        
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
        
        // Отменяем таймер срока жизни
        if (this.expiryTimers.has(instanceId)) {
            clearTimeout(this.expiryTimers.get(instanceId));
            this.expiryTimers.delete(instanceId);
        }
        
        this.worldItems.delete(instanceId);
    }
    
    /**
     * Получить предмет по instanceId
     * @param {string} instanceId 
     * @returns {Item|null}
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
        const limit = this.itemLimits.get(itemId);
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
     * Получить максимальный лимит предмета
     * @param {string} itemId 
     * @returns {number|null}
     */
    getItemLimit(itemId) {
        return this.itemLimits.get(itemId) || null;
    }
    
    /**
     * Установить таймер на срок жизни предмета
     * @private
     */
    _scheduleExpiry(item) {
        if (!item.lifetimeDays) return;
        
        // Конвертируем дни в миллисекунды (1 день = 86400000 мс)
        const lifetimeMs = item.lifetimeDays * 24 * 60 * 60 * 1000;
        
        const timerId = setTimeout(() => {
            this.expireItem(item.instanceId);
        }, lifetimeMs);
        
        this.expiryTimers.set(item.instanceId, timerId);
    }
    
    /**
     * Уничтожить предмет по истечении срока жизни
     * @param {string} instanceId 
     */
    expireItem(instanceId) {
        const item = this.worldItems.get(instanceId);
        if (!item) return;
        
        console.log(`ItemService: предмет ${item.name} (${instanceId}) истёк`);
        
        // Если предмет находится в контейнере, он должен быть удалён
        // Эту логику обрабатывает владелец контейнера через событие
        if (window.game?.eventBus) {
            window.game.eventBus.emit('item:expired', {
                instanceId,
                itemId: item.id
            });
        }
        
        this.unregisterItem(instanceId);
    }
    
    /**
     * Сгенерировать новый instanceId для предмета
     * @param {string} itemId 
     * @param {boolean} isLimited 
     * @returns {string}
     */
    generateInstanceId(itemId, isLimited = false) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        
        if (isLimited) {
            // Для лимитированных предметов добавляем префикс
            return `limited_${itemId}_${timestamp}_${random}`;
        } else {
            return `item_${itemId}_${timestamp}_${random}`;
        }
    }
    
    /**
     * Получить статистику сервиса
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
     * Очистить сервис (для тестов/перезагрузки)
     */
    reset() {
        // Отменяем все таймеры
        this.expiryTimers.forEach(timerId => clearTimeout(timerId));
        
        this.worldItems.clear();
        this.limitedCounts.clear();
        this.expiryTimers.clear();
        // Лимиты не очищаем, они статичны
    }
}

// Синглтон
export const itemService = new ItemService();
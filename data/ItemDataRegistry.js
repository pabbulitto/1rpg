// data/ItemDataRegistry.js
/**
 * ItemDataRegistry - статический реестр данных предметов
 * 
 * Отделяет статические данные (из items.json) от экземпляров Item.
 * Предметы не хранят ссылки на gameState/window.
 * Один источник правды для всей игры.
 */
class ItemDataRegistry {
    static items = {};
    static initialized = false;
    
    /**
     * Инициализировать реестр данными из items.json
     * @param {Object} data - данные из items.json
     */
    static init(data) {
        this.items = data || {};
        this.initialized = true;
        console.log(`ItemDataRegistry: загружено ${Object.keys(this.items).length} предметов`);
    }
    
    /**
     * Получить данные предмета по ID
     * @param {string} itemId 
     * @returns {Object|null}
     */
    static get(itemId) {
        if (!this.initialized) {
            console.warn('ItemDataRegistry: не инициализирован');
            return null;
        }
        return this.items[itemId] || null;
    }
    
    /**
     * Проверить существование предмета
     * @param {string} itemId 
     * @returns {boolean}
     */
    static has(itemId) {
        return this.initialized && !!this.items[itemId];
    }
    
    /**
     * Получить все данные (для сохранений/отладки)
     * @returns {Object}
     */
    static getAll() {
        return { ...this.items };
    }
    
    /**
     * Очистить реестр (для тестов)
     */
    static reset() {
        this.items = {};
        this.initialized = false;
    }
}

export { ItemDataRegistry };
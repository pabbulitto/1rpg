// core/Container.js

/**
 * Container - единый интерфейс для хранения предметов
 * Принцип: предметы НЕ КОПИРУЮТСЯ, а ПЕРЕМЕЩАЮТСЯ по ссылкам.
 * Один предмет существует в одном экземпляре и находится ровно в одном контейнере.
 */
class Container {
    /**
     * @param {number} maxSize - максимальное количество слотов (-1 = безлимит)
     * @param {Array} initialItems - начальные предметы
     */
    constructor(maxSize = -1, initialItems = []) {
        this.items = [];              // массив ссылок на Item
        this.maxSize = maxSize;      // максимальное количество предметов
        this.isDirty = false;        // флаг для сохранений
        
        if (initialItems.length > 0) {
            initialItems.forEach(item => this.addItem(item));
        }
    }
    
    /**
     * Добавить предмет в контейнер
     * @param {Item} item - предмет для добавления
     * @returns {boolean} успех операции
     */
    addItem(item) {
        if (!item) return false;
        
        // Проверка на лимит размера
        if (this.maxSize > 0 && this.items.length >= this.maxSize) {
            console.warn(`Container: достигнут лимит размера (${this.maxSize})`);
            return false;
        }
        
        // 1. Попытка стака со существующим предметом
        if (item.stackable) {
            for (let i = 0; i < this.items.length; i++) {
                const existing = this.items[i];
                if (existing && existing.canStackWith(item)) {
                    existing.count += item.count;
                    this.isDirty = true;
                    return true;
                }
            }
        }
        
        // 2. Новый слот
        this.items.push(item);
        this.isDirty = true;
        return true;
    }
    
    /**
     * Удалить предмет по индексу
     * @param {number} index 
     * @returns {Item|null} удалённый предмет
     */
    removeItem(index) {
        if (index < 0 || index >= this.items.length) return null;
        
        const item = this.items[index];
        this.items.splice(index, 1);
        this.isDirty = true;
        return item;
    }
    
    /**
     * Переместить предмет из этого контейнера в другой
     * @param {Container} targetContainer 
     * @param {number} index 
     * @returns {boolean}
     */
    transferTo(targetContainer, index) {
        const item = this.removeItem(index);
        if (!item) return false;
        
        const success = targetContainer.addItem(item);
        if (!success) {
            // Откат: возвращаем предмет обратно
            this.addItem(item);
            return false;
        }
        
        return true;
    }
    
    /**
     * Получить предмет по индексу (без удаления)
     * @param {number} index 
     * @returns {Item|null}
     */
    getItem(index) {
        return this.items[index] || null;
    }
    
    /**
     * Получить все предметы
     * @returns {Item[]}
     */
    getAllItems() {
        return [...this.items];
    }
    
    /**
     * Количество предметов
     * @returns {number}
     */
    getCount() {
        return this.items.length;
    }
    
    /**
     * Общий вес всех предметов
     * @returns {number}
     */
    getTotalWeight() {
        return this.items.reduce((sum, item) => sum + (item.weight || 0) * (item.count || 1), 0);
    }
    
    /**
     * Проверить наличие предмета по ID
     * @param {string} itemId 
     * @returns {boolean}
     */
    hasItem(itemId) {
        return this.items.some(item => item.id === itemId);
    }
    
    /**
     * Найти все предметы по ID
     * @param {string} itemId 
     * @returns {Item[]}
     */
    findItems(itemId) {
        return this.items.filter(item => item.id === itemId);
    }
    
    /**
     * Найти индекс первого предмета по ID
     * @param {string} itemId 
     * @returns {number} -1 если не найден
     */
    findItemIndex(itemId) {
        return this.items.findIndex(item => item.id === itemId);
    }
    
    /**
     * Очистить контейнер
     * @returns {Item[]} все удалённые предметы
     */
    clear() {
        const items = [...this.items];
        this.items = [];
        this.isDirty = true;
        return items;
    }
    
    /**
     * Сериализация для сохранений
     * @returns {Array} массив {id, count, instanceId, ...}
     */
    toJSON() {
        return this.items.map(item => ({
            id: item.id,
            instanceId: item.instanceId,
            count: item.count || 1,
            durability: item.durability,
            sockets: item.sockets ? [...item.sockets] : [],
            // Для трупов/контейнеров
            isCorpse: item.isCorpse || false,
            originalCreature: item.originalCreature ? { ...item.originalCreature } : null,
            lootContainer: item.lootContainer ? [...item.lootContainer] : [],
            skinningProducts: item.skinningProducts ? [...item.skinningProducts] : []
        }));
    }
    
    /**
     * Загрузка из сохранения
     * @param {Array} data 
     * @param {GameState} gameState 
     * @returns {Container}
     */
    static fromJSON(data, gameState) {
        const container = new Container();
        
        if (!data || !Array.isArray(data)) return container;
        
        data.forEach(itemData => {
            try {
                // Динамический импорт для избежания циклических зависимостей
                import('./Item.js').then(({ Item }) => {
                    const item = new Item(itemData.id, itemData.count || 1, {
                        instanceId: itemData.instanceId
                    });
                    
                    // Восстанавливаем состояние
                    if (itemData.durability !== undefined) item.durability = itemData.durability;
                    if (itemData.sockets) item.sockets = [...itemData.sockets];
                    if (itemData.isCorpse) item.isCorpse = true;
                    if (itemData.originalCreature) item.originalCreature = { ...itemData.originalCreature };
                    if (itemData.lootContainer) item.lootContainer = [...itemData.lootContainer];
                    if (itemData.skinningProducts) item.skinningProducts = [...itemData.skinningProducts];
                    
                    container.addItem(item);
                }).catch(e => {
                    console.warn(`Container: не удалось загрузить предмет ${itemData.id}`, e);
                });
            } catch (e) {
                console.warn(`Container: не удалось восстановить предмет ${itemData.id}`, e);
            }
        });
        
        return container;
    }
}

export { Container };
// core/EntityContainer.js
import { Item } from './Item.js';
import { itemFactory } from './ItemFactory.js';
import { EquipmentService } from '../services/EquipmentService.js';

/**
 * Единый контейнер для инвентаря и экипировки.
 * 
 * Что хранит:
 * - items: массив предметов (инвентарь)
 * - equipment: объект с экипированными предметами по слотам
 * 
 * Принципы:
 * 1. Предмет существует в одном экземпляре (ссылка)
 * 2. Предмет не может быть одновременно в инвентаре и экипировке
 * 3. Все операции с предметами идут через этот класс
 */
class EntityContainer {
    /**
     * @param {Object} options
     * @param {Array} options.items - начальные предметы
     * @param {Object} options.equipment - начальная экипировка
     */
    constructor(options = {}) {
        // === ИНВЕНТАРЬ ===
        /** @type {Item[]} */
        this.items = options.items ? [...options.items] : [];
        
        // === ЭКИПИРОВКА (14 слотов как в Character) ===
        /** @type {Object} */
        this.equipment = options.equipment ? { ...options.equipment } : {
            head: null,
            neck1: null,
            neck2: null,
            arms: null,
            hands: null,
            ring1: null,
            ring2: null,
            body: null,
            belt: null,
            legs: null,
            feet: null,
            right_hand: null,
            left_hand: null,
            bracelet1: null,
            bracelet2: null
        };
        
        // === КЭШ ДЛЯ БЫСТРОГО ПОИСКА ===
        /** @type {Map<string, number>} Индекс предметов по ID (для быстрого поиска) */
        this._itemIndex = new Map();
        this._rebuildIndex();
        
        // === ФЛАГ ИЗМЕНЕНИЙ ДЛЯ СОХРАНЕНИЙ ===
        this._isDirty = false;
    }

    // ========== РАБОТА С ИНДЕКСАМИ ==========

    /** @private */
    _rebuildIndex() {
        this._itemIndex.clear();
        this.items.forEach((item, index) => {
            if (item && item.id) {
                this._itemIndex.set(item.id, index);
            }
        });
    }

    /** @private */
    _markDirty() {
        this._isDirty = true;
    }

    // ========== РАБОТА С ИНВЕНТАРЕМ ==========

    /**
     * Добавить предмет в инвентарь
     * @param {Item} item
     * @returns {boolean}
     */
    addItem(item) {
        if (!item) return false;

        // 1. Попытка стака со существующим предметом
        if (item.stackable) {
            for (let i = 0; i < this.items.length; i++) {
                const existing = this.items[i];
                if (existing && existing.canStackWith(item)) {
                    existing.count += item.count;
                    this._markDirty();
                    return true;
                }
            }
        }

        // 2. Новый слот
        this.items.push(item);
        this._itemIndex.set(item.id, this.items.length - 1);
        this._markDirty();
        return true;
    }

    /**
     * Удалить предмет из инвентаря по индексу
     * @param {number} index
     * @returns {Item|null}
     */
    removeItem(index) {
        if (index < 0 || index >= this.items.length) return null;
        
        const item = this.items[index];
        this.items.splice(index, 1);
        this._rebuildIndex();
        this._markDirty();
        return item;
    }

    /**
     * Получить предмет из инвентаря по индексу
     * @param {number} index
     * @returns {Item|null}
     */
    getItem(index) {
        return this.items[index] || null;
    }

    /**
     * Найти индекс предмета по ID
     * @param {string} itemId
     * @returns {number} -1 если не найден
     */
    findItemIndex(itemId) {
        return this._itemIndex.get(itemId) ?? -1;
    }

    /**
     * Получить все предметы инвентаря
     * @returns {Item[]}
     */
    getAllItems() {
        return this.items; 
    }

    /**
     * Проверить наличие предмета в инвентаре
     * @param {string} itemId
     * @returns {boolean}
     */
    hasItem(itemId) {
        return this._itemIndex.has(itemId);
    }

    /**
     * Получить общее количество предметов в инвентаре
     * @returns {number}
     */
    getItemCount() {
        return this.items.length;
    }

    /**
     * Получить общий вес всех предметов в инвентаре
     * @returns {number}
     */
    getTotalWeight() {
        return this.items.reduce((sum, item) => sum + (item.weight || 0) * (item.count || 1), 0);
    }

    // ========== РАБОТА С ЭКИПИРОВКОЙ ==========

    /**
     * Получить экипированный предмет в слоте
     * @param {string} slot
     * @returns {Item|null}
     */
    getEquippedItem(slot) {
        return this.equipment[slot] || null;
    }

    /**
     * Получить всю экипировку
     * @returns {Object}
     */
    getAllEquipment() {
        return { ...this.equipment };
    }

    /**
     * Экипировать предмет
     * @param {Item} item
     * @param {string} slot
     * @param {EquipmentService} equipmentService
     * @returns {Object} результат {success, message, swappedItem}
     */
    equip(item, slot, equipmentService) {
        if (!item || !slot || !equipmentService) {
            return { success: false, message: 'Неверные параметры' };
        }

        // 1. Проверяем, что предмет в инвентаре
        const itemIndex = this.findItemIndex(item.id);
        if (itemIndex === -1) {
            return { success: false, message: 'Предмет не найден в инвентаре' };
        }

        // 2. Проверяем возможность экипировки через EquipmentService
        const validation = equipmentService.canEquip(item, this.equipment);
        if (!validation.success) {
            return validation;
        }

        const { targetSlot, slotsToClear } = validation;

        // 3. Освобождаем нужные слоты
        const swappedItems = [];
        for (const clearSlot of slotsToClear) {
            const oldItem = this.unequip(clearSlot);
            if (oldItem) swappedItems.push(oldItem);
        }

        // 4. Удаляем предмет из инвентаря
        const removedItem = this.removeItem(itemIndex);
        if (!removedItem) {
            // Откат: возвращаем снятые предметы
            swappedItems.forEach(oldItem => this.addItem(oldItem));
            return { success: false, message: 'Не удалось удалить предмет из инвентаря' };
        }

        // 5. Надеваем
        this.equipment[targetSlot] = removedItem;

        // 6. Применяем модификаторы (будет вызывать тот, кто использует контейнер)
        this._markDirty();

        return {
            success: true,
            message: `Экипировано ${removedItem.name}`,
            slot: targetSlot,
            item: removedItem,
            swappedItems
        };
    }

    /**
     * Снять предмет с экипировки
     * @param {string} slot
     * @returns {Item|null} снятый предмет
     */
    unequip(slot) {
        const item = this.equipment[slot];
        if (!item) return null;

        // Снимаем
        this.equipment[slot] = null;
        
        // Добавляем обратно в инвентарь
        this.addItem(item);
        
        this._markDirty();
        return item;
    }

    /**
     * Проверить, занят ли слот
     * @param {string} slot
     * @returns {boolean}
     */
    isSlotEquipped(slot) {
        return !!this.equipment[slot];
    }

    // ========== ОБЩИЕ МЕТОДЫ ==========

    /**
     * Очистить контейнер
     * @returns {Object} все удаленные предметы {items, equipment}
     */
    clear() {
        const items = [...this.items];
        const equipment = { ...this.equipment };
        
        this.items = [];
        this.equipment = {
            head: null, neck1: null, neck2: null, arms: null,
            hands: null, ring1: null, ring2: null, body: null,
            belt: null, legs: null, feet: null,
            right_hand: null, left_hand: null
        };
        this._itemIndex.clear();
        this._markDirty();
        
        return { items, equipment };
    }

    /**
     * Получить информацию для UI
     * @returns {Object}
     */
    getInfo() {
        return {
            items: this.items.map(item => item.getInfo ? item.getInfo() : item),
            equipment: Object.entries(this.equipment).reduce((acc, [slot, item]) => {
                acc[slot] = item ? (item.getInfo ? item.getInfo() : item) : null;
                return acc;
            }, {}),
            itemCount: this.items.length,
            totalWeight: this.getTotalWeight()
        };
    }

    // ========== СЕРИАЛИЗАЦИЯ ==========

    /**
     * Сериализация для сохранений
     * @returns {Object}
     */
    toJSON() {
        return {
            items: this.items.map(item => ({
                id: item.id,
                instanceId: item.instanceId,
                count: item.count || 1,
                durability: item.durability,
                sockets: item.sockets ? [...item.sockets] : []
            })),
            equipment: Object.entries(this.equipment).reduce((acc, [slot, item]) => {
                if (item) {
                    acc[slot] = {
                        id: item.id,
                        instanceId: item.instanceId,
                        durability: item.durability
                    };
                } else {
                    acc[slot] = null;
                }
                return acc;
            }, {})
        };
    }

    /**
     * Загрузка из сохранения
     * @param {Object} data
     * @returns {EntityContainer}
     */
    static fromJSON(data) {
        const container = new EntityContainer();
        
        if (!data) return container;
        
        // Загружаем предметы инвентаря
        if (data.items && Array.isArray(data.items)) {
            data.items.forEach(itemData => {
                try {
                    // ИСПРАВЛЕНО: используем фабрику для создания предметов
                    const item = itemFactory.createFromSave(itemData);
                    if (item) {
                        container.addItem(item);
                    }
                } catch (e) {
                    console.warn('EntityContainer: не удалось загрузить предмет', itemData?.id, e);
                }
            });
        }
        
        // Загружаем экипировку
        if (data.equipment) {
            Object.entries(data.equipment).forEach(([slot, itemData]) => {
                if (itemData) {
                    try {
                        // ИСПРАВЛЕНО: используем фабрику для создания предметов экипировки
                        const item = itemFactory.createFromSave(itemData);
                        if (item) {
                            container.equipment[slot] = item;
                        }
                    } catch (e) {
                        console.warn('EntityContainer: не удалось загрузить предмет экипировки', slot, e);
                    }
                }
            });
        }
        
        container._rebuildIndex();
        return container;
    }

    /**
     * Проверить, были ли изменения с последнего сохранения
     */
    isDirty() {
        return this._isDirty;
    }

    /**
     * Сбросить флаг изменений
     */
    resetDirty() {
        this._isDirty = false;
    }
}

export { EntityContainer };
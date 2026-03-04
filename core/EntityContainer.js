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
        // НОВОЕ: ссылка на владельца для проверки веса
        this.owner = options.owner || null;
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
            if (item && item.instanceId) {          
                this._itemIndex.set(item.instanceId, index);
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
        
        // проверка веса
        if (!this.canAddItem(item)) {
            console.warn(`EntityContainer: недостаточно грузоподъемности для ${item.name}`);
            return false;
        }

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
        this._itemIndex.set(item.instanceId, this.items.length - 1);
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
     * Удалить предмет из инвентаря по instanceId
     * @param {string} instanceId - уникальный ID экземпляра предмета
     * @returns {Item|null} - удаленный предмет или null
     */
    removeItemById(instanceId) {
        // Валидация входных данных
        if (!instanceId || typeof instanceId !== 'string') {
            console.warn('EntityContainer.removeItemById: передан некорректный instanceId', instanceId);
            return null;
        }
        
        // Находим индекс предмета по instanceId через существующий индекс
        const index = this._itemIndex.get(instanceId);
        
        // Если предмет не найден в индексе - пробуем полный поиск (на случай рассинхронизации)
        if (index === undefined) {
            console.warn(`EntityContainer.removeItemById: instanceId ${instanceId} не найден в индексе, выполняем полный поиск`);
            
            for (let i = 0; i < this.items.length; i++) {
                if (this.items[i] && this.items[i].instanceId === instanceId) {
                    // Нашли - удаляем через существующий метод
                    return this.removeItem(i);
                }
            }
            
            // Не нашли нигде
            console.warn(`EntityContainer.removeItemById: предмет с instanceId ${instanceId} не найден`);
            return null;
        }
        
        // Проверяем, что индекс в допустимых пределах
        if (index < 0 || index >= this.items.length) {
            console.error(`EntityContainer.removeItemById: индекс ${index} вне допустимого диапазона для instanceId ${instanceId}`);
            this._rebuildIndex(); // перестраиваем индекс на всякий случай
            return null;
        }
        
        // Используем существующий метод removeItem по индексу
        return this.removeItem(index);
    }
    /**
     * Уменьшить количество предмета в стаке или удалить если был последний
     * @param {string} instanceId - уникальный ID экземпляра предмета
     * @returns {Object} результат операции { success: boolean, itemRemoved: boolean, remainingCount: number }
     */
    decrementItem(instanceId) {
        // Результат по умолчанию
        const result = {
            success: false,
            itemRemoved: false,
            remainingCount: 0
        };
        
        if (!instanceId || typeof instanceId !== 'string') {
            console.warn(`EntityContainer.decrementItem: некорректный instanceId`, instanceId);
            return result;
        }
        
        // Находим индекс предмета
        const index = this._itemIndex.get(instanceId);
        if (index === undefined || index < 0 || index >= this.items.length) {
            console.warn(`EntityContainer.decrementItem: предмет с instanceId ${instanceId} не найден`);
            return result;
        }
        
        const item = this.items[index];
        if (!item) return result;
        
        // Уменьшаем количество
        if (item.stackable && item.count > 1) {
            // Просто уменьшаем счетчик
            item.count--;
            this._markDirty();
            
            result.success = true;
            result.itemRemoved = false;
            result.remainingCount = item.count;
        } else {
            // Удаляем предмет полностью (count === 1 или нестакаемый)
            const removedItem = this.removeItem(index);
            if (removedItem) {
                result.success = true;
                result.itemRemoved = true;
                result.remainingCount = 0;
            }
        }
        
        return result;
    }

    /**
     * Использовать предмет по instanceId (уменьшить стак и вернуть результат использования)
     * @param {string} instanceId - уникальный ID экземпляра предмета
     * @param {Object} user - персонаж, использующий предмет (для передачи в item.use())
     * @returns {Object} результат операции { success: boolean, useResult: Object, decrementResult: Object }
     */
    useItem(instanceId, user) {
        // Результат по умолчанию
        const result = {
            success: false,
            useResult: null,
            decrementResult: null
        };
        
        if (!instanceId || !user) {
            console.warn(`EntityContainer.useItem: некорректные параметры`, { instanceId, user });
            return result;
        }
        
        // Находим предмет
        const index = this._itemIndex.get(instanceId);
        if (index === undefined || index < 0 || index >= this.items.length) {
            console.warn(`EntityContainer.useItem: предмет с instanceId ${instanceId} не найден`);
            return result;
        }
        
        const item = this.items[index];
        if (!item) return result;
        
        // Проверяем, можно ли использовать (только consumable)
        if (item.type !== 'consumable') {
            console.warn(`EntityContainer.useItem: предмет ${item.name} не является расходуемым`);
            return result;
        }
        
        // Используем предмет
        const useResult = item.use(user);
        if (!useResult || !useResult.success) {
            return { ...result, useResult };
        }
        
        // Уменьшаем количество или удаляем
        const decrementResult = this.decrementItem(instanceId);
        
        return {
            success: decrementResult.success,
            useResult: useResult,
            decrementResult: decrementResult
        };
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
     * Найти индекс предмета по instanceId
     * @param {string} instanceId - уникальный ID экземпляра предмета
     * @returns {number} индекс или -1 если не найден
     */
    findItemIndexByInstanceId(instanceId) {
        if (!instanceId) return -1;
        
        // Сначала пробуем через _itemIndex (быстрый поиск)
        const index = this._itemIndex.get(instanceId);
        if (index !== undefined && index >= 0 && index < this.items.length) {
            return index;
        }
        
        // Если не нашли в индексе - полный перебор (защита от рассинхронизации)
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i] && this.items[i].instanceId === instanceId) {
                // Восстанавливаем индекс
                this._itemIndex.set(instanceId, i);
                return i;
            }
        }
        
        return -1;
    }
    /**
     * Получить все предметы инвентаря
     * @returns {Item[]}
     */
    getAllItems() {
        return this.items; 
    }

    /**
     * Проверить наличие предмета в инвентаре по instanceId
     * @param {string} instanceId - уникальный ID экземпляра предмета
     * @returns {boolean}
     */
    hasItem(instanceId) {
        if (!instanceId) return false;
        return this._itemIndex.has(instanceId);
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
    /**
     * Получить максимально допустимый вес для владельца
     * @returns {number} - максимальный вес или Infinity если нет владельца
     */
    getMaxCarryCapacity() {
        if (!this.owner) return Infinity; // для врагов, трупов, мешков без хозяина
        
        const stats = this.owner.getStats ? this.owner.getStats() : this.owner;
        return stats.carryCapacity || 100; // 100 как запасной вариант
    }
    /**
     * Проверить, влезет ли предмет по весу
     * @param {Item} item - проверяемый предмет
     * @returns {boolean} - true если влезет
     */
    canAddItem(item) {
        if (!item) return false;
        
        const maxCapacity = this.getMaxCarryCapacity();
        if (maxCapacity === Infinity) return true; // для сущностей без ограничений
        
        const currentWeight = this.getTotalWeight();
        const itemWeight = (item.weight || 0) * (item.count || 1);
        
        return (currentWeight + itemWeight) <= maxCapacity;
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
    equip(item, slot, equipmentService, player = null) {
        if (!item || !slot || !equipmentService) {
            return { success: false, message: 'Неверные параметры' };
        }

        // 1. Проверяем, что предмет в инвентаре по instanceId
        const itemIndex = this.findItemIndexByInstanceId(item.instanceId);
        if (itemIndex === -1) {
            return { success: false, message: 'Предмет не найден в инвентаре' };
        }

        // 2. Проверяем возможность экипировки через EquipmentService
        const validation = equipmentService.canEquip(item, this.equipment, player, slot);
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
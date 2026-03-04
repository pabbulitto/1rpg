/**
 * BeltSystem - система быстрого пояса для предметов
 * Управляет слотами, ограничениями по уровню, использованием в бою
 * 
 * Архитектура: предметы физически перемещаются в пояс при добавлении
 * и возвращаются в инвентарь при снятии
 */
import { Item } from '../core/Item.js';
import { itemFactory } from '../core/ItemFactory.js';

class BeltSystem {
    constructor(gameState, battleOrchestrator = null, player = null) {
        this.gameState = gameState;
        this.battleOrchestrator = battleOrchestrator;
        this.player = player;
        this.eventBus = gameState.getEventBus();
        
        // Пояс: индекс слота -> { item: Item, count: number }
        this.beltSlots = new Array(8).fill(null);
        this.activeSlots = 3;
        this.allowedTypes = ['consumable', 'tool'];
        
        this.setupEventListeners();
    }    

    setupEventListeners() {
        // Обновляем количество слотов при изменении уровня
        this.eventBus.on('player:levelUp', (data) => {
            this.updateActiveSlots(data.newLevel);
        });
        
        // Сброс пояса при смерти
        this.eventBus.on('player:died', () => {
            this.clearBelt();
        });
    }
    
    /**
     * Обновить количество активных слотов по уровню
     * @param {number} playerLevel - текущий уровень игрока
     */
    updateActiveSlots(playerLevel) {
        let newActiveSlots = 3; // Базовое значение
        
        if (playerLevel >= 15) newActiveSlots = 4;
        if (playerLevel >= 23) newActiveSlots = 5;
        
        if (newActiveSlots !== this.activeSlots) {
            this.activeSlots = newActiveSlots;
            this.eventBus.emit('belt:slotsUpdated', {
                activeSlots: this.activeSlots,
                totalSlots: 8
            });
        }
    }
    
    /**
     * Проверить можно ли поместить предмет в пояс
     * @param {Item} item - проверяемый предмет
     * @returns {Object} результат проверки
     */
    canAddToBelt(item) {
        if (!item || !item.id) {
            return { success: false, reason: 'Предмет не существует' };
        }
        
        // Проверка типа предмета (consumable ИЛИ tool)
        if (item.type !== 'consumable' && item.type !== 'tool') {
            return { success: false, reason: 'Только расходники и инструменты можно поместить в пояс' };
        }
        
        // Проверка, не занят ли уже этот предмет в другом слоте
        for (let i = 0; i < this.activeSlots; i++) {
            if (this.beltSlots[i] && this.beltSlots[i].item === item) {
                return { success: false, reason: 'Этот предмет уже на поясе' };
            }
        }
        
        // Поиск свободного слота
        const freeSlot = this.findFreeSlot();
        if (freeSlot === -1) {
            return { success: false, reason: 'Все слоты пояса заняты' };
        }
        
        return { 
            success: true, 
            slotIndex: freeSlot,
            reason: `Можно добавить в слот ${freeSlot + 1}`
        };
    }
    
    /**
     * Найти свободный слот
     * @returns {number} индекс свободного слота или -1
     */
    findFreeSlot() {
        for (let i = 0; i < this.activeSlots; i++) {
            if (!this.beltSlots[i]) {
                return i;
            }
        }
        return -1;
    }
    
    /**
     * Добавить предмет в пояс из инвентаря по instanceId
     * @param {string} instanceId - уникальный ID экземпляра предмета
     * @param {number} slotIndex - индекс в поясе (опционально)
     * @returns {Object} результат операции
     */
    addToBeltFromInventory(instanceId, slotIndex = null) {
        if (!instanceId) {
            return { success: false, reason: 'Не указан ID предмета' };
        }
        
        // Получаем предмет из инвентаря
        const inventory = this.gameState.playerContainer.getAllItems();
        const item = inventory.find(i => i && i.instanceId === instanceId);
        if (!item) {
            return { success: false, reason: 'Предмет не найден в инвентаре' };
        }
        
        // Проверяем возможность добавления
        const validation = this.canAddToBelt(item);
        if (!validation.success) {
            return validation;
        }
        
        const targetSlot = slotIndex !== null ? slotIndex : validation.slotIndex;
        
        if (targetSlot >= this.activeSlots) {
            return { success: false, reason: 'Этот слот ещё не открыт' };
        }
        
        if (this.beltSlots[targetSlot]) {
            return { success: false, reason: 'Слот уже занят' };
        }
        
        let itemForBelt;
        
        // Если предмет стакаемый и количество > 1
        if (item.stackable && item.count > 1) {
            // Удаляем оригинал из инвентаря
            const originalItem = this.gameState.playerContainer.removeItemById(instanceId);
            if (!originalItem) {
                return { success: false, reason: 'Не удалось взять предмет из инвентаря' };
            }
            
            // Создаем новый предмет для инвентаря с оставшимся количеством
            const remainingItem = itemFactory.create(originalItem.id, originalItem.count - 1, {
                durability: originalItem.durability,
                sockets: originalItem.sockets ? [...originalItem.sockets] : []
            });
            
            // Добавляем новый предмет обратно в инвентарь
            if (remainingItem) {
                this.gameState.playerContainer.addItem(remainingItem);
            }
            
            // Оригинал (с count=1) идет в пояс
            originalItem.count = 1;
            itemForBelt = originalItem;
        } else {
            // Нестакаемый или последний в стеке - просто перемещаем
            const removedItem = this.gameState.playerContainer.removeItemById(instanceId);
            if (!removedItem) {
                return { success: false, reason: 'Не удалось взять предмет из инвентаря' };
            }
            itemForBelt = removedItem;
        }
        
        // Сохраняем в пояс (целый предмет)
        this.beltSlots[targetSlot] = {
            item: itemForBelt,
            count: 1
        };
        
        this.eventBus.emit('belt:itemAdded', {
            slotIndex: targetSlot,
            item: itemForBelt.getInfo(),
            beltState: this.getBeltInfo()
        });
        
        this.eventBus.emit('inventory:updated', this.gameState.playerContainer.getInfo());
        
        return { 
            success: true, 
            slotIndex: targetSlot,
            message: `Предмет добавлен в слот ${targetSlot + 1}`
        };
    }
    
    /**
     * Удалить предмет из пояса (вернуть в инвентарь)
     * @param {number} slotIndex - индекс слота
     * @returns {Object} результат операции
     */
    removeFromBelt(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.beltSlots.length) {
            return { success: false, reason: 'Неверный индекс слота' };
        }
        
        const slotData = this.beltSlots[slotIndex];
        if (!slotData) {
            return { success: false, reason: 'Слот пуст' };
        }
        
        const { item } = slotData;
        
        // Возвращаем предмет в инвентарь
        const added = this.gameState.playerContainer.addItem(item);
        if (!added) {
            return { success: false, reason: 'Не удалось вернуть предмет в инвентарь' };
        }
        
        // Очищаем слот
        this.beltSlots[slotIndex] = null;
        
        this.eventBus.emit('belt:itemRemoved', { 
            slotIndex,
            item: item.getInfo()
        });
        
        this.eventBus.emit('inventory:updated', this.gameState.playerContainer.getInfo());
        
        return { success: true, message: 'Предмет снят с пояса' };
    }
    
    /**
     * Использовать предмет из пояса
     * @param {number} slotIndex - индекс слота
     * @returns {Object} результат использования
     */
    useBeltItem(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.activeSlots) {
            return { success: false, reason: 'Неверный слот' };
        }
        
        const slotData = this.beltSlots[slotIndex];
        if (!slotData) {
            return { success: false, reason: 'Слот пуст' };
        }
        
        const { item } = slotData;
        
        // Проверка типа предмета
        if (item.type !== "consumable") {
            return { success: false, message: "Нельзя использовать этот предмет" };
        }
        
        const player = this.player;
        if (!player) {
            return { success: false, reason: 'Игрок не найден' };
        }
        
        // Используем предмет (прямо из пояса)
        const useResult = item.use(player);
        
        if (useResult && useResult.success) {
            // Уменьшаем количество
            item.count--;
            
            if (item.count <= 0) {
                // Предмет закончился - очищаем слот
                this.beltSlots[slotIndex] = null;
                this.eventBus.emit('belt:itemRemoved', {
                    slotIndex: slotIndex,
                    item: item.getInfo()
                });
            } else {
                this.eventBus.emit('belt:itemUpdated', {
                    slotIndex: slotIndex,
                    count: item.count,
                    item: item.getInfo()
                });
            }
            
            this.eventBus.emit('belt:itemUsed', {
                slotIndex: slotIndex,
                item: item.getInfo(),
                result: useResult
            });
            
            // Обновляем UI
            this.eventBus.emit('player:statsChanged', this.gameState.getPlayer());
        }
        
        return useResult; 
    }
    
    /**
     * Очистить весь пояс (предметы возвращаются в инвентарь)
     */
    clearBelt() {
        for (let i = 0; i < this.beltSlots.length; i++) {
            const slotData = this.beltSlots[i];
            if (slotData) {
                // Возвращаем предмет в инвентарь
                this.gameState.playerContainer.addItem(slotData.item);
                this.beltSlots[i] = null;
            }
        }
        this.eventBus.emit('belt:cleared');
        this.eventBus.emit('inventory:updated', this.gameState.playerContainer.getInfo());
    }
    
    /**
     * Получить информацию о состоянии пояса для UI
     * @returns {Object} информация о поясе
     */
    getBeltInfo() {
        return {
            slots: this.beltSlots.map((slot, index) => ({
                index: index,
                isActive: index < this.activeSlots,
                item: slot ? slot.item.getInfo() : null,
                hasItem: !!slot
            })),
            activeSlots: this.activeSlots,
            totalSlots: 8,
        };
    }
    
    /**
     * Получить данные для сохранения
     */
    getSaveData() {
        const saveData = [];
        for (let i = 0; i < this.beltSlots.length; i++) {
            const slot = this.beltSlots[i];
            if (slot) {
                saveData.push({
                    slotIndex: i,
                    item: slot.item.toJSON(), // сохраняем данные предмета
                    count: slot.count
                });
            } else {
                saveData.push(null);
            }
        }
        return saveData;
    }
    
    /**
     * Загрузить данные пояса
     */
    loadSaveData(saveData) {
        if (!saveData || !Array.isArray(saveData)) return;
        
        this.beltSlots.fill(null);
        
        for (const slotData of saveData) {
            if (slotData && slotData.item) {
                try {
                    // Восстанавливаем предмет из сохранения
                    const item = itemFactory.createFromSave(slotData.item);
                    if (item) {
                        this.beltSlots[slotData.slotIndex] = {
                            item: item,
                            count: slotData.count || 1
                        };
                    }
                } catch (error) {
                    console.warn('Не удалось загрузить предмет пояса:', slotData, error);
                }
            }
        }
        
        this.eventBus.emit('belt:loaded', this.getBeltInfo());
    }
}

export { BeltSystem };
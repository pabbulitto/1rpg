/**
 * BeltSystem - система быстрого пояса для предметов
 * Управляет слотами, ограничениями по уровню, использованием в бою
 * Полностью совместим с существующей архитектурой проекта
 */
import { Item } from '../core/Item.js';

class BeltSystem {
    constructor(gameState, battleOrchestrator = null, player = null) {
        this.gameState = gameState;
        this.battleOrchestrator = battleOrchestrator;
        this.player = player;
        this.eventBus = gameState.getEventBus();
        
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
        
        // TODO: Добавить проверку умения "Пояса" через skillsSystem
        
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
     * Добавить предмет в пояс из инвентаря
     * @param {number} inventoryIndex - индекс в инвентаре
     * @param {number} slotIndex - индекс в поясе (опционально)
     * @returns {Object} результат операции
     */
    addToBeltFromInventory(inventoryIndex, slotIndex = null) {
        const items = this.gameState.getInventoryItems();
        if (inventoryIndex < 0 || inventoryIndex >= items.length) {
            return { success: false, reason: 'Предмет не найден в инвентаре' };
        }
        
        const item = items[inventoryIndex];
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
        
        // ИСПРАВЛЕНО: используем playerContainer.removeItem вместо inventorySystem
        let itemToAdd;
        if (item.stackable && item.count > 1) {
            itemToAdd = new Item(item.id, item.count);
            // Удаляем через контейнер
            const removedItem = this.gameState.playerContainer.removeItem(inventoryIndex);
            if (!removedItem) {
                return { success: false, reason: 'Не удалось взять предмет из инвентаря' };
            }
        } else {
            const removedItem = this.gameState.playerContainer.removeItem(inventoryIndex);
            if (!removedItem) {
                return { success: false, reason: 'Не удалось взять предмет из инвентаря' };
            }
            itemToAdd = removedItem;
        }
        
        this.beltSlots[targetSlot] = {
            item: itemToAdd,
            inventoryIndex: -1,
            isFromStack: false
        };
        
        this.eventBus.emit('belt:itemAdded', {
            slotIndex: targetSlot,
            item: itemToAdd.getInfo(),
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
     * Удалить предмет из пояса (возвращает в инвентарь)
     * @param {number} slotIndex - индекс слота
     * @returns {Object} результат операции
     */
    removeFromBelt(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.beltSlots.length) {
            return { success: false, reason: 'Неверный индекс слота' };
        }
        
        const beltData = this.beltSlots[slotIndex];
        if (!beltData) {
            return { success: false, reason: 'Слот пуст' };
        }
        
        const { item, isFromStack, inventoryIndex } = beltData;
        
        if (isFromStack && inventoryIndex >= 0) {
            this.eventBus.emit('belt:itemRemoved', { slotIndex });
        } else {
            // ИСПРАВЛЕНО: используем playerContainer.addItem вместо inventorySystem
            const added = this.gameState.playerContainer.addItem(item);
            if (!added) {
                return { success: false, reason: 'Не удалось вернуть предмет в инвентарь' };
            }
            this.eventBus.emit('belt:itemRemoved', { 
                slotIndex,
                item: item.getInfo()
            });
            
            this.eventBus.emit('inventory:updated', this.gameState.playerContainer.getInfo());
        }
        
        this.beltSlots[slotIndex] = null;
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
        
        const beltData = this.beltSlots[slotIndex];
        if (!beltData) {
            return { success: false, reason: 'Слот пуст' };
        }
        
        const battleState = this.gameState.getBattleState();
        if (battleState.inBattle) {
            if (this.battleOrchestrator) {  // ← изменено
                this.battleOrchestrator.useItemInBattle(slotIndex, true);  // ← изменено
                return { success: true, message: 'Предмет используется в бою' };
            }
            return { success: false, reason: 'BattleOrchestrator не найден' };  // ← изменено
        }
        
        const { item } = beltData;
        if (item.type !== "consumable") {
            return { success: false, message: "Нельзя использовать этот предмет" };
        }
        
        const player = this.player;
        if (!player) {
            return { success: false, reason: 'Игрок не найден' };
        }
        
        const useResult = item.use(player);
        
        if (useResult.success) {
            item.count--;
            
            if (item.count <= 0) {
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
            
            this.gameState.eventBus.emit('inventory:updated', 
                this.gameState.playerContainer.getInfo());
            this.gameState.eventBus.emit('player:statsChanged', 
                this.gameState.getPlayer());
        }
        
        return useResult;
    }
    
    /**
     * Очистить весь пояс
     */
    clearBelt() {
        for (let i = 0; i < this.beltSlots.length; i++) {
            if (this.beltSlots[i]) {
                this.removeFromBelt(i);
            }
        }
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
     * Получить данные для сохранения (совместимо с GameState)
     */
    getSaveData() {
        const saveData = [];
        for (let i = 0; i < this.beltSlots.length; i++) {
            const slot = this.beltSlots[i];
            if (slot && slot.item) {
                saveData.push({
                    slotIndex: i,
                    itemId: slot.item.id,
                    count: slot.item.count || 1,
                    isFromStack: slot.isFromStack || false
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
        if (slotData && slotData.itemId) {
            try {
            const item = new Item(slotData.itemId, slotData.count || 1, this.gameState);
            this.beltSlots[slotData.slotIndex] = {
                item: item,
                inventoryIndex: -1,
                isFromStack: slotData.isFromStack || false
            };
            } catch (error) {
            console.warn('Не удалось загрузить предмет пояса:', slotData, error);
            }
        }
        }
        
        this.eventBus.emit('belt:loaded', this.getBeltInfo());
    }
}

export { BeltSystem };
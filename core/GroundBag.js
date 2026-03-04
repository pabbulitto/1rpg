// core/GroundBag.js
/**
 * GroundBag - класс для мешка с предметами на земле
 * Наследует Entity, использует EntityContainer для хранения предметов
 * 
 * Особенности:
 * - Один мешок на комнату (может быть несколько)
 * - Хранит предметы в контейнере
 * - При клике открывает модалку со списком предметов
 * - Исчезает, когда пуст
 */

import { Entity } from './Entity.js';
import { EntityContainer } from './EntityContainer.js';

class GroundBag extends Entity {
    /**
     * @param {Object} options
     * @param {string} options.id - ID мешка (если нужно задать)
     * @param {string} options.roomId - комната
     * @param {number} options.gridX - координата X
     * @param {number} options.gridY - координата Y
     * @param {Object} options.container - готовый контейнер (для загрузки)
     * @param {Object} options.gameState - ссылка на GameState (для событий)
     */
    constructor(options = {}) {
        // Вызываем родительский конструктор Entity
        super('ground_bag', {
            id: options.id || `bag_${options.roomId || 'room'}_${Date.now()}`,
            roomId: options.roomId,
            sprite: options.sprite || 'assets/sprites/ui/bag.png',
            width: options.width || 68,
            height: options.height || 68
        });
        
        // Координаты в комнате
        this.gridX = options.gridX || 0;
        this.gridY = options.gridY || 0;
        
        // Контейнер для предметов
        this.container = options.container || new EntityContainer();
        
        // Ссылка на GameState для событий
        this.gameState = options.gameState || null;
        
        // Состояние (всегда alive, пока есть предметы)
        this.state = 'alive';
    }
    
    /**
     * Добавить предмет в мешок
     * @param {Item} item - предмет
     * @returns {boolean} успех операции
     */
    addItem(item) {
        if (!item) return false;
        
        const result = this.container.addItem(item);
        
        if (result && this.gameState?.eventBus) {
            this.gameState.eventBus.emit('bag:updated', {
                bagId: this.id,
                roomId: this.roomId,
                itemCount: this.container.getItemCount()
            });
            
            this.gameState.eventBus.emit('room:entitiesUpdated', {
                roomId: this.roomId,
                entities: window.game?.zoneManager?.getRoomEntitiesInfo(this.roomId)
            });
            
            // Принудительный рендер
            if (window.game?.graphicsEngine) {
                window.game.graphicsEngine.render();
            }
        }
        
        return result;
    }
    /**
     * Удалить предмет из мешка по instanceId
     * @param {string} instanceId - уникальный ID экземпляра предмета
     * @returns {Item|null} удаленный предмет
     */
    removeItem(instanceId) {
        if (!instanceId) return null;
        
        // Находим индекс предмета по instanceId
        const items = this.container.getAllItems();
        let foundIndex = -1;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i] && items[i].instanceId === instanceId) {
                foundIndex = i;
                break;
            }
        }
        
        if (foundIndex === -1) return null;
        
        const item = this.container.removeItem(foundIndex);
        
        if (item && this.gameState?.eventBus) {
            this.gameState.eventBus.emit('bag:updated', {
                bagId: this.id,
                roomId: this.roomId,
                itemCount: this.container.getItemCount()
            });
            
            this.gameState.eventBus.emit('room:entitiesUpdated', {
                roomId: this.roomId,
                entities: window.game?.zoneManager?.getRoomEntitiesInfo(this.roomId)
            });
            
            if (window.game?.graphicsEngine) {
                window.game.graphicsEngine.render();
            }
            
            if (this.container.getItemCount() === 0) {
                this.remove();
            }
        }
        
        return item;
    }
    /**
     * Получить все предметы из мешка
     * @returns {Item[]} массив предметов
     */
    getItems() {
        return this.container.getAllItems();
    }
    
    /**
     * Получить количество предметов
     * @returns {number}
     */
    getItemCount() {
        return this.container.getItemCount();
    }
    
    /**
     * Проверить, пуст ли мешок
     * @returns {boolean}
     */
    isEmpty() {
        return this.container.getItemCount() === 0;
    }
    
    /**
     * Взять все предметы из мешка
     * @param {PlayerCharacter} player - игрок
     * @returns {Object} результат операции
     */
    takeAll(player) {
        if (!player) {
            return { success: false, message: 'Нет игрока' };
        }
        
        const items = this.getItems();
        const taken = [];
        const failed = [];
        
        for (const item of items) {
            // Клонируем предмет для инвентаря
            const itemCopy = item.clone ? item.clone() : item;
            const added = player.addItem(itemCopy);
            
            if (added) {
                taken.push(item);
            } else {
                failed.push(item);
            }
        }
        
        // Удаляем взятые предметы из мешка
        for (const item of taken) {
            this.container.removeItemById(item.instanceId);
        }
        
        if (this.gameState?.eventBus) {
            this.gameState.eventBus.emit('bag:updated', {
                bagId: this.id,
                roomId: this.roomId,
                itemCount: this.container.getItemCount()
            });
            
            this.gameState.eventBus.emit('room:entitiesUpdated', {
                roomId: this.roomId,
                entities: window.game?.zoneManager?.getRoomEntitiesInfo(this.roomId)
            });
            
            // Принудительный рендер
            if (window.game?.graphicsEngine) {
                window.game.graphicsEngine.render();
            }
        }
        
        // Если мешок опустел - удаляем
        if (this.container.getItemCount() === 0) {
            this.remove();
        }
        
        return {
            success: true,
            taken: taken.length,
            failed: failed.length,
            message: `Взято ${taken.length} предметов${failed.length > 0 ? `, ${failed.length} не влезло` : ''}`
        };
    }
    
    /**
     * Удалить мешок из комнаты
     */
    remove() {
        this.state = 'removed';
        
        // Сначала удаляем из ZoneManager
        if (window.game?.zoneManager) {
            window.game.zoneManager.removeEntity(this.id);
        }
        
        // Потом эмитим события (уже после фактического удаления)
        if (this.gameState?.eventBus) {
            this.gameState.eventBus.emit('bag:removed', {
                bagId: this.id,
                roomId: this.roomId
            });
            
            // Получаем актуальный список сущностей ПОСЛЕ удаления
            const entities = window.game?.zoneManager?.getRoomEntitiesInfo(this.roomId) || [];
            this.gameState.eventBus.emit('room:entitiesUpdated', {
                roomId: this.roomId,
                entities: entities
            });
        }
    }
    
    /**
     * Получить информацию для UI
     * @returns {Object}
     */
    getInfo() {
        const containerInfo = this.container.getInfo();
        
        return {
            id: this.id,
            type: this.type,
            name: 'Мешок с предметами',
            sprite: this.sprite,
            gridX: this.gridX,
            gridY: this.gridY,
            itemCount: containerInfo.itemCount,
            items: containerInfo.items,
            totalWeight: containerInfo.totalWeight,
            state: this.state,
            width: this.width,
            height: this.height
        };
    }
    
    /**
     * Сериализация для сохранений
     * @returns {Object}
     */
    toJSON() {
        return {
            ...super.toJSON(),
            gridX: this.gridX,
            gridY: this.gridY,
            container: this.container.toJSON()
        };
    }
    
    /**
     * Загрузка из сохранения
     * @param {Object} data
     * @param {GameState} gameState
     * @returns {GroundBag}
     */
    static fromJSON(data, gameState) {
        const bag = new GroundBag({
            id: data.id,
            roomId: data.roomId,
            gridX: data.gridX,
            gridY: data.gridY,
            container: EntityContainer.fromJSON(data.container),
            gameState: gameState
        });
        
        bag.state = data.state;
        bag.createdAt = data.createdAt;
        
        return bag;
    }
}

export { GroundBag };
// core/Entity.js
/**
 * Базовый класс для всех сущностей в игровом мире.
 * 
 * Что такое сущность:
 * - Игрок (Player)
 * - Враг (NonPlayerCharacter)
 * - Труп (состояние 'corpse')
 * - Предмет на земле (возможно позже)
 * 
 * Принципы:
 * 1. Все сущности хранятся в комнатах (ZoneManager)
 * 2. Имеют состояние, которое определяет их поведение
 * 3. Имеют контейнер с инвентарем и экипировкой
 */
import { EntityContainer } from './EntityContainer.js';

class Entity {
    /**
     * @param {string} type - 'player' | 'enemy' | 'item'
     * @param {Object} options
     * @param {string} options.id - если нужно задать конкретный ID
     * @param {string} options.roomId - комната создания
     * @param {Object} options.container - готовый контейнер (для загрузки)
     */
    constructor(type, options = {}) {
        // === ОСНОВНЫЕ ПОЛЯ ===
        /** @type {string} Уникальный идентификатор */
        this.id = options.id || this._generateId();
        
        /** @type {string} Тип сущности: 'player' | 'enemy' | 'item' */
        this.type = type;
        
        /** @type {string} Состояние: 'alive' | 'corpse' | 'removed' */
        this.state = 'alive';
        
        /** @type {string|null} ID комнаты, где находится сущность */
        this.roomId = options.roomId || null;
        
        // === КОНТЕЙНЕР (инвентарь + экипировка) ===
        /** @type {EntityContainer} */
        this.container = options.container || new EntityContainer();
        
        // === МЕТАДАННЫЕ ===
        /** @type {number} Время создания (timestamp) */
        this.createdAt = Date.now();
    }

    /**
     * Генерирует уникальный ID для сущности
     * @private
     */
    _generateId() {
        return `${this.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Получить информацию для UI (абстрактный метод)
     * Должен быть переопределён в наследниках
     */
    getInfo() {
        throw new Error('Метод getInfo() должен быть переопределён в наследнике');
    }

    /**
     * Проверить, жива ли сущность
     */
    isAlive() {
        return this.state === 'alive';
    }

    /**
     * Проверить, является ли сущность трупом
     */
    isCorpse() {
        return this.state === 'corpse';
    }

    /**
     * Убить сущность (превратить в труп)
     */
    die() {
        if (this.state !== 'alive') return false;
        this.state = 'corpse';
        return true;
    }

    /**
     * Удалить сущность (полностью убрать из мира)
     */
    remove() {
        this.state = 'removed';
    }

    /**
     * Сериализация для сохранений
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            state: this.state,
            roomId: this.roomId,
            container: this.container.toJSON(),
            createdAt: this.createdAt
        };
    }

    /**
     * Загрузка из сохранения
     * @param {Object} data
     * @returns {Entity}
     */
    static fromJSON(data) {
        const EntityContainer = require('./EntityContainer.js').EntityContainer;
        
        const entity = new Entity(data.type, {
            id: data.id,
            roomId: data.roomId,
            container: EntityContainer.fromJSON(data.container)
        });
        
        entity.state = data.state;
        entity.createdAt = data.createdAt;
        
        return entity;
    }
}

export { Entity };
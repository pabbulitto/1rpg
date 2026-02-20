// core/PlayerCharacter.js
import { Character } from './Character.js';
import { EntityContainer } from './EntityContainer.js';

/**
 * Персонаж игрока
 * - Работает через GameState как центральное хранилище
 * - Использует EntityContainer для инвентаря и экипировки
 * - Наследует Character для общих методов (состояния, атаки, способности)
 */
class PlayerCharacter extends Character {
    /**
     * @param {GameState} gameState - центральное состояние игры
     * @param {Object} dependencies - зависимости (eventBus, equipmentService и т.д.)
     */
    constructor(gameState, dependencies = {}) {
        // Передаём зависимости в родительский Character
        super({
            eventBus: gameState?.getEventBus() || dependencies.eventBus,
            equipmentService: dependencies.equipmentService,
            abilityService: dependencies.abilityService,
            itemService: dependencies.itemService,
            battleSystem: dependencies.battleSystem
        });
        
        /** @type {GameState} Ссылка на состояние игры */
        this.gameState = gameState;
        
        /** @type {string} Имя персонажа */
        this.name = gameState?.getPlayer()?.name || 'Герой';
        
        /** @type {number} Уровень */
        this.level = gameState?.getPlayer()?.level || 1;
        this.type = 'player';
        // === КОНТЕЙНЕР ИЗ GAMESTATE ===
        /** @type {EntityContainer} Контейнер с инвентарем и экипировкой */
        this.container = gameState ? gameState.getPlayerContainer() : new EntityContainer();
        
        // === БОЕВЫЕ ПАРАМЕТРЫ ===
        this.battleSystem = dependencies.battleSystem || null;
        this.selectedAbility = null;
        
        // === СОСТОЯНИЯ (для эффектов) ===
        this.activeEffects = []; // будут загружены из GameState при необходимости
    }
    
    // ========== ПОЛУЧЕНИЕ ХАРАКТЕРИСТИК ==========
    
    /**
     * Получить характеристики из GameState
     * @returns {Object} характеристики игрока
     */
    getStats() {
        return this.gameState?.getPlayer() || {};
    }
    
    /**
     * Получить StatManager из GameState
     * @returns {StatManager}
     */
    getStatManager() {
        return this.gameState?.getStatManager();
    }
    
    // ========== УПРАВЛЕНИЕ РЕСУРСАМИ ==========
    
    /**
     * Получить урон
     * @param {number} damage - количество урона
     * @returns {Object} результат получения урона
     */
    takeDamage(damage) {
        if (!this.gameState) return super.takeDamage(damage);
        
        const playerStats = this.getStats();
        const damageReduction = playerStats.damageReduction || 0;
        const reducedDamage = Math.max(1, Math.floor(damage * (1 - damageReduction / 100)));
        
        const statManager = this.getStatManager();
        const currentHealth = statManager?.getResource('health') || 0;
        const newHealth = Math.max(0, currentHealth - reducedDamage);
        
        statManager?.setResource('health', newHealth);
        this.gameState.getEventBus()?.emit('player:statsChanged', this.getStats());
        
        // Если здоровье кончилось - умираем
        if (newHealth <= 0) {
            this.die();
        }
        
        return {
            damage: reducedDamage,
            isDead: newHealth <= 0,
            healthRemaining: newHealth
        };
    }
    
    /**
     * Восстановить здоровье
     * @param {number} amount - количество лечения
     * @returns {number} реально восстановленное здоровье
     */
    heal(amount) {
        if (!this.gameState) return 0;
        
        const statManager = this.getStatManager();
        const currentHealth = statManager?.getResource('health') || 0;
        const maxHealth = statManager?.getFinalStats()?.maxHealth || 0;
        
        const newHealth = Math.min(maxHealth, currentHealth + amount);
        statManager?.setResource('health', newHealth);
        
        this.gameState.getEventBus()?.emit('player:statsChanged', this.getStats());
        
        return newHealth - currentHealth;
    }
    
    /**
     * Потратить выносливость
     * @param {number} amount - количество выносливости
     * @returns {Object} результат операции
     */
    takeStamina(amount) {
        if (!this.gameState) return { success: false };
        
        const statManager = this.getStatManager();
        const currentStamina = statManager?.getResource('stamina') || 0;
        
        if (currentStamina < amount) {
            return { 
                success: false, 
                staminaRemaining: currentStamina,
                needed: amount
            };
        }
        
        const newStamina = statManager?.modifyResource('stamina', -amount);
        this.gameState.getEventBus()?.emit('player:statsChanged', this.getStats());
        
        return { 
            success: true, 
            staminaRemaining: newStamina,
            staminaUsed: amount
        };
    }
    
    /**
     * Получить опыт
     * @param {number} amount - количество опыта
     * @returns {Object} результат { levelsGained }
     */
    gainExp(amount) {
        if (!this.gameState) return { levelsGained: 0 };
        return this.gameState.addExp(amount);
    }
    
    // ========== РАБОТА С ИНВЕНТАРЕМ (через контейнер) ==========
    
    /**
     * Добавить предмет в инвентарь
     * @param {Item} item - предмет
     * @returns {boolean} успех операции
     */
    addItem(item) {
        return this.container ? this.container.addItem(item) : false;
    }
    
    /**
     * Удалить предмет из инвентаря
     * @param {number} index - индекс предмета
     * @returns {Item|null} удаленный предмет
     */
    removeItem(index) {
        return this.container ? this.container.removeItem(index) : null;
    }
    
    /**
     * Получить предмет из инвентаря
     * @param {number} index - индекс предмета
     * @returns {Item|null} предмет
     */
    getItem(index) {
        return this.container ? this.container.getItem(index) : null;
    }
    
    /**
     * Получить все предметы инвентаря
     * @returns {Item[]} массив предметов
     */
    getInventoryItems() {
        return this.container ? this.container.getAllItems() : [];
    }
    
    // ========== ЭКИПИРОВКА (через контейнер) ==========
    
    /**
     * Получить всю экипировку
     * @returns {Object} объект со слотами
     */
    getEquipment() {
        return this.container ? this.container.getAllEquipment() : {};
    }
    
    /**
     * Экипировать предмет
     * @param {Item} item - предмет
     * @param {string} slot - целевой слот (опционально)
     * @returns {Object} результат операции
     */
    equipItem(item, slot = null) {
        if (!this.container || !this.equipmentService) {
            return { success: false, message: 'Контейнер или EquipmentService не доступен' };
        }
        
        const actualSlot = slot || item.slot;
        if (!actualSlot) {
            return { success: false, message: 'Предмет нельзя экипировать' };
        }
        
        const result = this.container.equip(item, actualSlot, this.equipmentService);
        
        if (result.success && this.getStatManager()) {
            // Применяем модификаторы экипировки
            this.equipmentService.applyEquipmentModifiers.call({
                statManager: this.getStatManager(),
                eventBus: this.eventBus,
                gameState: this.gameState
            }, actualSlot, item);
            
            this.gameState.getEventBus()?.emit('player:equipmentChanged', { 
                slot: actualSlot, 
                item: item 
            });
        }
        
        return result;
    }
    
    /**
     * Снять предмет с экипировки
     * @param {string} slot - слот
     * @returns {Item|null} снятый предмет
     */
    unequipItem(slot) {
        if (!this.container) return null;
        
        const item = this.container.unequip(slot);
        
        if (item && this.getStatManager()) {
            this.equipmentService.applyEquipmentModifiers.call({
                statManager: this.getStatManager(),
                eventBus: this.eventBus,
                gameState: this.gameState
            }, slot, null);
            
            this.gameState.getEventBus()?.emit('player:equipmentChanged', { 
                slot: slot, 
                item: null 
            });
        }
        
        return item;
    }

    useItem(index) {
        const items = this.gameState.playerContainer.getAllItems();
        if (index < 0 || index >= items.length) {
            return { success: false, message: "Предмет не найден" };
        }
        
        const item = items[index];
        const useResult = item.use(this);
        
        if (useResult.success) {
            // ===== ИСПРАВЛЕНО: уменьшаем количество =====
            if (item.stackable && item.count > 1) {
                item.count--;
            } else {
                this.gameState.playerContainer.removeItem(index);
            }
            
            this.gameState.eventBus.emit('inventory:updated', 
                this.gameState.playerContainer.getInfo());
            this.gameState.eventBus.emit('player:statsChanged', this.gameState.getPlayer());
        }
        
        return useResult;
    }
    /**
     * Бросить предмет на землю
     * @param {number} index - индекс предмета в инвентаре
     * @returns {Object} результат операции
     */
    dropItem(index) {
        const items = this.gameState.playerContainer.getAllItems();
        if (index < 0 || index >= items.length) {
            return { success: false, message: "Предмет не найден" };
        }
        
        const item = items[index];
        
        // Удаляем предмет из инвентаря
        const removedItem = this.gameState.playerContainer.removeItem(index);
        if (!removedItem) {
            return { success: false, message: "Не удалось удалить предмет" };
        }
        
        // TODO: Создать предмет на земле в текущей комнате
        // Пока просто логируем
        console.log(`Предмет ${item.name} брошен на землю в комнате ${this.gameState.getPosition().room}`);
        
        // Обновляем UI
        this.gameState.eventBus.emit('inventory:updated', 
            this.gameState.playerContainer.getInfo());
        this.gameState.eventBus.emit('player:statsChanged', this.gameState.getPlayer());
        
        return { 
            success: true, 
            message: `Вы бросили ${item.name} на землю`
        };
    }
    equipItemFromInventory(index) {
        const items = this.gameState.playerContainer.getAllItems();
        if (index < 0 || index >= items.length) {
            return { success: false, message: "Предмет не найден" };
        }
        const item = items[index];
        return this.equipItem(item);
    }

    // ========== УПРАВЛЕНИЕ ЭФФЕКТАМИ ==========
    
    /**
     * Добавить эффект
     * @param {BaseEffect} effect - эффект
     */
    addEffect(effect) {
        if (!effect || !effect.id) return false;
        
        // Проверяем, есть ли уже такой эффект
        const existingIndex = this.activeEffects.findIndex(e => e.id === effect.id);
        
        if (existingIndex >= 0) {
            // Если эффект с таким ID уже есть - пробуем добавить стак
            const existing = this.activeEffects[existingIndex];
            if (existing.addStack) {
                existing.addStack(1);
            }
            return false;
        } else {
            // Новый эффект
            this.activeEffects.push(effect);
            
            if (effect.apply) {
                effect.apply(this);
            }
            
            this.gameState?.getEventBus()?.emit('effect:applied', {
                effect: effect.getInfo ? effect.getInfo() : effect,
                target: this.id
            });
            
            return true;
        }
    }
    
    /**
     * Удалить эффект
     * @param {string} effectId - ID эффекта
     * @returns {boolean} успех операции
     */
    removeEffect(effectId) {
        const index = this.activeEffects.findIndex(e => e.id === effectId);
        if (index >= 0) {
            const effect = this.activeEffects[index];
            
            if (effect.remove) {
                effect.remove(this);
            }
            
            this.activeEffects.splice(index, 1);
            
            this.gameState?.getEventBus()?.emit('effect:removed', {
                effectId: effectId,
                target: this.id
            });
            
            return true;
        }
        return false;
    }
    
    /**
     * Получить все активные эффекты
     * @returns {Array} массив эффектов
     */
    getActiveEffects() {
        return [...this.activeEffects];
    }
    
    /**
     * Проверить наличие эффекта
     * @param {string} effectId - ID эффекта
     * @returns {boolean}
     */
    hasEffect(effectId) {
        return this.activeEffects.some(e => e.id === effectId);
    }
    
    // ========== ИНФОРМАЦИЯ ДЛЯ UI ==========
    
    /**
     * Получить информацию для UI
     * @returns {Object} информация о персонаже
     */
    getInfo() {
        const stats = this.getStats();
        const containerInfo = this.container ? this.container.getInfo() : { items: [], equipment: {} };
        
        return {
            id: this.id,
            name: this.name,
            level: this.level,
            state: this.state,
            type: this.type, 
            health: stats.health || 0,
            maxHealth: stats.maxHealth || 0,
            armorClass: stats.armorClass || 10,
            attack: stats.attack || 0,
            gold: stats.gold || 0,
            exp: stats.exp || 0,
            expToNext: stats.expToNext || 100,
            stats: { ...stats },
            proficiencies: Array.from(this.proficiencies),
            activeEffects: this.activeEffects.map(e => e.getInfo?.() || e),
            // Данные из контейнера
            inventory: containerInfo.items,
            equipment: containerInfo.equipment,
            inventoryCount: containerInfo.itemCount || 0,
            totalWeight: containerInfo.totalWeight || 0,
            // Для обратной совместимости
            gameState: 'player'
        };
    }
    /**
     * Забрать все предметы из трупа (доступно только в состоянии corpse)
     */
    lootAll() {
        if (this.state !== 'corpse') {
            console.warn('PlayerCharacter: попытка лутать живого игрока');
            return { items: [], equipment: {} };
        }
        
        const items = this.container.getAllItems();
        const equipment = this.container.getAllEquipment();
        
        this.container.clear();
        
        if (window.game?.gameState?.eventBus) {
            window.game.gameState.eventBus.emit('inventory:updated', this.container.getInfo());
        }
        
        return { items, equipment };
    }

    /**
     * Забрать конкретный предмет из инвентаря трупа
     */
    lootItem(index) {
        if (this.state !== 'corpse') return null;
        return this.container.removeItem(index);
    }

    /**
     * Снять предмет экипировки с трупа
     */
    lootEquipment(slot) {
        if (this.state !== 'corpse') return null;
        return this.container.unequip(slot);
    }

    /**
     * Поднять труп как предмет
     */
    pickupCorpse(gameState) {
        if (this.state !== 'corpse') return null;
        
        const corpseItem = window.itemFactory?.create('corpse', 1, {
            originalCreature: this.getInfo(),
            lootContainer: this.container.toJSON(),
            weight: 5 + this.container.getTotalWeight(),
            name: `Труп ${this.name}`
        });
        
        return corpseItem;
    }
    // ========== СЕРИАЛИЗАЦИЯ ==========
    
    /**
     * Сериализация для сохранений
     * @returns {Object} данные для сохранения
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            level: this.level,
            state: this.state,
            proficiencies: Array.from(this.proficiencies),
            activeEffects: this.activeEffects.map(effect => {
                if (effect.getInfo) {
                    return {
                        ...effect.getInfo(),
                        className: effect.constructor.name
                    };
                }
                return effect;
            }),
            // Контейнер сохраняется отдельно в GameState
        };
    }
    
    /**
     * Загрузка из сохранения
     * @param {Object} data - данные из сохранения
     * @param {GameState} gameState - состояние игры
     */
    fromJSON(data, gameState) {
        this.id = data.id || this.id;
        this.name = data.name || this.name;
        this.level = data.level || 1;
        this.state = data.state || 'alive';
        
        if (data.proficiencies) {
            this.proficiencies = new Set(data.proficiencies);
        }
        
        // Эффекты будут загружены через GameState
        if (data.activeEffects) {
            // Здесь можно добавить восстановление эффектов
            this.activeEffects = [];
        }
        
        // Контейнер уже загружен в GameState
        this.gameState = gameState;
        this.container = gameState?.getPlayerContainer() || this.container;
    }
}

export { PlayerCharacter };
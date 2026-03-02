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
        
        /** @type {string} Класс персонажа */
        this.class = null; 

        /** @type {string} Раса персонажа */
        this.race = null;


        /** @type {Object} Итоговые базовые характеристики после создания */
        this.finalBaseStats = null;
                
        /** @type {number} Уровень */
        this.level = gameState?.getPlayer()?.level || 1;
        
        /** @type {number} Текущий опыт */
        this.exp = gameState?.getPlayer()?.exp || 0;
        
        /** @type {number} Количество перевоплощений */
        this.reincarnations = 0;
        
        this.type = 'player';
        // Спрайт персонажа из класса в main.js
        this.sprite = null;
        this.portrait = null;
        this.width = 85;
        this.height = 85;
        
        // === КОНТЕЙНЕР ИЗ GAMESTATE ===
        /** @type {EntityContainer} Контейнер с инвентарем и экипировкой */
        this.container = gameState ? gameState.getPlayerContainer() : new EntityContainer();
        
        // === БОЕВЫЕ ПАРАМЕТРЫ ===
        this.battleSystem = dependencies.battleSystem || null;
        this.selectedAbility = null;
        
        // === СОСТОЯНИЯ (для эффектов) ===
        this.activeEffects = []; // будут загружены из GameState при необходимости

        this.corpseSprite = 'assets/sprites/items/corpse1.png';
    }

    /**
     * Базовые пропорции опыта для 50 уровней (сумма = 2.5M)
     * @returns {number[]}
     */
    static getBaseExpProportions() {
        return [
            500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 25000,
            30000, 35000, 40000, 45000, 50000, 55000, 60000, 65000, 70000, 75000,
            80000, 85000, 90000, 95000, 100000, 100000, 100000, 100000, 100000, 100000,
            100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000,
            100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000
        ];
    }

    /**
     * Множитель опыта в зависимости от класса
     * @returns {number}
     */
    getClassExpMultiplier() {
        if (!this.class) return 1.0;
        // Получаем данные класса из DataService
        const classData = window.game?.dataService?.getProfessionData(this.class);
        return classData?.expMultiplier || 1.0;
    }

    /**
     * Получить общий множитель с учетом перевоплощений
     * @returns {number}
     */
    getTotalExpMultiplier() {
        const classMultiplier = this.getClassExpMultiplier();
        const reincMultiplier = Math.pow(1.35, this.reincarnations);
        return classMultiplier * reincMultiplier;
    }

    /**
     * Опыт, необходимый для достижения следующего уровня
     * @returns {number}
     */
    getExpForNextLevel() {
        if (this.level >= 51) return 0;
        
        const proportions = PlayerCharacter.getBaseExpProportions();
        const multiplier = this.getTotalExpMultiplier();
        
        return Math.floor(proportions[this.level - 1] * multiplier);
    }

    /**
     * Общий опыт, необходимый для достижения 51 уровня при текущем перевоплощении
     * @returns {number}
     */
    getTotalExpForCurrentReinc() {
        const proportions = PlayerCharacter.getBaseExpProportions();
        const multiplier = this.getTotalExpMultiplier();
        
        const total = proportions.reduce((sum, exp) => sum + exp, 0);
        return Math.floor(total * multiplier);
    }

    gainExp(amount) {
        if (!this.gameState) return { levelsGained: 0 };
        
        let remainingExp = amount;
        let levelsGained = 0;
        
        while (remainingExp > 0 && this.level < 51) {
            const expNeeded = this.getExpForNextLevel() - this.exp;
            
            if (remainingExp >= expNeeded) {
                remainingExp -= expNeeded;
                this.exp = 0;
                this.level++;
                levelsGained++;
                
                // ===== ПРИРОСТ ХАРАКТЕРИСТИК ПРИ ПОВЫШЕНИИ УРОВНЯ =====
                const statManager = this.getStatManager();
                if (statManager) {
                    const currentStats = statManager.getFinalStats();
                    const baseStats = statManager.getBaseStats();
                    
                    const healthPerLevel = currentStats.healthPerLevel || 4;
                    const newBaseHealth = (baseStats.baseHealth || 20) + healthPerLevel;
                    
                    const manaPerLevel = currentStats.manaPerLevel || 3;
                    const newBaseMana = (baseStats.baseMana || 20) + manaPerLevel;
                    
                    const dexterityMod = currentStats.dexterityMod || 0;
                    const staminaPerLevel = 5 + dexterityMod;
                    const newBaseStamina = (baseStats.baseStamina || 25) + staminaPerLevel;
                    
                    statManager.baseStats.baseHealth = newBaseHealth;
                    statManager.baseStats.baseMana = newBaseMana;
                    statManager.baseStats.baseStamina = newBaseStamina;
                    
                    statManager.needsRecalculation = true;
                }                
                // Событие повышения уровня
                this.gameState.getEventBus().emit('player:levelUp', {
                    newLevel: this.level,
                    reincarnations: this.reincarnations
                });
            } else {
                this.exp += remainingExp;
                remainingExp = 0;
            }
        }
        
        if (this.level === 51) {
            this.exp = 0;
        }
        
        if (levelsGained > 0 || amount > 0) {
            this.gameState.getEventBus().emit('player:statsChanged', this.getStats());
        }
        
        return { levelsGained };
    }
    /**
     * Перевоплотиться (сбросить уровень с усилением)
     * @returns {Object} результат операции
     */
    reincarnate() {
        if (this.level < 51) {
            return { success: false, message: "Нужно достичь 51 уровня" };
        }
        
        this.reincarnations++;
        this.level = 1;
        this.exp = 0;
        
        // +1 ко всем характеристикам
        const statManager = this.getStatManager();
        if (statManager) {
            statManager.baseStats.strength += 1;
            statManager.baseStats.dexterity += 1;
            statManager.baseStats.constitution += 1;
            statManager.baseStats.intelligence += 1;
            statManager.baseStats.wisdom += 1;
            statManager.baseStats.charisma += 1;
            
            statManager.needsRecalculation = true;
        }
        
        this.gameState.getEventBus().emit('player:statsChanged', this.getStats());
        this.gameState.getEventBus().emit('log:add', {
            message: `✨ Перевоплощение ${this.reincarnations}! Характеристики +1`,
            type: 'success'
        });
        
        return { 
            success: true, 
            reincarnations: this.reincarnations,
            message: `Перевоплощение ${this.reincarnations}`
        };
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
     * @param {Object} options - опции { isCritical: boolean }
     * @returns {Object} результат получения урона
     */
    takeDamage(damage, options = {}) {
        if (!this.gameState) return super.takeDamage(damage, options);
        
        // Вызываем родительский метод с опциями
        const result = super.takeDamage(damage, options);
        
        // Эмитим событие для UI
        this.gameState.getEventBus()?.emit('player:statsChanged', this.getStats());
        
        // Если здоровье кончилось - дополнительная логика
        if (result.isDead) {
            this.die();
        }
        
        return result;
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
        
        const result = this.container.equip(item, actualSlot, this.equipmentService, this);
        
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

    /**
     * Использовать предмет из инвентаря
     * @param {number} index - индекс предмета
     * @returns {Object} результат использования
     */
    useItem(index) {
        const items = this.gameState.playerContainer.getAllItems();
        if (index < 0 || index >= items.length) {
            return { success: false, message: "Предмет не найден" };
        }
        
        const item = items[index];
        const useResult = item.use(this);
        
        if (useResult.success) {
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
     * Бросить предмет на землю (в мешок)
     * @param {number} index - индекс предмета в инвентаре
     * @returns {Object} результат операции
     */
    dropItem(index) {
        const items = this.gameState.playerContainer.getAllItems();
        if (index < 0 || index >= items.length) {
            return { success: false, message: "Предмет не найден" };
        }
        
        const item = items[index];
            // Проверяем, является ли предмет трупом
        if (item.type === 'corpse') {
            // Удаляем предмет из инвентаря
            const removedItem = this.gameState.playerContainer.removeItem(index);
            if (!removedItem) {
                return { success: false, message: "Не удалось удалить предмет" };
            }
            
            // Создаем труп в комнате через ZoneManager
            const zoneManager = window.game?.zoneManager;
            if (!zoneManager) {
                this.gameState.playerContainer.addItem(removedItem);
                return { success: false, message: "Ошибка: не удалось найти менеджер зон" };
            }
            
            const corpse = zoneManager.createCorpseFromItem(
                removedItem, 
                this.gridX, 
                this.gridY, 
                this.id
            );
            
            if (!corpse) {
                // Если не удалось создать труп (нет места) - возвращаем предмет
                this.gameState.playerContainer.addItem(removedItem);
                return { 
                    success: false, 
                    message: "Нет места для трупа в этой комнате" 
                };
            }
            
            // Обновляем UI
            this.gameState.eventBus.emit('inventory:updated', 
                this.gameState.playerContainer.getInfo());
            this.gameState.eventBus.emit('player:statsChanged', this.gameState.getPlayer());
            
            return { 
                success: true, 
                message: `Вы бросили ${item.name} на землю`
            };
        }
        // Удаляем предмет из инвентаря
        const removedItem = this.gameState.playerContainer.removeItem(index);
        if (!removedItem) {
            return { success: false, message: "Не удалось удалить предмет" };
        }
        
        // Получаем текущую комнату
        const roomId = this.gameState.getPosition().room;
        const zoneManager = window.game?.zoneManager;
        
        if (!zoneManager) {
            // Если нет ZoneManager - возвращаем предмет обратно
            this.gameState.playerContainer.addItem(removedItem);
            return { success: false, message: "Ошибка: не удалось найти менеджер зон" };
        }
        
        // Ищем или создаем мешок в комнате
        const bag = zoneManager.findOrCreateBag(roomId, this.gridX, this.gridY);
        
        if (!bag) {
            // Если не удалось создать мешок (нет места) - возвращаем предмет
            this.gameState.playerContainer.addItem(removedItem);
            return { 
                success: false, 
                message: "Нет места для мешка в этой комнате" 
            };
        }
        
        // Добавляем предмет в мешок
        const added = bag.addItem(removedItem);
        
        if (!added) {
            // Если не влезло в мешок  - возвращаем предмет
            this.gameState.playerContainer.addItem(removedItem);
            return { success: false, message: "Не удалось положить предмет в мешок" };
        }
        
        // Обновляем UI
        this.gameState.eventBus.emit('inventory:updated', 
            this.gameState.playerContainer.getInfo());
        this.gameState.eventBus.emit('player:statsChanged', this.gameState.getPlayer());
        this.gameState.eventBus.emit('bag:updated', {
            bagId: bag.id,
            roomId: roomId
        });
        
        return { 
            success: true, 
            message: `Вы бросили ${item.name} на землю`
        };
    }

    /**
     * Экипировать предмет из инвентаря
     * @param {number} index - индекс предмета
     * @returns {Object} результат операции
     */
    equipItemFromInventory(index) {
        const items = this.gameState.playerContainer.getAllItems();
        if (index < 0 || index >= items.length) {
            return { success: false, message: "Предмет не найден" };
        }
        const item = items[index];
        return this.equipItem(item);
    }
    /**
     * Применить итоговые базовые характеристики после создания персонажа
     * @param {Object} finalBaseStats - объект с итоговыми характеристиками
     */
    applyFinalStats(finalBaseStats) {
        const statManager = this.getStatManager();
        if (!statManager) return;
        
        // Сохраняем текущие базовые ресурсы
        const currentBaseHealth = statManager.baseStats.baseHealth || 20;
        const currentBaseMana = statManager.baseStats.baseMana || 20;
        const currentBaseStamina = statManager.baseStats.baseStamina || 25;
        
        // Новые baseStats = статы из класса + старые базовые ресурсы
        statManager.baseStats = {
            ...finalBaseStats,
            baseHealth: currentBaseHealth,
            baseMana: currentBaseMana,
            baseStamina: currentBaseStamina
        };
        
        statManager.needsRecalculation = true;
        
        // Устанавливаем ресурсы в максимум
        const finalStats = statManager.getFinalStats();
        statManager.setResource('health', finalStats.maxHealth);
        statManager.setResource('mana', finalStats.maxMana);
        statManager.setResource('stamina', finalStats.maxStamina);
        
        this.finalBaseStats = { ...statManager.baseStats };
    }
    
    // ========== УПРАВЛЕНИЕ ЭФФЕКТАМИ ==========
    /**
     * Добавить эффект
     * @param {BaseEffect} effect - эффект
     */
    addEffect(effect) {
        if (!effect || !effect.id) return false;
        
        const existingIndex = this.activeEffects.findIndex(e => e.id === effect.id);
        
        if (existingIndex >= 0) {
            const existing = this.activeEffects[existingIndex];
            if (existing.addStack) {
                existing.addStack(1);
            }
            return false;
        } else {
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
            class: this.class,
            race: this.race,
            level: this.level,
            reincarnations: this.reincarnations,
            state: this.state,
            type: this.type, 
            health: stats.health || 0,
            maxHealth: stats.maxHealth || 0,
            armorClass: stats.armorClass || 10,
            attack: stats.attack || 0,
            gold: stats.gold || 0,
            exp: this.exp,
            expToNext: this.getExpForNextLevel(),
            totalExpForReinc: this.getTotalExpForCurrentReinc(),
            stats: { ...stats },
            proficiencies: Array.from(this.proficiencies),
            activeEffects: this.activeEffects.map(e => e.getInfo?.() || e),
            inventory: containerInfo.items,
            equipment: containerInfo.equipment,
            inventoryCount: containerInfo.itemCount || 0,
            totalWeight: containerInfo.totalWeight || 0,
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
        
        // Получаем предметы из контейнера (оригиналы)
        const items = this.container.getAllItems();
        const equipment = this.container.getAllEquipment();
        
        // Очищаем труп
        this.container.clear();
        
        // Оповещаем UI об изменении
        if (window.game?.gameState?.eventBus) {
            window.game.gameState.eventBus.emit('inventory:updated', this.container.getInfo());
            if (this.roomId) {
                const entities = window.game.zoneManager.getRoomEntitiesInfo(this.roomId);
                window.game.gameState.eventBus.emit('room:entitiesUpdated', {
                    roomId: this.roomId,
                    entities: entities
                });
            }
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
            class: this.class,
            race: this.race,
            finalBaseStats: this.finalBaseStats,
            level: this.level,
            exp: this.exp,
            reincarnations: this.reincarnations,
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
            })
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
        this.class = data.class || null;
        this.race = data.race || null;
        this.finalBaseStats = data.finalBaseStats || null;

        // Если есть сохранённые финальные статы - применяем их
        if (this.finalBaseStats) {
            const statManager = this.getStatManager();
            if (statManager) {
                statManager.baseStats = { ...this.finalBaseStats };
                statManager.needsRecalculation = true;
            }
        }
        this.level = data.level || 1;
        this.exp = data.exp || 0;
        this.reincarnations = data.reincarnations || 0;
        this.state = data.state || 'alive';
        
        if (data.proficiencies) {
            this.proficiencies = new Set(data.proficiencies);
        }
        
        if (data.activeEffects) {
            this.activeEffects = [];
        }
        
        this.gameState = gameState;
        this.container = gameState?.getPlayerContainer() || this.container;
    }
}

export { PlayerCharacter };
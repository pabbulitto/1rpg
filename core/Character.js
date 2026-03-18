// core/Character.js
/**
 * Абстрактный базовый класс для всех персонажей
 * - Игрок (PlayerCharacter)
 * - Враги (NonPlayerCharacter)
 * - NPC (NonPlayerCharacter)
 * 
 * Содержит ТОЛЬКО общие для всех поля и методы.
 * НЕ содержит логики "если игрок — делай так, если враг — иначе".
 */
import { mechanics } from '../system/mechanics.js';

class Character {
    constructor(dependencies = {}) {
        // Инверсия зависимостей — всё передаётся извне
        this.eventBus = dependencies.eventBus || null;
        this.equipmentService = dependencies.equipmentService || null;
        this.abilityService = dependencies.abilityService || null;
        
        // УНИКАЛЬНЫЙ ID (сохраняем старый формат)
        this.id = `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // === НОВОЕ: СОСТОЯНИЕ СУЩНОСТИ ===
        /** @type {string} 'alive' | 'corpse' | 'removed' */
        this.state = 'alive';
        
        // БАЗОВЫЕ ПОЛЯ
        this.name = 'Персонаж';
        this.level = 1;
        
        // ХАРАКТЕРИСТИКИ (у каждого своя реализация)
        this.statManager = null; // должен быть переопределён в наследниках
        
        // === ИЗМЕНЕНО: ЕДИНЫЙ КОНТЕЙНЕР ВМЕСТО inventory И equipment ===
        /** @type {EntityContainer} Контейнер с инвентарем и экипировкой */
        this.container = null; // будет создан в наследниках с правильными параметрами
        
        // СОСТОЯНИЯ
        this.activeEffects = [];  // массив BaseEffect
        this.proficiencies = new Set(); // навыки
        
        // БОЕВЫЕ ПАРАМЕТРЫ
        this.battleSystem = dependencies.battleSystem || null;
        this.selectedAbility = null;
        this.naturalWeapon = null; // для врагов
    }
    
    // --- АБСТРАКТНЫЕ МЕТОДЫ (ДОЛЖНЫ БЫТЬ ПЕРЕОПРЕДЕЛЕНЫ) ---
    
    /**
     * Получить текущие характеристики
     * @abstract
     */
    getStats() {
        throw new Error('Метод getStats() должен быть переопределён в наследнике');
    }
    
    /**
     * Получить менеджер характеристик
     * @abstract
     */
    getStatManager() {
        throw new Error('Метод getStatManager() должен быть переопределён в наследнике');
    }
    
    // --- ОБЩИЕ МЕТОДЫ ДЛЯ ВСЕХ ПЕРСОНАЖЕЙ ---
    /**
     * Получить урон
     * @param {number} damage - количество урона
     * @param {Object} options - опции { isCritical: boolean }
     * @returns {Object} результат получения урона
     */
    takeDamage(damage, options = {}) {
        const stats = this.getStats();
        if (!stats || stats.health === undefined) {
            return { damage: 0, isDead: true, healthRemaining: 0 };
        }
        
        let finalDamage = damage;
        
        // 1. Если это критический удар - применяем сопротивление критам
        if (options.isCritical) {
            const critResistance = stats.critResistance || 0;
            finalDamage = Math.floor(finalDamage * (1 - critResistance / 100));
        }
        
        // 2. Применяем обычное поглощение брони
        const damageReduction = stats.damageReduction || 0;
        const reducedDamage = Math.max(1, Math.floor(finalDamage * (1 - damageReduction / 100)));
        
        const newHealth = Math.max(0, stats.health - reducedDamage);
        this.getStatManager()?.setResource('health', newHealth);
        
        return {
            damage: reducedDamage,
            isDead: newHealth <= 0,
            healthRemaining: newHealth
        };
    }
    /**
     * Умереть (превратиться в труп)
     * @returns {boolean}
     */
    die() {
        if (this.state !== 'alive') return false;
            // Перед смертью перемещаем всю экипировку в инвентарь
        if (this.container) {
            const equipment = this.container.getAllEquipment();
            for (const [slot, item] of Object.entries(equipment)) {
                if (item) {
                    this.container.unequip(slot); 
                }
            }
        }
        this.originalSprite = this.sprite;
        // Меняем состояние на труп
        this.state = 'corpse';
        // Меняем спрайт на труп
        this.sprite = this.corpseSprite || 'assets/sprites/items/corpse.png';
        // ===== ИСПРАВЛЕНО: эмитим событие с актуальными данными =====
        if (this.eventBus) {
            // Определяем комнату, где находится персонаж
            const roomId = this.roomId || (this.gameState?.getPosition().room);
            if (roomId) {
                // Нужно получить актуальный список сущностей в комнате
                // Через game.zoneManager если доступно
                const game = window.game;
                if (game?.zoneManager) {
                    const entities = game.zoneManager.getRoomEntitiesInfo(roomId);
                    this.eventBus.emit('room:entitiesUpdated', {
                        roomId: roomId,
                        entities: entities
                    });
                } else {
                    // fallback если zoneManager недоступен
                    this.eventBus.emit('room:entitiesUpdated', {
                        roomId: roomId,
                        entities: []
                    });
                }
            }
        }
        return true;
    }
    /**
     * Проверить, жив ли персонаж
     * @returns {boolean}
     */
    isAlive() {
        return this.state === 'alive';
    }
    
    /**
     * Проверить, является ли персонаж трупом
     * @returns {boolean}
     */
    isCorpse() {
        return this.state === 'corpse';
    }
    
    /**
     * Получить информацию для UI/сохранений
     */
    getInfo() {
        const stats = this.getStats() || {};
        const containerInfo = this.container ? this.container.getInfo() : { items: [], equipment: {} };
        
        return {
            id: this.id,
            name: this.name,
            level: this.level,
            state: this.state,
            health: stats.health || 0,
            maxHealth: stats.maxHealth || 0,
            armorClass: stats.armorClass || 10,
            attack: stats.attack || 0,
            stats: { ...stats },
            proficiencies: Array.from(this.proficiencies),
            activeEffects: this.activeEffects.map(e => e.getInfo?.() || e),
            // Данные из контейнера
            inventory: containerInfo.items,
            equipment: containerInfo.equipment,
            inventoryCount: containerInfo.itemCount || 0,
            totalWeight: containerInfo.totalWeight || 0
        };
    }
    
    /**
     * Определить автоматические атаки (оружие + способности + природное оружие)
     */
    determineAutoAttacks() {
        const attacks = [];
        
        // Получаем экипировку из контейнера
        const equipment = this.container ? this.container.getAllEquipment() : {};
        const rightHand = equipment.right_hand;
        const leftHand = equipment.left_hand;
        
        //  1. ПРИРОДНОЕ ОРУЖИЕ (когти, клыки, жало)
        // Используется только если нет оружия в правой руке
        if (!rightHand && this.naturalWeapon) {
            attacks.push({
                hand: 'right',
                isNatural: true,
                isMain: true,
                isOffhand: false,
                weapon: null,
                damageFormula: this.naturalWeapon.damageFormula || '1d6',
                damageType: this.naturalWeapon.damageType || 'slashing',
                name: this.naturalWeapon.name || 'Природное оружие'
            });
        }
        
        // 2. АТАКА ПРАВОЙ РУКОЙ (оружие)
        if (rightHand && this._isWeapon(rightHand)) {
            attacks.push({
                hand: 'right',
                weapon: rightHand,
                isMain: true,
                isOffhand: false,
                damageFormula: rightHand.damage || '1d4'
            });
        }
        
        // 3. АТАКА ЛЕВОЙ РУКОЙ (оружие) 
        if (leftHand && this._isWeapon(leftHand)) {
            const isTwoHandedInRight = rightHand && rightHand.slot === 'two_handed';
            const isShield = leftHand.type === 'shield' || leftHand.properties?.includes('defensive');
            
            if (!isTwoHandedInRight && !isShield) {
                attacks.push({
                    hand: 'left',
                    weapon: leftHand,
                    isMain: false,
                    isOffhand: true,
                    damageFormula: leftHand.damage || '1d4'
                });
            }
        }
        
        //  4. ВЫБРАННАЯ СПОСОБНОСТЬ 
        if (this.selectedAbility && this.selectedAbility.canUse) {
            const canUseResult = this.selectedAbility.canUse(this);
            if (canUseResult.success) {
                this.selectedAbility.markAsUsed(this);
                
                attacks.push({
                    type: 'ability',
                    ability: this.selectedAbility,
                    hand: 'ability',
                    isMain: false,
                    isOffhand: false,
                    damageFormula: this.selectedAbility.damageFormula || '0'
                });
            }
        }
        
        //  5. НЕТ ОРУЖИЯ И НЕТ ПРИРОДНОГО ОРУЖИЯ = КУЛАКИ 
        if (attacks.length === 0) {
            attacks.push({
                hand: 'right',
                weapon: null,
                isMain: true,
                isOffhand: false,
                isUnarmed: true,
                damageFormula: '1d4'
            });
        }
        
        //  6. ЕСТЬ СПОСОБНОСТЬ, НО НЕТ ОРУЖИЯ = ДОБАВЛЯЕМ КУЛАК/ПРИРОДНОЕ 
        else if (attacks.length === 1 && attacks[0].type === 'ability') {
            // Если есть природное оружие — используем его
            if (this.naturalWeapon) {
                attacks.push({
                    hand: 'right',
                    isNatural: true,
                    isMain: true,
                    isOffhand: false,
                    weapon: null,
                    damageFormula: this.naturalWeapon.damageFormula || '1d6',
                    damageType: this.naturalWeapon.damageType || 'slashing',
                    name: this.naturalWeapon.name || 'Природное оружие'
                });
            } else {
                // Нет природного оружия — кулаки
                attacks.push({
                    hand: 'right',
                    weapon: null,
                    isMain: true,
                    isOffhand: false,
                    isUnarmed: true,
                    damageFormula: '1d4'
                });
            }
        }
        // 7. УДАР ЛЕВОЙ РУКОЙ через механику
        if (this.abilityService) {
            mechanics.leftHandStrike.modifyAttacks(this, attacks, this.abilityService);
        }
        
        return attacks;
    }
    
    /**
     * Экипировать предмет (делегирует в container)
     * @param {Item} item - предмет
     * @param {string} slot - слот
     * @returns {Object} результат
     */
    equipItem(item, slot) {
        if (!this.container || !this.equipmentService) {
            return { success: false, message: 'Контейнер или EquipmentService не доступен' };
        }
        
        const result = this.container.equip(item, slot, this.equipmentService, this);
        
        if (result.success && this.getStatManager()) {
            // Применяем модификаторы экипировки
            this.equipmentService.applyEquipmentModifiers.call({
                statManager: this.getStatManager(),
                eventBus: this.eventBus,
                gameState: null
            }, slot, item);
        }
        
        return result;
    }
    
    /**
     * Снять предмет (делегирует в container)
     * @param {string} slot
     * @returns {Item|null}
     */
    unequipItem(slot) {
        if (!this.container) return null;
        
        const item = this.container.unequip(slot);
        
        if (item && this.getStatManager()) {
            this.equipmentService.applyEquipmentModifiers.call({
                statManager: this.getStatManager(),
                eventBus: this.eventBus,
                gameState: null
            }, slot, null);
        }
        
        return item;
    }
    
    /**
     * Добавить предмет в инвентарь
     * @param {Item} item
     * @returns {boolean}
     */
    addItem(item) {
        return this.container ? this.container.addItem(item) : false;
    }
    
    /**
     * Удалить предмет из инвентаря по instanceId
     * @param {string} instanceId
     * @returns {Item|null}
     */
    removeItem(instanceId) {
        return this.container ? this.container.removeItemById(instanceId) : null;
    }

    /**
     * Получить предмет из инвентаря по instanceId
     * @param {string} instanceId
     * @returns {Item|null}
     */
    getItem(instanceId) {
        if (!instanceId || !this.container) return null;
        const items = this.container.getAllItems();
        return items.find(item => item && item.instanceId === instanceId) || null;
    }
    
    /**
     * Получить все предметы инвентаря
     * @returns {Item[]}
     */
    getInventoryItems() {
        return this.container ? this.container.getAllItems() : [];
    }
    
    /**
     * Получить экипировку
     * @returns {Object}
     */
    getEquipment() {
        return this.container ? this.container.getAllEquipment() : {};
    }
    
    // --- ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ---
    
    _createDefaultEquipment() {
        return {
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
    }
    
    _isWeapon(item) {
        return item && (item.type === 'weapon' || 
               item.weaponType !== undefined ||
               (item.properties && item.properties.includes('weapon')));
    }

    hasWeapon() {
        const equipment = this.getEquipment();
        return (equipment.right_hand && this._isWeapon(equipment.right_hand)) ||
            (equipment.left_hand && this._isWeapon(equipment.left_hand));
    }
    
    // --- УПРАВЛЕНИЕ СПОСОБНОСТЯМИ ---
    
    setSelectedAbility(ability) {
        this.selectedAbility = ability;
    }
    
    clearSelectedAbility() {
        this.selectedAbility = null;
    }
    
    /**
     * Добавить эффект к персонажу
     * @param {BaseEffect} effect - объект эффекта
     * @returns {boolean} успех операции
     */
    addEffect(effect) {
        if (!effect || !effect.id) return false;
        
        // Проверяем, есть ли уже такой эффект
        const existingIndex = this.activeEffects.findIndex(e => e.id === effect.id);
        
        if (existingIndex >= 0) {
            // Эффект уже есть - обновляем или добавляем стаки
            const existing = this.activeEffects[existingIndex];
            if (existing.addStack) {
                existing.addStack(1);
            }
            return false;
        } else {
            // Добавляем новый эффект
            this.activeEffects.push(effect);
            
            // Применяем эффект (модификаторы и т.д.)
            if (effect.apply) {
                effect.apply(this);
            }
            
            // Уведомляем UI
            if (this.eventBus) {
                this.eventBus.emit('effect:applied', {
                    effect: effect.getInfo ? effect.getInfo() : effect,
                    target: this.id
                });
            }
            
            return true;
        }
    }

    /**
     * Удалить эффект у персонажа
     * @param {string} effectId - ID эффекта
     * @returns {boolean} успех операции
     */
    removeEffect(effectId) {
        const index = this.activeEffects.findIndex(e => e.id === effectId);
        if (index >= 0) {
            const effect = this.activeEffects[index];
            
            // Снимаем эффект
            if (effect.remove) {
                effect.remove(this);
            }
            
            // Удаляем из массива
            this.activeEffects.splice(index, 1);
            
            // Уведомляем UI
            if (this.eventBus) {
                this.eventBus.emit('effect:removed', {
                    effectId: effectId,
                    target: this.id
                });
            }
            
            return true;
        }
        return false;
    }

    /**
     * Удалить эффект по источнику
     * @param {string} source - источник эффекта
     */
    removeEffectsBySource(source) {
        const toRemove = [];
        for (let i = 0; i < this.activeEffects.length; i++) {
            if (this.activeEffects[i].source === source) {
                toRemove.push(i);
            }
        }
        
        // Удаляем с конца, чтобы не сбивать индексы
        for (let i = toRemove.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[toRemove[i]];
            if (effect.remove) effect.remove(this);
            this.activeEffects.splice(toRemove[i], 1);
        }
    }

    /**
     * Проверить наличие эффекта
     * @param {string} effectId - ID эффекта
     * @returns {boolean}
     */
    hasEffect(effectId) {
        return this.activeEffects.some(e => e.id === effectId);
    }
    /**
     * Проверить, есть ли у персонажа эффект, блокирующий побег
     * @returns {boolean} true если есть блокирующий эффект
     */
    hasBlockingEffect() {
        for (const effect of this.activeEffects) {
            if (effect.flags && effect.flags.blocksEscape === true) {
                return true;
            }
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
     * Обработать эффекты (вызывается каждый ход)
     */
    processEffects() {
        const expired = [];
        
        for (let i = 0; i < this.activeEffects.length; i++) {
            const effect = this.activeEffects[i];
            if (effect.onTimeTick) {
                const result = effect.onTimeTick();
                if (result === 'expired') {
                    expired.push(i);
                }
            }
        }
        
        // Удаляем истекшие эффекты (с конца)
        for (let i = expired.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[expired[i]];
            if (effect.remove) effect.remove(this);
            this.activeEffects.splice(expired[i], 1);
        }
    }
}

export { Character };
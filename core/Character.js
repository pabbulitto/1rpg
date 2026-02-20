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
class Character {
    constructor(dependencies = {}) {
        // Инверсия зависимостей — всё передаётся извне
        this.eventBus = dependencies.eventBus || null;
        this.equipmentService = dependencies.equipmentService || null;
        this.abilityService = dependencies.abilityService || null;
        this.itemService = dependencies.itemService || null;
        
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
     */
    takeDamage(damage) {
        const stats = this.getStats();
        if (!stats || stats.health === undefined) {
            return { damage: 0, isDead: true, healthRemaining: 0 };
        }
        
        const newHealth = Math.max(0, stats.health - damage);
        this.getStatManager()?.setResource('health', newHealth);
        
        return {
            damage: damage,
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
        
        // Меняем состояние на труп
        this.state = 'corpse';
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
        
        // ===== 1. ПРИРОДНОЕ ОРУЖИЕ (когти, клыки, жало) =====
        // Используется только если нет оружия в правой руке
        if (!rightHand && this.naturalWeapon) {
            attacks.push({
                hand: 'right',
                isNatural: true,
                isMain: true,
                isOffhand: false,
                weapon: null,
                damageFormula: this.naturalWeapon.damageFormula || '1d6+strengthMod',
                damageType: this.naturalWeapon.damageType || 'slashing',
                attackFormula: this.naturalWeapon.attackFormula || '1d20+strengthMod',
                name: this.naturalWeapon.name || 'Природное оружие'
            });
        }
        
        // ===== 2. АТАКА ПРАВОЙ РУКОЙ (оружие) =====
        if (rightHand && this._isWeapon(rightHand)) {
            attacks.push({
                hand: 'right',
                weapon: rightHand,
                isMain: true,
                isOffhand: false,
                damageFormula: rightHand.damage || '1d4'
            });
        }
        
        // ===== 3. АТАКА ЛЕВОЙ РУКОЙ (оружие) =====
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
        
        // ===== 4. ВЫБРАННАЯ СПОСОБНОСТЬ =====
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
        
        // ===== 5. НЕТ ОРУЖИЯ И НЕТ ПРИРОДНОГО ОРУЖИЯ = КУЛАКИ =====
        if (attacks.length === 0) {
            attacks.push({
                hand: 'right',
                weapon: null,
                isMain: true,
                isOffhand: false,
                isUnarmed: true,
                damageFormula: '1d4' + this._getUnarmedDamageBonus()
            });
        }
        
        // ===== 6. ЕСТЬ СПОСОБНОСТЬ, НО НЕТ ОРУЖИЯ = ДОБАВЛЯЕМ КУЛАК/ПРИРОДНОЕ =====
        else if (attacks.length === 1 && attacks[0].type === 'ability') {
            // Если есть природное оружие — используем его
            if (this.naturalWeapon) {
                attacks.push({
                    hand: 'right',
                    isNatural: true,
                    isMain: true,
                    isOffhand: false,
                    weapon: null,
                    damageFormula: this.naturalWeapon.damageFormula || '1d6+strengthMod',
                    damageType: this.naturalWeapon.damageType || 'slashing',
                    attackFormula: this.naturalWeapon.attackFormula || '1d20+strengthMod',
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
                    damageFormula: '1d4' + this._getUnarmedDamageBonus()
                });
            }
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
        
        const result = this.container.equip(item, slot, this.equipmentService);
        
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
     * Удалить предмет из инвентаря
     * @param {number} index
     * @returns {Item|null}
     */
    removeItem(index) {
        return this.container ? this.container.removeItem(index) : null;
    }
    
    /**
     * Получить предмет из инвентаря
     * @param {number} index
     * @returns {Item|null}
     */
    getItem(index) {
        return this.container ? this.container.getItem(index) : null;
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
    
    _getUnarmedDamageBonus() {
        const stats = this.getStats();
        if (!stats) return '';
        const strMod = Math.floor((stats.strength - 10) / 2);
        return strMod > 0 ? `+${strMod}` : '';
    }
    
    // --- УПРАВЛЕНИЕ СПОСОБНОСТЯМИ ---
    
    setSelectedAbility(ability) {
        this.selectedAbility = ability;
    }
    
    clearSelectedAbility() {
        this.selectedAbility = null;
    }
    
    // --- ЗАГОТОВКИ ДЛЯ БУДУЩЕГО ---
    
    addEffect(effect) {
        // Будет реализовано в Этапе 3
    }
    
    removeEffect(effectId) {
        // Будет реализовано в Этапе 3
    }
    
    processEffects() {
        // Будет реализовано в Этапе 3
    }
}

export { Character };
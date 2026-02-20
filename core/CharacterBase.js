// core/CharacterBase.js
import { AbilityBase } from './AbilityBase.js';

class CharacterBase {
    constructor(gameState = null) {
        this.gameState = gameState;
        this.id = `character_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.selectedAbility = null; 
    if (!gameState) {
        this.statManager = new StatManager(this._createDefaultStats());
    } else {
        // Игрок использует StatManager из GameState
        this.statManager = null;
    }
    
    if (!gameState) {
        this._localEquipment = this._createDefaultEquipment();
    }
    
        if (!gameState) {
            this._localStats = this._createDefaultStats();
            this._localEquipment = this._createDefaultEquipment();
        }
        // Поле для доступа к BattleSystem
        this.battleSystem = null;
        // Если есть глобальный game, используем его battleSystem
        if (window.game?.battleSystem) {
            this.battleSystem = window.game.battleSystem;
        }
        this.queuedAction = null;
        this.proficiencies = new Set(); // Для Фазы 3
        this.activeEffects = []; // Для эффектов
        this.abilities = []; // Для Фазы 4
    }
    // === УНИВЕРСАЛЬНЫЕ ГЕТТЕРЫ ===
    get stats() {
    if (this.gameState && this.gameState.getPlayer) {
        return this.gameState.getPlayer(); // Игрок
    }
    return this.statManager ? this.statManager.getFinalStats() : 
           this._localStats || this._createDefaultStats();
    }
    set stats(value) {
        this._localStats = value; // Только для врагов
    }
    
    get equipment() {
        if (this.gameState && this.gameState.getEquipment) {
            return this.gameState.getEquipment(); // Игрок
        }
        return this._localEquipment || this._createDefaultEquipment(); // Враг
    }
    
    set equipment(value) {
        this._localEquipment = value; // Только для врагов
    }
    
    // === МЕТОДЫ СУЩЕСТВУЮЩЕГО КОДА ===
    /**
     * Получить урон (базовая реализация)
     * @param {number} damage - количество урона
     * @returns {Object} результат получения урона
     */
    takeDamage(damage) {
        // Используем this.stats (для врагов) или this._localStats
        const stats = this.stats || this._localStats;
        if (!stats || stats.health === undefined) {
            return { damage: 0, isDead: true, healthRemaining: 0 };
        }
        
        const newHealth = Math.max(0, stats.health - damage);
        stats.health = newHealth;
        
        return {
            damage: damage,
            isDead: newHealth <= 0,
            healthRemaining: newHealth
        };
    }

    /**
     * Атаковать игрока (реализация для врагов)
     * @param {Object} playerStats - характеристики игрока
     * @returns {number} нанесенный урон
     */
    attackPlayer(playerStats) {
        // Если нет battleSystem или формул, возвращаем 0
        if (!this.battleSystem || !playerStats) return 0;
        
        // Используем формулы врага или значения по умолчанию
        const attackFormula = this.attackFormula || "d20+attackMod";
        const damageFormula = this.damageFormula || "1d6+strengthMod";
        
        // Берем статы из this.stats или this._localStats
        const stats = this.stats || this._localStats || {};
        
        // Контекст для формул
        const context = {
            strengthMod: Math.floor(((stats.strength || 10) - 10) / 2),
            attackMod: stats.attack || 0,
            dexterityMod: Math.floor(((stats.dexterity || 10) - 10) / 2)
        };
        
        // Проверяем есть ли diceRoller
        if (!this.battleSystem.diceRoller) {
            // Упрощенный расчет без diceRoller
            const playerAC = playerStats.armorClass !== undefined ? playerStats.armorClass : 0;
            const attackRoll = Math.floor(Math.random() * 20) + 1 + (stats.attack || 0);
            if (attackRoll >= playerAC) {
                return Math.floor(Math.random() * 6) + 1 + context.strengthMod;
            }
            return 0;
        }
        
        // Полный расчет через diceRoller
        const attackResult = this.battleSystem.diceRoller.roll(attackFormula, context);      
        const playerAC = playerStats.armorClass !== undefined ? playerStats.armorClass : 0;
        
        const naturalRoll = attackResult.rolls[0] || 0;
        const isCritical = naturalRoll === 20;
        const isFumble = naturalRoll === 1;
        
        let hits = false;
        if (isCritical) {
            hits = true;
        } else if (isFumble) {
            hits = false;
        } else {
            hits = attackResult.total >= playerAC;
        }
        
        if (!hits) return 0;
        
        const damageResult = this.battleSystem.diceRoller.roll(damageFormula, context);
        let damage = damageResult.total;
        
        if (isCritical) {
            // Критический удар: удваиваем кубы
            const diceTotal = damageResult.rolls.reduce((sum, roll) => sum + roll, 0);
            const modifierTotal = damageResult.total - diceTotal;
            damage = (diceTotal * 2) + modifierTotal;
        }
        
        return Math.max(0, damage);
    }

   
    _createDefaultStats() {
        return {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
            health: 10,
            maxHealth: 10,
            mana: 0,
            maxMana: 0,
            stamina: 10,
            maxStamina: 10,
            armorClass: 10,
            attack: 0
        };
    }
    
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
            left_hand: null
        };
    }
    
    determineAutoAttacks() {
        const attacks = [];
        const equipment = this.equipment;
        const rightHand = equipment.right_hand;
        const leftHand = equipment.left_hand;
        
        if (rightHand && this._isWeapon(rightHand)) {
            attacks.push({
                hand: 'right',
                weapon: rightHand,
                isMain: true,
                isOffhand: false,
                damageFormula: rightHand.damage || '1d4'
            });
        }
        
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
        // === НОВЫЙ БЛОК: выбранная способность ===
        if (this.selectedAbility && this.selectedAbility.canUse) {
            const canUseResult = this.selectedAbility.canUse(this);
            if (canUseResult.success) {
                // ВЫЗВАТЬ markAsUsed() для установки кулдауна и расхода ресурсов
                const markResult = this.selectedAbility.markAsUsed(this);
                
                if (markResult.success) {
                    attacks.push({
                        type: 'ability',
                        ability: this.selectedAbility,
                        hand: 'ability',
                        isMain: false,
                        isOffhand: false,
                        damageFormula: this.selectedAbility.damageFormula || '0',
                        markResult: markResult // опционально для логов
                    });
                }
            }
        }
        
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
        // ЕСЛИ ЕСТЬ ability НО НЕТ ОРУЖИЯ → добавляем кулак ТОЖЕ
        else if (attacks.length === 1 && attacks[0].type === 'ability') {
            attacks.push({
                hand: 'right',
                weapon: null,
                isMain: true,
                isOffhand: false,
                isUnarmed: true,
                damageFormula: '1d4' + this._getUnarmedDamageBonus()
            });
        }
        return attacks;
    }
    
    _isWeapon(item) {
        return item && (item.type === 'weapon' || 
               item.weaponType !== undefined ||
               (item.properties && item.properties.includes('weapon')));
    }
    
    _getUnarmedDamageBonus() {
        const stats = this.stats;
        const strMod = Math.floor((stats.strength - 10) / 2);
        return strMod > 0 ? `+${strMod}` : '';
    }
    
    queueAction(action) {
        this.queuedAction = action;
    }
    
    clearQueuedAction() {
        const action = this.queuedAction;
        this.queuedAction = null;
        return action;
    }
    
    getWeaponInHand(slot) {
        return this.equipment[slot];
    }
    
    hasWeapon() {
        const equipment = this.equipment;
        return (equipment.right_hand && this._isWeapon(equipment.right_hand)) ||
               (equipment.left_hand && this._isWeapon(equipment.left_hand));
    }
    
    /**
     * Обновленный getInfo с поддержкой врагов
     */
    getInfo() {
        const stats = this.stats || this._localStats || {};
        
        const baseInfo = {
            id: this.id,
            name: this.name || 'Существо',
            type: this.type || 'creature',
            level: this.level || 1,
            health: stats.health || 0,
            maxHealth: stats.maxHealth || 0,
            armorClass: stats.armorClass || 10,
            attack: stats.attack || 0,
            stats: { ...stats }
        };
        
        // Добавляем специфичные поля для врагов
        if (this.expReward !== undefined) baseInfo.expReward = this.expReward;
        if (this.goldReward !== undefined) baseInfo.goldReward = this.goldReward;
        if (this.manualLoot) baseInfo.manualLoot = [...(this.manualLoot || [])];
        
        return baseInfo;
    } 
    
    getStats() {
        // Игрок берет из GameState, враги из statManager
        if (this.gameState && this.gameState.getPlayer) {
            return this.gameState.getPlayer();
        }
        // ДОБАВИТЬ для врагов:
        if (this.statManager) {
            return this.statManager.getFinalStats();
        }
        return this._localStats || this._createDefaultStats();
    }
    /**
     * Экипировать предмет (для врагов)
     * @param {Item} item - предмет
     * @param {string} slot - слот
     * @returns {boolean} успех
     */
    equipItem(item, slot) {
        // Только для врагов (у игрока экипировка через GameState)
        if (this.gameState || !this.equipmentService || !item || !slot) {
            return false;
        }
        
        // Получаем текущую экипировку (для врагов - this._localEquipment)
        const equipment = this._localEquipment || this._createDefaultEquipment();
        
        // Проверяем через EquipmentService
        const canEquip = this.equipmentService.canEquip(item, equipment, this);
        if (!canEquip.success) {
            console.warn('CharacterBase: нельзя экипировать', canEquip.message);
            return false;
        }
        
        // Надеваем
        equipment[slot] = item;
        
        // Применяем бонусы через EquipmentService
        if (this.statManager) {
            this.equipmentService.applyEquipmentModifiers.call({
                statManager: this.statManager,
                eventBus: null,
                gameState: null
            }, slot, item);
        }
        
        return true;
    }
    // === МЕТОДЫ ДЛЯ БУДУЩЕГО (Фаза 2-4) ===
    
    loadFromConfig(config) {
        if (config.baseStats) {
            this._localStats = { ...config.baseStats };
        }
        if (config.startingEquipment) {
            this._localEquipment = { ...config.startingEquipment };
        }
        if (config.proficiencies) {
            this.proficiencies = new Set(config.proficiencies);
        }
        if (config.abilities) {
            this.abilities = [...config.abilities];
        }
        return this;
    }
    
    hasProficiency(proficiencyType) {
        return this.proficiencies.has(proficiencyType);
    }
    
    addProficiency(proficiencyType) {
        this.proficiencies.add(proficiencyType);
    }
    
    addEffect(effect) {
        this.activeEffects.push(effect);
        if (effect.onApply) {
            effect.onApply(this);
        }
    }
    
    removeEffect(effectId) {
        const index = this.activeEffects.findIndex(e => e.id === effectId);
        if (index !== -1) {
            const effect = this.activeEffects[index];
            if (effect.onRemove) {
                effect.onRemove(this);
            }
            this.activeEffects.splice(index, 1);
        }
    }
    
    processEffects() {
        this.activeEffects.forEach(effect => {
            if (effect.onTick) {
                effect.onTick(this);
            }
        });
    }
    
    canUseAbility(abilityId) {
        // Проверка ресурсов, КД и т.д.
        return this.abilities.includes(abilityId);
    }
    // === НОВЫЕ МЕТОДЫ ДЛЯ СИСТЕМЫ СПОСОБНОСТЕЙ ===
    
    /**
     * Установить выбранную способность для следующей атаки
     * @param {AbilityBase|null} ability - способность или null для отмены
     */
    setSelectedAbility(ability) {
        this.selectedAbility = ability;
    }
    
    /**
     * Очистить выбранную способность
     */
    clearSelectedAbility() {
        this.selectedAbility = null;
    }
    
    /**
     * Получить выбранную способность
     * @returns {AbilityBase|null}
     */
    getSelectedAbility() {
        return this.selectedAbility;
    }
    
    /**
     * Проверить, может ли персонаж использовать способность
     * (Делегирует проверку самому объекту AbilityBase)
     * @param {AbilityBase} ability - проверяемая способность
     * @returns {Object} {success: boolean, reason: string}
     */
    canUseAbility(ability) {
        if (!ability || !ability.canUse) {
            return { success: false, reason: 'Некорректная способность' };
        }
        return ability.canUse(this);
    }
    
    /**
     * Использовать способность (потратить ресурсы, применить эффекты)
     * @param {AbilityBase} ability - способность
     * @param {CharacterBase|null} target - цель (опционально)
     * @returns {Object} результат использования
     */
    useAbility(ability, target = null) {
        if (!ability || !ability.use) {
            return { 
                success: false, 
                message: 'Некорректная способность',
                damage: 0 
            };
        }
        return ability.use(this, target);
    }
    
    /**
     * Получить список доступных способностей (для интеграции с AbilityService)
     * Это заглушка - реальный метод должен запрашивать AbilityService
     * @returns {Array<AbilityBase>}
     */
    getAvailableAbilities() {
        // В будущем здесь будет обращение к AbilityService
        return [];
    }
}

export { CharacterBase };
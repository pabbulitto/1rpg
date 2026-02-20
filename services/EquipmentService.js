// services/EquipmentService.js
/**
 * EquipmentService - сервис валидации и управления экипировкой
 * Отделяет логику проверок от InventorySystem
 * Интеграция через EventBus
 */
class EquipmentService {
    constructor(eventBus, statManager,gameState) {
        this.eventBus = eventBus;
        this.statManager = statManager;
        this.gameState = gameState;
        // Карта слотов для быстрого доступа
        this.slotMap = {
            // Прямые слоты (1:1)
            head: ['head'],
            body: ['body'],
            arms: ['arms'],
            hands: ['hands'],
            belt: ['belt'],
            legs: ['legs'],
            feet: ['feet'],
            // Специальные слоты (множественные)
            bracelet: ['bracelet1', 'bracelet2'],
            hand: ['right_hand', 'left_hand'],
            ring: ['ring1', 'ring2'],
            neck: ['neck1', 'neck2'],
            two_handed: ['right_hand', 'left_hand'] // Двуручное занимает оба слота
        };
    }
    
    /**
     * Проверить возможность экипировки предмета
     * @param {Item} item - предмет для экипировки
     * @param {Object} currentEquipment - текущая экипировка {slot: item}
     * @param {Object} player - объект игрока (для будущих проверок: уровень, класс)
     * @returns {Object} результат проверки
     */
    canEquip(item, currentEquipment, player = null) {
        if (!item || !item.slot) {
            return { 
                success: false, 
                message: "Этот предмет нельзя надеть",
                errorCode: 'NO_SLOT'
            };
        }
        
        const slotType = item.slot;
        const targetSlots = this.slotMap[slotType];
        
        if (!targetSlots) {
            return { 
                success: false, 
                message: `Неизвестный тип слота: ${slotType}`,
                errorCode: 'UNKNOWN_SLOT'
            };
        }
        
        // === ОСОБАЯ ЛОГИКА ДЛЯ ДВУРУЧНОГО ОРУЖИЯ ===
        if (slotType === 'two_handed') {
            return this.validateTwoHanded(item, currentEquipment);
        }
        
        // === ЛОГИКА ДЛЯ ОДНОРУЧНОГО ОРУЖИЯ ===
        if (slotType === 'hand') {
            return this.validateHand(item, currentEquipment);
        }
        
        // === ЛОГИКА ДЛЯ КОЛЕЦ И АМУЛЕТОВ ===
        if (slotType === 'ring' || slotType === 'neck') {
            return this.validateMultiSlot(item, currentEquipment, targetSlots);
        }
        
        // === ПРЯМЫЕ СЛОТЫ (head, body, etc.) ===
        const targetSlot = targetSlots[0];
        const equippedItem = currentEquipment[targetSlot];
        
        if (equippedItem && equippedItem.id === item.id && equippedItem.stackable) {
            return { 
                success: false, 
                message: "Этот предмет уже надет",
                errorCode: 'ALREADY_EQUIPPED'
            };
        }
        
        if (player && item.requirements) {
            const reqCheck = this.checkRequirements(item.requirements, player);
            if (!reqCheck.success) return reqCheck;
        }
        
        return { 
            success: true, 
            targetSlot: targetSlot,
            slotsToClear: equippedItem ? [targetSlot] : []
        };
    }
    
    /**
     * Валидация двуручного оружия
     */
    validateTwoHanded(item, currentEquipment) {
        const rightHand = currentEquipment.right_hand;
        const leftHand = currentEquipment.left_hand;
        
        // 1. Проверка: уже надето двуручное?
        if (rightHand && rightHand.slot === 'two_handed') {
            return { 
                success: false, 
                message: "Уже экипировано двуручное оружие",
                errorCode: 'TWO_HANDED_ALREADY_EQUIPPED'
            };
        }
        
        // 2. Проверка: левая рука занята двуручником? (защита от багов)
        if (leftHand && leftHand.slot === 'two_handed') {
            return { 
                success: false, 
                message: "Левая рука занята двуручным оружием (ошибка состояния)",
                errorCode: 'INVALID_STATE'
            };
        }
        
        // 3. Определяем, какие слоты нужно освободить
        const slotsToClear = [];
        if (rightHand) slotsToClear.push('right_hand');
        if (leftHand) slotsToClear.push('left_hand');
        
        return { 
            success: true, 
            targetSlot: 'right_hand', // Двуручное всегда в правую руку
            slotsToClear: slotsToClear,
            affectedSlots: ['right_hand', 'left_hand'] // Для блокировки левой руки
        };
    }
    
    /**
     * Валидация одноручного оружия/предметов
     */
    validateHand(item, currentEquipment) {
        // 1. Проверка: правая рука занята двуручником?
        const rightHand = currentEquipment.right_hand;
        if (rightHand && rightHand.slot === 'two_handed') {
            return { 
                success: false, 
                message: "Левая рука занята двуручным оружием",
                errorCode: 'LEFT_HAND_BLOCKED'
            };
        }
        
        // 2. Ищем свободную руку
        let targetSlot = null;
        if (!currentEquipment.right_hand) {
            targetSlot = 'right_hand';
        } else if (!currentEquipment.left_hand) {
            targetSlot = 'left_hand';
        } else {
            return { 
                success: false, 
                message: "Обе руки заняты",
                errorCode: 'BOTH_HANDS_OCCUPIED'
            };
        }
        
        return { 
            success: true, 
            targetSlot: targetSlot,
            slotsToClear: []
        };
    }
    
    /**
     * Валидация колец и амулетов (множественные слоты)
     */
    validateMultiSlot(item, currentEquipment, targetSlots) {
        // Ищем свободный слот
        let freeSlot = null;
        for (const slot of targetSlots) {
            if (!currentEquipment[slot]) {
                freeSlot = slot;
                break;
            }
        }
        
        if (!freeSlot) {
            const slotName = targetSlots[0].includes('ring') ? 'колец' : 'амулетов';
            return { 
                success: false, 
                message: `Оба слота ${slotName} заняты`,
                errorCode: 'ALL_SLOTS_OCCUPIED'
            };
        }
        
        return { 
            success: true, 
            targetSlot: freeSlot,
            slotsToClear: []
        };
    }
    /**
     * Получить слоты, которые затрагивает предмет
     * @param {Item} item 
     * @returns {Array} массив слотов
     */
    getAffectedSlots(item) {
        if (!item || !item.slot) return [];
        
        const slots = this.slotMap[item.slot];
        return slots ? [...slots] : [];
    }
    
    /**
     * Применить модификаторы экипировки к StatManager
     * @param {string} slot - слот экипировки
     * @param {Item|null} item - предмет (null если сняли)
     */
    applyEquipmentModifiers(slot, item) {
    const sourceId = `equipment_${slot}`;
    
    this.statManager.removeModifier(sourceId);
    
    if (item && item.stats && Object.keys(item.stats).length > 0) {
        const itemStats = { ...item.stats };
        
        if (itemStats.health !== undefined) {
        itemStats.maxHealth = (itemStats.maxHealth || 0) + itemStats.health;
        delete itemStats.health;
        }
        
        if (itemStats.stamina !== undefined) {
        itemStats.maxStamina = (itemStats.maxStamina || 0) + itemStats.stamina;
        delete itemStats.stamina;
        }
        
        const currentHealth = this.statManager.getResource('health');
        const currentMana = this.statManager.getResource('mana');
        const currentStamina = this.statManager.getResource('stamina');
        
        this.statManager.addModifier(sourceId, itemStats);
        
        const finalStats = this.statManager.getFinalStats();
        
        this.statManager.setResource('health', Math.min(currentHealth, finalStats.maxHealth));
        this.statManager.setResource('mana', Math.min(currentMana, finalStats.maxMana));
        this.statManager.setResource('stamina', Math.min(currentStamina, finalStats.maxStamina));
    }
    
    const playerData = this.gameState ? this.gameState.getPlayer() : this.statManager.getStatsForUI();

    
    this.eventBus.emit('player:statsChanged', playerData);
    this.eventBus.emit('inventory:updated');
    
    if (item) {
        if (console && console.log) {
            console.log(`EquipmentService: применены модификаторы для ${item.name} в слот ${slot}`, {
                slot,
                item: item.name,
                stats: item.stats,
                sourceId
            });
        }
    } else {
        if (console && console.log) {
            console.log(`EquipmentService: снят предмет из слота ${slot}`);
        }
    }
    }
    /**
     * Обработка снятия предмета (особая логика для двуручного)
     */
    handleUnequip(slot, item, currentEquipment) {
        if (item && item.slot === 'two_handed' && slot === 'right_hand') {
            // При снятии двуручника освобождаем только правую руку
            // Левая рука автоматически разблокируется
            return {
                success: true,
                freedSlots: ['right_hand'],
                message: `Снято двуручное оружие: ${item.name}`
            };
        }
        
        // Стандартное снятие
        return {
            success: true,
            freedSlots: [slot],
            message: `Снято: ${item ? item.name : 'предмет'}`
        };
    }
}

export { EquipmentService };

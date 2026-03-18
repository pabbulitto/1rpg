// services/EquipmentService.js
/**
 * EquipmentService - сервис валидации и управления экипировкой
 * Отделяет логику проверок от InventorySystem
 * Интеграция через EventBus
 */
class EquipmentService {
    constructor(eventBus, statManager, gameState) {
        this.eventBus = eventBus;
        this.statManager = statManager;
        this.gameState = gameState;
        this.effectService = window.game?.effectService || null;
        this.abilityService = window.game?.abilityService || null; 
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
     * Применить или удалить эффекты от предмета
     * @private
     * @param {string} slot - слот
     * @param {Item|null} item - предмет (null если сняли)
     */
    _applyItemEffects(slot, item) {
        const player = window.game?.player;
        const effectService = window.game?.effectService;
        
        // Проверяем, что всё доступно
        if (!player || !effectService) return;
        
        const sourcePrefix = `item_${slot}`;
        
        // Удаляем старые эффекты из этого слота
        effectService.removeEffectsBySource(player.id, sourcePrefix);
        
        // Если есть эффекты у предмета — применяем
        if (item && item.effects && item.effects.length > 0) {
            item.effects.forEach(effectId => {
                effectService.applyEffect(
                    player,
                    effectId,
                    `${sourcePrefix}_${item.id}`,
                    { durationOverride: 0 }
                );
            });
        }
    }
    
    /**
     * Проверить возможность экипировки предмета
     * @param {Item} item - предмет для экипировки
     * @param {Object} currentEquipment - текущая экипировка {slot: item}
     * @param {Object} player - объект игрока (для проверок требований)
     * @returns {Object} результат проверки
     */
    canEquip(item, currentEquipment, player = null, requestedSlot = null) {
            // проверка для массива слотов 
        if (Array.isArray(item.slot)) {
            // Если запрошенный слот есть в массиве - можно надеть
            if (item.slot.includes(requestedSlot)) {
                return { success: true, targetSlot: requestedSlot, slotsToClear: [] };
            }
            // Если нет в массиве - нельзя
            return { 
                success: false, 
                message: "Предмет нельзя надеть в этот слот",
                errorCode: 'INVALID_SLOT'
            };
        }
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
        
        // ===== ПРОВЕРКА ТРЕБОВАНИЙ ПО СИЛЕ (ДЛЯ ОРУЖИЯ) =====
        if (item.type === 'weapon' && item.requirements?.strength && player) {
            const playerStrength = player.getStats().strength;
            const req = item.requirements.strength;
            
            // Проверка минимальной силы для использования оружия вообще
            if (playerStrength < req.both_hands) {
                return {
                    success: false,
                    message: `Вам нужно ${req.both_hands} силы чтобы держать это оружие`,
                    errorCode: 'STRENGTH_TOO_LOW'
                };
            }
        }
        
        // === ОСОБАЯ ЛОГИКА ДЛЯ ДВУРУЧНОГО ОРУЖИЯ ===
        if (slotType === 'two_handed') {
            return this.validateTwoHanded(item, currentEquipment, player);
        }
        
        // === ЛОГИКА ДЛЯ ОДНОРУЧНОГО ОРУЖИЯ ===
        if (slotType === 'hand') {
            return this.validateHand(item, currentEquipment, player, requestedSlot);
        }
        
        // === ЛОГИКА ДЛЯ КОЛЕЦ, АМУЛЕТОВ И БРАСЛЕТОВ ===
        if (slotType === 'ring' || slotType === 'neck' || slotType === 'bracelet') {
            return this.validateMultiSlot(item, currentEquipment, targetSlots);
        }
        
        // === ПРЯМЫЕ СЛОТЫ (head, body, arms, hands, belt, legs, feet) ===
        // Если запрошен конкретный слот, он должен быть в targetSlots
        if (requestedSlot && !targetSlots.includes(requestedSlot)) {
            return {
                success: false,
                message: `Предмет нельзя надеть в слот ${requestedSlot}`,
                errorCode: 'INVALID_SLOT'
            };
        }
        
        const targetSlot = requestedSlot || targetSlots[0];
        const equippedItem = currentEquipment[targetSlot];
        
        // Проверка, занят ли слот
        if (equippedItem) {
            return {
                success: false,
                message: `Слот ${targetSlot} уже занят`,
                errorCode: 'SLOT_OCCUPIED'
            };
        }
        
        return { 
            success: true, 
            targetSlot: targetSlot,
            slotsToClear: []
        };
    }
    
    /**
     * Валидация двуручного оружия
     * @param {Item} item - предмет
     * @param {Object} currentEquipment - текущая экипировка
     * @param {Object} player - объект игрока
     * @returns {Object} результат проверки
     */
    validateTwoHanded(item, currentEquipment, player = null) {
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
        
        // 3. Проверка требований по силе для двуручного использования
        if (player && item.requirements?.strength) {
            const playerStrength = player.getStats().strength;
            const req = item.requirements.strength;
            
            if (playerStrength < req.both_hands) {
                return {
                    success: false,
                    message: `Вам нужно ${req.both_hands} силы чтобы использовать это оружие двумя руками`,
                    errorCode: 'STRENGTH_TOO_LOW'
                };
            }
        }
        
        // 4. Определяем, какие слоты нужно освободить
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
     * @param {Item} item - предмет
     * @param {Object} currentEquipment - текущая экипировка
     * @param {Object} player - объект игрока
     * @returns {Object} результат проверки
     */
    validateHand(item, currentEquipment, player = null, requestedSlot = null) {
        // ===== 1. СНАЧАЛА ОБРАБАТЫВАЕМ ЗАПРОШЕННЫЙ СЛОТ =====
        if (requestedSlot) {
            // Проверяем, что запрошенный слот подходит для оружия
            if (requestedSlot !== 'right_hand' && requestedSlot !== 'left_hand') {
                return {
                    success: false,
                    message: `Нельзя надеть оружие в слот ${requestedSlot}`,
                    errorCode: 'INVALID_SLOT_FOR_WEAPON'
                };
            }
            
            // Проверяем, свободен ли слот
            if (currentEquipment[requestedSlot]) {
                return { 
                    success: false, 
                    message: `Слот ${requestedSlot === 'right_hand' ? 'правой' : 'левой'} руки уже занят`,
                    errorCode: 'SLOT_OCCUPIED'
                };
            }
            
           // Проверяем требования по силе для запрошенного слота
            if (player && item.requirements?.strength) {
                const playerStrength = player.getStats().strength;
                const req = item.requirements.strength;
                
                if (requestedSlot === 'right_hand') {
                    // Проверяем, можно ли использовать как одноручное
                    if (playerStrength >= req.right_hand) {
                        // Всё ок, продолжаем
                    }
                    // Если не хватает на одноручное, но хватает на двуручное
                    else if (playerStrength >= req.both_hands) {
                        // Можно использовать как двуручное
                        return {
                            success: true,
                            targetSlot: 'right_hand',
                            slotsToClear: ['right_hand', 'left_hand'],
                            message: `Используется двумя руками (требуется ${req.both_hands} силы)`
                        };
                    }
                    else {
                        return {
                            success: false,
                            message: `Вам нужно ${req.right_hand} силы для правой руки`,
                            errorCode: 'STRENGTH_TOO_LOW_RIGHT'
                        };
                    }
                }
                
                if (requestedSlot === 'left_hand' && playerStrength < req.left_hand) {
                    return {
                        success: false,
                        message: `Вам нужно ${req.left_hand} силы для левой руки`,
                        errorCode: 'STRENGTH_TOO_LOW_LEFT'
                    };
                }
            }
            
            // Если всё ок - надеваем в запрошенный слот
            return { 
                success: true, 
                targetSlot: requestedSlot,
                slotsToClear: []
            };
        }
        // ===== 2. ТОЛЬКО ПОТОМ ПРОВЕРКИ НА ДВУРУЧНОЕ ОРУЖИЕ =====
        const rightHand = currentEquipment.right_hand;
        if (rightHand && rightHand.slot === 'two_handed') {
            return { 
                success: false, 
                message: "Нельзя использовать оружие - обе руки заняты двуручным оружием",
                errorCode: 'TWO_HANDED_BLOCK'
            };
        }
        
        // ===== 3. ЕСЛИ СЛОТ НЕ ЗАПРОШЕН - СТАРАЯ ЛОГИКА =====
        // Проверка требований по силе для двуручного/одноручного использования
        if (player && item.requirements?.strength) {
            const playerStrength = player.getStats().strength;
            const req = item.requirements.strength;
            
            // Сначала проверяем, можно ли использовать обеими руками
            if (playerStrength >= req.both_hands) {
                // Можно использовать как двуручное - надеваем в правую руку, левую блокируем
                return {
                    success: true,
                    targetSlot: 'right_hand',
                    slotsToClear: ['right_hand', 'left_hand'],
                    message: `Используется двумя руками (требуется ${req.both_hands} силы)`
                };
            }
            
            // Если не хватает для двуручного, проверяем для одноручного использования
            // Проверяем правую руку (если она свободна)
            if (!currentEquipment.right_hand && playerStrength < req.right_hand) {
                return {
                    success: false,
                    message: `Вам нужно ${req.right_hand} силы для правой руки`,
                    errorCode: 'STRENGTH_TOO_LOW_RIGHT'
                };
            }
            
            // Проверяем левую руку (если она свободна)
            if (!currentEquipment.left_hand && playerStrength < req.left_hand) {
                return {
                    success: false,
                    message: `Вам нужно ${req.left_hand} силы для левой руки`,
                    errorCode: 'STRENGTH_TOO_LOW_LEFT'
                };
            }
        }
        
        // Ищем свободную руку
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
     * Валидация множественных слотов (кольца, амулеты, браслеты)
     * @param {Item} item - предмет
     * @param {Object} currentEquipment - текущая экипировка
     * @param {Array} targetSlots - массив возможных слотов
     * @returns {Object} результат проверки
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
            const slotNames = {
                ring: 'колец',
                neck: 'амулетов',
                bracelet: 'браслетов'
            };
            const slotName = slotNames[item.slot] || 'слотов';
            return { 
                success: false, 
                message: `Все слоты ${slotName} заняты`,
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
    
    applyEquipmentModifiers(slot, item) {
         console.log('=== applyEquipmentModifiers ===');
         console.log('this._applyWeaponSkillBonuses:', typeof this._applyWeaponSkillBonuses);
         console.log('this._applyItemEffects:', typeof this._applyItemEffects);
        const sourceId = `equipment_${slot}`;
        const armorSourceId = `equipment_armor_${slot}`;
        
        // Всегда удаляем оба модификатора
        this.statManager.removeModifier(sourceId);
        this.statManager.removeModifier(armorSourceId);
        // Удаляем все модификаторы, начинающиеся с 'weapon_skill_'
        if (this.statManager.modifiers) {
            const toRemove = this.statManager.modifiers
                .filter(m => m.source && m.source.startsWith('weapon_skill_'))
                .map(m => m.source);
            toRemove.forEach(source => this.statManager.removeModifier(source));
        }
        this._applyItemEffects(slot, item);
        if (item) {
            const itemStats = { ...item.stats };
            // Конвертируем health/maxHealth
            if (itemStats.health !== undefined) {
                itemStats.maxHealth = (itemStats.maxHealth || 0) + itemStats.health;
                delete itemStats.health;
            }
            
            // Конвертируем stamina/maxStamina
            if (itemStats.stamina !== undefined) {
                itemStats.maxStamina = (itemStats.maxStamina || 0) + itemStats.stamina;
                delete itemStats.stamina;
            }
            
            // Сохраняем текущие ресурсы
            const currentHealth = this.statManager.getResource('health');
            const currentMana = this.statManager.getResource('mana');
            const currentStamina = this.statManager.getResource('stamina');
            
            // Добавляем модификатор со всеми статами
            this.statManager.addModifier(sourceId, itemStats);
            
            // Обрезаем ресурсы если превысили новый максимум
            const finalStats = this.statManager.getFinalStats();
            this.statManager.setResource('health', Math.min(currentHealth, finalStats.maxHealth));
            this.statManager.setResource('mana', Math.min(currentMana, finalStats.maxMana));
            this.statManager.setResource('stamina', Math.min(currentStamina, finalStats.maxStamina));
            
        }
        
        // Обновляем UI
        this.eventBus.emit('player:statsChanged', this.gameState.getPlayer());
        this.eventBus.emit('inventory:updated');
    }
    /**
     * Обработка снятия предмета (особая логика для двуручного)
     * @param {string} slot - слот
     * @param {Item} item - предмет
     * @param {Object} currentEquipment - текущая экипировка
     * @returns {Object} результат операции
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
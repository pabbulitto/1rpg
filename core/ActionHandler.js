/**
 * ActionHandler - обработчик мгновенных действий в бою
 * Выполняет действие сразу при выборе, не ставит в очередь
 * Следит за AFK-таймером (21 секунда без действий = автоатака)
 */
class ActionHandler {
    constructor(eventBus, combatSystem) {
        this.eventBus = eventBus;
        this.combatSystem = combatSystem;
        this.afkTimers = new Map(); // characterId -> {startTime, timeoutId}
        this.AFK_LIMIT = 15000; // 15 секунда в мс
        
        this.setupEventListeners();
    }
    
    /**
     * Настроить подписки на события боя
     */
    setupEventListeners() {
        // Начало боя
        this.eventBus.on('battle:start', (data) => {
            this.startAFKTimer(data.player.id);
        });
        
        // Игрок выбрал действие
        this.eventBus.on('combat:playerAction', (data) => {
            this.handlePlayerAction(data.player, data.actionType, data.data);
        });
        
        // Конец боя
        this.eventBus.on('battle:end', () => {
            this.clearAllTimers();
        });
    }
    
    /**
     * Обработать действие игрока
     * @param {CharacterBase} player 
     * @param {string} actionType - 'attack' | 'item' | 'spell' | 'ability'
     * @param {Object} data - дополнительные данные
     */
    handlePlayerAction(player, actionType, data = null) {
        // Сбросить AFK-таймер
        this.resetAFKTimer(player.id);
        
        // Немедленное выполнение
        switch(actionType) {
            case 'attack':
                this.executeAttack(player);
                break;
                
            case 'item':
                this.executeItem(player, data.item, data.target);
                break;
                
            case 'spell':
            case 'ability':
                // Получаем объект способности
                let abilityObject = null;
                
                // Если передали объект (старый формат)
                if (data.spell && data.spell.id) {
                    abilityObject = data.spell;
                } 
                // Если передали ID (новый формат от BattleUI)
                else if (data.abilityId || data.spellId) {
                    const abilityId = data.abilityId || data.spellId;
                    abilityObject = window.game?.abilityService?.getAbility(abilityId);
                }
                
                if (!abilityObject) {
                    console.warn('ActionHandler: не удалось получить способность', data);
                    return;
                }
                
                this.executeSpellOrAbility(player, abilityObject, data.target);
                break;
                
            default:
                console.warn('ActionHandler: неизвестный тип действия', actionType);
                this.executeAttack(player); // fallback
        }
        
    }
    
    /**
     * Выполнить атаку оружием
     */
    executeAttack(player) {
        // 1. Проверяем есть ли CombatSystem
        if (!this.combatSystem) {
            console.warn('ActionHandler: нет CombatSystem');
            return;
        }
        
        // 2. Проверяем идёт ли бой
        if (!this.combatSystem.isInCombat()) {
            console.warn('ActionHandler: бой не активен');
            return;
        }
        
        // 3. Получаем информацию о текущем бое
        const battleInfo = this.combatSystem.getBattleInfo();
        if (!battleInfo || !battleInfo.enemies || battleInfo.enemies.length === 0) {
            console.warn('ActionHandler: нет врагов для атаки');
            return;
        }
        
        // 4. Берём первого врага (основная цель)
        const enemy = this.combatSystem.currentBattle.enemies[0];
        if (!enemy) {
            console.warn('ActionHandler: враг не найден');
            return;
        }
        
        // 5. Делегируем атаку CombatSystem (который вызовет BattleSystem)
        this.combatSystem.executePlayerAttack(player);
         
    }
    /**
     * Использовать предмет (заменяет атаку)
     */
    executeItem(player, item, target = null) {
        console.log(`ActionHandler: ${player.id} использует ${item.name}`);
        
        // Проверяем требует ли предмет руки
        if (this.itemRequiresHands(item)) {
            // Предмет заменяет атаку
            this.combatSystem.executeItemUse(player, item, target);
        } else {
            // Предмет можно использовать вместе с атакой
            this.combatSystem.executeItemUse(player, item, target);
            this.combatSystem.executePlayerAttack(player); // дополнительная атака
        }
    }
    
    /**
     * Использовать заклинание/умение (добавляется к атаке)
     */
    executeSpellOrAbility(player, spell, target = null) {
        // 1. Установить выбранную способность
        if (player.setSelectedAbility) {
            player.setSelectedAbility(spell);
        } else {
            player.selectedAbility = spell;
        }
        
        // 2. Выполнить атаку (ability добавится через determineAutoAttacks)
        this.executeAttack(player);
        
        // 3. Очистить выбранную способность
        if (player.clearSelectedAbility) {
            player.clearSelectedAbility();
        } else {
            player.selectedAbility = null;
        }
    }
        
    /**
     * Проверить требует ли предмет свободных рук
     */
    itemRequiresHands(item) {
        // Предметы типа 'potion', 'scroll' не требуют рук
        // Предметы типа 'tool', 'weapon' требуют
        return item.type === 'tool' || item.type === 'weapon';
    }
    
    /**
     * Может ли атаковать после заклинания
     */
    canAttackAfterSpell(player) {
        // Проверяем не использовал ли предмет, занимающий руки
        const rightHand = player.equipment?.right_hand;
        const leftHand = player.equipment?.left_hand;
        
        // Если в руках предметы, которые нельзя использовать со заклинанием
        if (rightHand && this.itemRequiresHands(rightHand)) return false;
        if (leftHand && this.itemRequiresHands(leftHand)) return false;
        
        return true;
    }
    
    /**
     * Запустить AFK-таймер для игрока
     */
    startAFKTimer(playerId) {
        this.clearAFKTimer(playerId);
        
        const timeoutId = setTimeout(() => {
            console.log(`ActionHandler: AFK-таймер сработал для ${playerId}`);
            this.executeAFKAttack(playerId);
        }, this.AFK_LIMIT);
        
        this.afkTimers.set(playerId, {
            startTime: Date.now(),
            timeoutId: timeoutId
        });
    }
    
    /**
     * Сбросить AFK-таймер
     */
    resetAFKTimer(playerId) {
        const timer = this.afkTimers.get(playerId);
        if (timer) {
            clearTimeout(timer.timeoutId);
            this.startAFKTimer(playerId); // перезапустить
        }
    }
    
    /**
     * Выполнить автоатаку при AFK и перезапустить таймер
     */
    executeAFKAttack(playerId) {
        console.log(`ActionHandler: автоатака для AFK-игрока ${playerId}`);
        this.eventBus.emit('combat:afkAutoAttack', { playerId });
        
        // 1. Очистить текущий таймер
        this.clearAFKTimer(playerId);
        
        // 2. Проверить идет ли еще бой
        const game = window.game;
        if (game && game.combatSystem && game.combatSystem.isInCombat()) {
            // 3. ЗАПУСТИТЬ НОВЫЙ таймер
            this.startAFKTimer(playerId);
        }
    } 
    /**
     * Очистить таймер
     */
    clearAFKTimer(playerId) {
        const timer = this.afkTimers.get(playerId);
        if (timer) {
            clearTimeout(timer.timeoutId);
            this.afkTimers.delete(playerId);
        }
    }
    /**
     * Очистить все таймеры
     */
    clearAllTimers() {
        for (const [playerId, timer] of this.afkTimers) {
            clearTimeout(timer.timeoutId);
        }
        this.afkTimers.clear();
    }
    
    /**
     * Получить оставшееся время до автоатаки
     */
    getRemainingAFKTime(playerId) {
        const timer = this.afkTimers.get(playerId);
        if (!timer) return 0;
        
        const elapsed = Date.now() - timer.startTime;
        return Math.max(0, this.AFK_LIMIT - elapsed);
    }

}

export { ActionHandler };
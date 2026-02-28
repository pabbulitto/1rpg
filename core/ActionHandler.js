/**
 * ActionHandler - обработчик действий в бою
 * Передает выбранные действия в CombatSystem для обработки в следующем раунде
 */
class ActionHandler {
    constructor(eventBus, combatSystem) {
        this.eventBus = eventBus;
        this.combatSystem = combatSystem;
        
        this.setupEventListeners();
    }
    
    /**
     * Настроить подписки на события боя
     */
    setupEventListeners() {
        // Игрок выбрал действие
        this.eventBus.on('combat:playerAction', (data) => {
            this.handlePlayerAction(data.player, data.actionType, data.data);
        });
    }
    
    /**
     * Обработать действие игрока
     * @param {CharacterBase} player 
     * @param {string} actionType - 'attack' | 'item' | 'spell' | 'ability'
     * @param {Object} data - дополнительные данные
     */
    handlePlayerAction(player, actionType, data = null) {
        switch(actionType) {
            case 'attack':
                // В новой системе атака происходит автоматически каждый раунд
                // Этот тип действия больше не используется
                break;
                
            case 'item':
                // Сохраняем действие для следующего раунда
                this.queueItemAction(player, data);
                break;
                
            case 'spell':
            case 'ability':
                // Сохраняем действие для следующего раунда
                this.queueAbilityAction(player, data);
                break;
                
            default:
                console.warn('ActionHandler: неизвестный тип действия', actionType);
        }
    }
    
    /**
     * Сохранить действие с предметом
     */
    queueItemAction(player, data) {
        if (!data || !data.item) return;
        
        // Передаем действие в CombatSystem
        this.eventBus.emit('combat:playerSelectedAction', {
            player: player,
            action: {
                type: 'item',
                data: data.item,
                beltIndex: data.beltIndex
            }
        });
    }
    
    /**
     * Сохранить действие со способностью
     */
    queueAbilityAction(player, data) {
        if (!data || !data.ability) return;
        
        this.eventBus.emit('combat:playerSelectedAction', {
            player: player,
            action: {
                type: 'ability',
                data: data.ability,
                targetId: data.targetId
            }
        });
    }
}

export { ActionHandler };
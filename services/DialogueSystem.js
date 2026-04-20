// services/DialogueSystem.js
import { DialogueUI } from '../ui/components/DialogueUI.js';

/**
 * DialogueSystem - управляет логикой диалогов
 * Загружает деревья диалогов, обрабатывает переходы и действия
 */
class DialogueSystem {
    constructor(game) {
        this.game = game;
        this.dialoguesData = {};
        this.currentDialogue = null;
        this.currentNodeId = null;
        this.dialogueUI = null;
        this.npc = null;
        this.onClose = null;
        this.loaded = false;
        
        // Контекст обучения (для возврата)
        this.trainContext = null;
    }
    
    /**
     * Загрузить данные диалогов
     */
    async loadDialogues() {
        try {
            const response = await fetch('./data/dialogues.json');
            if (!response.ok) {
                console.warn('DialogueSystem: dialogues.json не найден, используем пустые данные');
                this.dialoguesData = {};
            } else {
                this.dialoguesData = await response.json();
            }
            this.loaded = true;
            console.log('DialogueSystem: загружено диалогов:', Object.keys(this.dialoguesData).length);
        } catch (error) {
            console.error('DialogueSystem: ошибка загрузки диалогов:', error);
            this.dialoguesData = {};
            this.loaded = true;
        }
    }
    
    /**
     * Запустить диалог с NPC
     */
    async startDialogue(npc, dialogueTreeId, onClose = null) {
        if (!this.loaded) {
            await this.loadDialogues();
        }
        
        const dialogueTree = this.dialoguesData[dialogueTreeId];
        if (!dialogueTree) {
            console.error(`DialogueSystem: дерево диалогов ${dialogueTreeId} не найдено`);
            this.game.eventBus?.emit('log:add', { 
                message: `${npc.name} молча смотрит на вас.`, 
                type: 'info' 
            });
            return;
        }
        
        this.npc = npc;
        this.currentDialogue = dialogueTree;
        this.currentNodeId = dialogueTree.startNode;
        this.onClose = onClose;
        this.trainContext = null;
        
        if (!this.dialogueUI) {
            this.dialogueUI = new DialogueUI(this.game.eventBus);
        }
        
        this.showCurrentNode();
    }
    
    /**
     * Показать текущий узел диалога
     */
    showCurrentNode() {
        const node = this.currentDialogue.nodes[this.currentNodeId];
        if (!node) {
            console.error(`DialogueSystem: узел ${this.currentNodeId} не найден`);
            this.close();
            return;
        }
        
        const availableOptions = this.filterOptionsByConditions(node.options || []);
        
        if (availableOptions.length === 0) {
            this.close();
            return;
        }
        
        this.dialogueUI.showDialogue({
            npcName: this.npc.name,
            npcText: node.npcText,
            options: availableOptions,
            onSelect: (option) => this.selectOption(option)
        });
    }
    
    /**
     * Отфильтровать опции по условиям
     */
    filterOptionsByConditions(options) {
        return options.filter(option => {
            if (!option.condition) return true;
            
            const condition = option.condition;
            
            if (condition.gold !== undefined) {
                const playerGold = this.getPlayerGold();
                if (playerGold < condition.gold) return false;
            }
            
            if (condition.level !== undefined) {
                const playerLevel = this.game.player?.getStats()?.level || 1;
                if (playerLevel < condition.level) return false;
            }
            
            if (condition.hasAbility) {
                const abilityId = condition.hasAbility;
                const abilities = this.game.abilityService?.getCharacterAbilities(this.game.player.id) || [];
                if (!abilities.some(a => a.id === abilityId)) return false;
            }
            
            if (condition.notHasAbility) {
                const abilityId = condition.notHasAbility;
                const abilities = this.game.abilityService?.getCharacterAbilities(this.game.player.id) || [];
                if (abilities.some(a => a.id === abilityId)) return false;
            }
            
            return true;
        });
    }
    
    /**
     * Обработать выбор опции игроком
     */
    async selectOption(option) {
        if (option.action) {
            const shouldContinue = await this.executeAction(option.action);
            if (shouldContinue === false) return;
        }
        
        if (option.nextNode) {
            this.currentNodeId = option.nextNode;
            this.showCurrentNode();
        } else {
            this.close();
        }
    }
    
    /**
     * Выполнить действие
     * @returns {boolean|void} false если не нужно продолжать диалог
     */
    async executeAction(action) {
        const player = this.game.player;
        const eventBus = this.game.eventBus;
        
        switch (action.type) {
            case 'heal':
                const stats = player.getStats();
                player.heal(stats.maxHealth);
                eventBus?.emit('log:add', { message: 'Вы полностью исцелены', type: 'success' });
                eventBus?.emit('player:statsChanged', player.getStats());
                break;
                
            case 'showTrainList':
                this.trainContext = {
                    abilityType: action.abilityType,
                    abilities: action.abilities,
                    cost: action.cost,
                    returnNode: action.returnNode
                };
                this.showTrainingList(action);
                return false;
                
            case 'teleport':
                await this.teleportTo(action.destination);
                this.close();
                return false;
                
            case 'giveItem':
                this.giveItemToPlayer(action.itemId, action.count || 1);
                break;
                
            case 'takeItem':
                this.takeItemFromPlayer(action.itemId, action.count || 1);
                break;
                
            case 'giveGold':
                this.giveGoldToPlayer(action.amount);
                break;
                
            case 'takeGold':
                this.takeGoldFromPlayer(action.amount);
                break;
                
            case 'setFlag':
                this.setFlag(action.flag, action.value);
                break;
                
            case 'close':
                break;
        }
    }
    
    /**
     * Показать список способностей для изучения в UI
     */
    showTrainingList(action) {
        const availableAbilities = this.getAvailableAbilities(action.abilityType, action.abilities);
        
        if (availableAbilities.length === 0) {
            this.game.eventBus?.emit('log:add', { 
                message: 'Вы уже изучили все доступные способности', 
                type: 'info' 
            });
            this.close();
            return;
        }
        
        const abilities = availableAbilities.map(id => {
            let ability = this.game.abilityService?.getAbility(id);
            if (!ability && action.abilityType === 'passive') {
                ability = this.game.passiveAbilityService?.getPassive(id);
            }
            return { id, name: ability?.name || id };
        });
        
        const typeNames = { spell: 'заклинание', skill: 'умение', passive: 'способность' };
        const typeName = typeNames[action.abilityType] || action.abilityType;
        
        this.dialogueUI.showAbilityList({
            title: `Выберите ${typeName}`,
            npcName: this.npc.name,
            cost: action.cost,
            abilities: abilities,
            onSelect: (abilityId) => {
                const success = this.learnAbility(action.abilityType, abilityId, action.cost);
                if (success) {
                    // После успешного изучения возвращаемся в диалог
                    this.currentNodeId = this.trainContext.returnNode;
                    this.trainContext = null;
                    this.showCurrentNode();
                }
            },
            onBack: () => {
                // Возврат без изучения
                this.currentNodeId = this.trainContext.returnNode;
                this.trainContext = null;
                this.showCurrentNode();
            }
        });
    }
    
    /**
     * Получить список доступных для изучения способностей
     */
    getAvailableAbilities(abilityType, abilities) {
        const player = this.game.player;
        let learnedIds = [];
        
        if (abilityType === 'passive') {
            const passiveManager = player.passiveManager;
            if (passiveManager) {
                const allPassives = passiveManager.getAllPassives();
                learnedIds = [...allPassives.innate, ...allPassives.learned.map(p => p.id)];
            }
        } else {
            const learnedAbilities = this.game.abilityService?.getCharacterAbilities(player.id, abilityType) || [];
            learnedIds = learnedAbilities.map(a => a.id);
        }
        
        return abilities.filter(id => !learnedIds.includes(id));
    }
    
    /**
     * Изучить способность
     * @returns {boolean} успех
     */
    learnAbility(abilityType, abilityId, cost) {
        const player = this.game.player;
        
        if (cost > 0) {
            const playerGold = this.getPlayerGold();
            if (playerGold < cost) {
                this.game.eventBus?.emit('log:add', { 
                    message: `Недостаточно золота (нужно ${cost})`, 
                    type: 'error' 
                });
                return false;
            }
            this.game.gameManager?._spendGoldFromInventory(cost);
        }
        
        if (abilityType === 'passive') {
            const result = player.learnPassive(abilityId);
            this.game.eventBus?.emit('log:add', { 
                message: result.message || `Изучена способность: ${abilityId}`, 
                type: result.success ? 'success' : 'error' 
            });
            if (!result.success) return false;
        } else {
            this.game.abilityService.addAbilityToCharacter(player.id, abilityId);
            this.game.eventBus?.emit('log:add', { 
                message: `Изучено: ${abilityId}`, 
                type: 'success' 
            });
        }
        
        this.game.eventBus?.emit('player:statsChanged', player.getStats());
        return true;
    }
    
    /**
     * Телепортироваться в указанную локацию
     */
    async teleportTo(destination) {
        if (this.game.combatSystem?.isInCombat()) {
            this.game.eventBus?.emit('log:add', { 
                message: 'Нельзя телепортироваться во время боя', 
                type: 'error' 
            });
            return;
        }
        
        this.game.eventBus?.emit('log:add', { 
            message: `Вы телепортировались в ${destination.name}`, 
            type: 'success' 
        });
        
        await this.game.zoneManager.moveToOtherZone(`${destination.zone}:${destination.room}`);
        this.game.eventBus?.emit('player:statsChanged', this.game.player.getStats());
    }
    
    getPlayerGold() {
        const items = this.game.gameState?.playerContainer?.getAllItems() || [];
        const gold = items.find(i => i.id === 'gold');
        return gold?.count || 0;
    }
    
    giveGoldToPlayer(amount) {
        this.game.gameManager?._addGoldToInventory(amount);
    }
    
    takeGoldFromPlayer(amount) {
        this.game.gameManager?._spendGoldFromInventory(amount);
    }
    
    giveItemToPlayer(itemId, count) {
        const item = window.itemFactory?.create(itemId, count);
        if (item) {
            this.game.player?.addItem(item);
            this.game.eventBus?.emit('log:add', { 
                message: `Получено: ${item.name} x${count}`, 
                type: 'success' 
            });
        }
    }
    
    takeItemFromPlayer(itemId, count) {
        console.log('takeItemFromPlayer:', itemId, count);
    }
    
    setFlag(flag, value) {
        if (!this.game.player.flags) {
            this.game.player.flags = {};
        }
        this.game.player.flags[flag] = value;
    }
    
    close() {
        if (this.dialogueUI) {
            this.dialogueUI.hide();
        }
        this.currentDialogue = null;
        this.currentNodeId = null;
        this.npc = null;
        this.trainContext = null;
        
        if (this.onClose) {
            this.onClose();
            this.onClose = null;
        }
    }
}

export { DialogueSystem };
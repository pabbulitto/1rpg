// services/NPCService.js
import { NonPlayerCharacter } from '../core/NonPlayerCharacter.js';
import { StatManager } from '../core/StatManager.js';

/**
 * NPCService - сервис создания мирных NPC
 * 
 * Аналогичен EnemyService, но для не-враждебных персонажей.
 * Создает NPC из конфигов npcs.json и добавляет их в комнаты.
 */
class NPCService {
    constructor(game) {
        this.game = game;
        this.npcsData = null;
    }
    
    /**
     * Загрузить данные NPC из DataService
     */
    loadNPCsData() {
        // Пробуем получить через переданный game
        if (this.game && this.game.dataService) {
            this.npcsData = this.game.dataService.getAllNPCs();
        } 
        // Fallback на window.game
        else if (window.game && window.game.dataService) {
            this.npcsData = window.game.dataService.getAllNPCs();
        }
        // Абсолютный fallback на глобальную переменную
        else if (window.npcsData) {
            this.npcsData = window.npcsData;
        }
        else {
            console.warn('NPCService: не удалось загрузить данные NPC');
            this.npcsData = {};
        }
    }
    
    /**
     * Создать экземпляр NPC
     * @param {string} npcId - ID NPC из npcs.json
     * @param {Object} options - дополнительные параметры
     * @param {number} options.gridX - координата X в комнате
     * @param {number} options.gridY - координата Y в комнате
     * @returns {NonPlayerCharacter|null}
     */
    createNPC(npcId, options = {}) {
        if (!this.npcsData) {
            this.loadNPCsData();
        }
        
        // Пробуем получить конфиг из нескольких источников
        let config = this.npcsData?.[npcId];
        if (!config && window.npcsData) {
            config = window.npcsData[npcId];
        }
        
        if (!config) {
            console.error(`NPCService: NPC ${npcId} не найден в данных`);
            return null;
        }
        
        // Получаем eventBus из game или window
        const eventBus = this.game?.gameState?.eventBus || window.game?.gameState?.eventBus;
        const equipmentService = this.game?.equipmentService || window.game?.equipmentService;
        const abilityService = this.game?.abilityService || window.game?.abilityService;
        const battleSystem = this.game?.battleSystem || window.game?.battleSystem;
        
        const npc = new NonPlayerCharacter({
            eventBus: eventBus,
            equipmentService: equipmentService,
            abilityService: abilityService,
            battleSystem: battleSystem,
            statManager: new StatManager()
        });
        
        npc.loadNPCFromConfig(config);
        
        if (options.gridX !== undefined) npc.gridX = options.gridX;
        if (options.gridY !== undefined) npc.gridY = options.gridY;
        
        return npc;
    }
    
    /**
     * Создать NPC и сразу добавить в комнату
     * @param {string} roomId - ID комнаты
     * @param {string} npcId - ID NPC из npcs.json
     * @param {number} gridX - координата X
     * @param {number} gridY - координата Y
     * @returns {NonPlayerCharacter|null}
     */
    createAndAddToRoom(roomId, npcId, gridX, gridY) {
        const npc = this.createNPC(npcId, { gridX, gridY });
        
        if (npc) {
            const zoneManager = this.game?.zoneManager || window.game?.zoneManager;
            const gameState = this.game?.gameState || window.game?.gameState;
            
            if (zoneManager) {
                const position = gameState?.getPosition();
                npc.zoneId = position?.zone || null;
                npc.roomId = roomId;
                zoneManager.addEntity(roomId, npc);
            }
        }
        
        return npc;
    }
    
    /**
     * Получить данные NPC по ID
     * @param {string} npcId
     * @returns {Object|null}
     */
    getNPCData(npcId) {
        if (!this.npcsData) {
            this.loadNPCsData();
        }
        return this.npcsData?.[npcId] || window.npcsData?.[npcId] || null;
    }
    
    /**
     * Получить всех NPC в комнате
     * @param {string} roomId
     * @returns {Array<NonPlayerCharacter>}
     */
    getNPCsInRoom(roomId) {
        const zoneManager = this.game?.zoneManager || window.game?.zoneManager;
        if (!zoneManager) return [];
        
        const entities = zoneManager.getRoomEntities(roomId) || [];
        return entities.filter(e => e.isNPC && e.isNPC());
    }
}

export { NPCService };
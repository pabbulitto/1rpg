// services/EnemyService.js
import { NonPlayerCharacter } from '../core/NonPlayerCharacter.js';
import { StatManager } from '../core/StatManager.js';

/**
 * EnemyService - сервис создания врагов
 * 
 * В новой архитектуре:
 * - Только создает врагов, не хранит их
 * - Враги живут в ZoneManager.rooms
 * - Поиск врагов делегируется в ZoneManager
 */
class EnemyService {
    constructor(enemiesData, battleSystem = null) {
        this.enemiesData = enemiesData;
        this.battleSystem = battleSystem;
        
        // Респавн будет позже, через ZoneManager и TimeSystem
    }
    
    /**
     * Создать врага
     * @param {string} enemyType - тип врага из enemies.json
     * @param {number} level - уровень (опционально)
     * @returns {NonPlayerCharacter|null} созданный враг
     */
    create(enemyType, level = 1) {
        if (!this.enemiesData || !this.enemiesData[enemyType]) {
            console.error(`EnemyService: враг ${enemyType} не найден в данных`);
            return null;
        }
        
        const config = this.enemiesData[enemyType];
        const enemy = this._createEnemyFromConfig(config, level, enemyType);
        
        return enemy;
    }
    
    /**
     * Создать врага и сразу добавить в комнату
     * @param {string} roomId - ID комнаты
     * @param {string} enemyType - тип врага
     * @param {number} level - уровень
     * @returns {NonPlayerCharacter|null} созданный враг
     */
    createAndAddToRoom(roomId, enemyType, level = 1) {
        const enemy = this.create(enemyType, level);
        if (enemy && window.game?.zoneManager) {
            enemy.zoneId = window.game.gameState.getPosition().zone;
            enemy.roomId = roomId;
            window.game.zoneManager.addEntity(roomId, enemy);
        }
        return enemy;
    }
    
    /**
     * Создать врага из конфига
     * @private
     */
    _createEnemyFromConfig(config, level, enemyType) {
        const enemy = new NonPlayerCharacter({
            eventBus: window.game?.gameState?.eventBus,
            equipmentService: window.game?.equipmentService,
            abilityService: window.game?.abilityService,
            battleSystem: this.battleSystem,
            statManager: new StatManager()
        });
        
        enemy.loadFromConfig(config, level, enemyType);
        return enemy;
    }
    
    /**
     * Получить врага по ID (делегирует в ZoneManager)
     * @param {string} enemyId - ID врага
     * @returns {NonPlayerCharacter|null} враг или null
     */
    getEnemyById(enemyId) {
        const entity = window.game?.zoneManager?.getEntityById(enemyId);
        // Возвращаем только живых врагов (не игроков, не трупы)
        if (entity && entity.state === 'alive' && entity.type !== 'player') {
            return entity;
        }
        return null;
    }
    
    /**
     * Получить всех врагов в комнате
     * @param {string} roomId - ID комнаты
     * @returns {Array<NonPlayerCharacter>} массив врагов
     */
    getEnemiesInRoom(roomId) {
        const entities = window.game?.zoneManager?.getRoomEntities(roomId) || [];
        return entities.filter(e => e.type !== 'player' && e.state === 'alive');
    }
    
    /**
     * Получить трупы в комнате
     * @param {string} roomId - ID комнаты
     * @returns {Array<NonPlayerCharacter>} массив трупов
     */
    getCorpsesInRoom(roomId) {
        const entities = window.game?.zoneManager?.getRoomEntities(roomId) || [];
        return entities.filter(e => e.state === 'corpse');
    }
    
    /**
     * Планировать респавн врага (заглушка, будет позже)
     * @param {string} roomId - ID комнаты
     * @param {Object} enemyData - данные врага
     * @param {number} respawnTicks - через сколько тиков
     */
    scheduleRespawn(roomId, enemyData, respawnTicks = 300) {
        // TODO: реализовать через TimeSystem + ZoneManager
        console.log(`EnemyService: запланирован респавн в ${roomId} через ${respawnTicks} тиков`);
        
        // В будущем здесь будет эмит события для TimeSystem
        // this.gameState.eventBus.emit('enemy:scheduleRespawn', {
        //     roomId, enemyData, respawnTicks
        // });
    }
    
    // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ =====
    
    /**
     * Конвертация старых статов (используется в loadFromConfig)
     */
    _convertOldStats(config, level) {
        const scale = level / (config.baseLevel || 1);
        return {
            strength: Math.floor((config.baseStrength || 10) * scale),
            dexterity: Math.floor((config.baseDexterity || 10) * scale),
            constitution: Math.floor((config.baseConstitution || 10) * scale),
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
            health: Math.floor((config.baseHealth || 10) * scale),
            maxHealth: Math.floor((config.baseHealth || 10) * scale),
            armorClass: config.baseArmorClass || 10,
            attack: config.baseAttackMod || 0
        };
    }
}

export { EnemyService };
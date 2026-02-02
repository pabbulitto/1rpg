// services/EnemyService.js
import { Enemy } from '../core/Enemy.js'; // ПРЯМОЙ ИМПОРТ!

class EnemyService {
    constructor(enemiesData) {
        this.enemiesData = enemiesData;
        this.activeEnemies = new Map(); // enemyId → Enemy
        this.respawnQueues = new Map(); // roomId → [respawnData]
    }
    
    // 1. СОЗДАНИЕ ВРАГА (без window!)
    create(enemyType, level = 1) {
        if (!this.enemiesData) {
        console.error('EnemyService: данные врагов не загружены');
        return this.createFallbackEnemy(level);
        }
        if (!this.enemiesData[enemyType]) {
            console.error(`EnemyService: неизвестный тип врага "${enemyType}"`);
            return this.createFallbackEnemy(level);
        }
        
        return new Enemy(enemyType, level);
    }
    
    // 2. СОЗДАНИЕ ИЗ КОНФИГА ЗОНЫ
    createFromZoneConfig(zoneEnemyConfig) {
        const { type, level = 1, count = 1 } = zoneEnemyConfig;
        const enemies = [];
        
        for (let i = 0; i < count; i++) {
            const enemy = this.create(type, level);
            if (enemy) {
                enemy.zoneId = zoneEnemyConfig.zoneId; // для будущего
                enemies.push(enemy);
            }
        }
        
        return enemies;
    }
    
    // 3. УПРАВЛЕНИЕ АКТИВНЫМИ ВРАГАМИ В КОМНАТЕ
    addToRoom(roomId, enemy) {
        if (!this.activeEnemies.has(roomId)) {
            this.activeEnemies.set(roomId, []);
        }
        
        enemy.roomId = roomId;
        enemy.id = `enemy_${roomId}_${Date.now()}_${Math.random()}`;
        
        this.activeEnemies.get(roomId).push(enemy);
        return enemy.id;
    }
    
    getRoomEnemies(roomId) {
        return this.activeEnemies.get(roomId) || [];
    }
    
    removeEnemy(enemyId) {
        for (const [roomId, enemies] of this.activeEnemies) {
            const index = enemies.findIndex(e => e.id === enemyId);
            if (index !== -1) {
                const enemy = enemies[index];
                enemies.splice(index, 1);
                
                // ЗАПЛАНИРОВАТЬ РЕСПАВН (будущее)
                this.scheduleRespawn(roomId, enemy);
                
                return enemy;
            }
        }
        return null;
    }
    
    // 4. РЕСПАВН СИСТЕМА (заготовка)
    scheduleRespawn(roomId, enemy, respawnTicks = 10) {
        if (!this.respawnQueues.has(roomId)) {
            this.respawnQueues.set(roomId, []);
        }
        
        this.respawnQueues.get(roomId).push({
            enemyType: enemy.type,
            level: enemy.level,
            respawnAt: window.game?.gameState?.getTimeSystem()?.getCurrentTick() + respawnTicks || 0
        });
    }
    
    // 5. ПРОЦЕССИНГ РЕСПАВНА (вызывается из TimeSystem)
    processRespawns(currentTick) {
        for (const [roomId, queue] of this.respawnQueues) {
            const toRespawn = queue.filter(data => data.respawnAt <= currentTick);
            
            toRespawn.forEach(data => {
                const enemy = this.create(data.enemyType, data.level);
                this.addToRoom(roomId, enemy);
            });
            
            // Удаляем обработанные
            this.respawnQueues.set(roomId, 
                queue.filter(data => data.respawnAt > currentTick)
            );
        }
    }
    
    // 6. РЕЗЕРВНЫЙ ВРАГ
    createFallbackEnemy(baseLevel = null) {
        const fallbackEnemies = ["Скелет", "Гоблин", "Волк", "Бандит"];
        // Находим первого существующего в данных
        let enemyType = fallbackEnemies.find(type => 
            this.enemiesData && this.enemiesData[type]
        ) || "Скелет";
        // Рандомный уровень или переданный
        const level = baseLevel || Math.floor(Math.random() * 15) + 1;
        
        console.warn(`EnemyService: резервный враг ${enemyType} уровня ${level}`);
        
        return this.create(enemyType, level);
    }
}

export { EnemyService };
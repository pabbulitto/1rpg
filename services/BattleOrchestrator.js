import { BattleSystem } from '../system/BattleSystem.js';
import { PlayerCharacter } from '../core/PlayerCharacter.js';
/**
 * BattleOrchestrator - центральный координатор боя
 * Содержит ВСЮ бизнес-логику завершения боя
 * CombatSystem вызывает его для победы/поражения
 */
class BattleOrchestrator {
    constructor(game, battleSystem = null, combatSystem = null) {
        
        this.game = game;
        this.battleSystem = battleSystem || new BattleSystem();
        this.battleSystem.game = game;
        
        this.combatSystem = combatSystem || null;
    }
    
    /**
     * Начать бой 
     */
    startBattle(enemy) {
        // Обновляем GameState с врагом
        this.game.gameState.updateBattle(enemy, true);
        
        // Получаем данные боя от BattleSystem
        const battleStart = this.battleSystem.startBattle(this.game.player, enemy);
        
        if (this.combatSystem) {
            // Передаем ID врага в CombatSystem
            this.combatSystem.startBattle(this.game.player, enemy.id);
        }
        
        // Эмитим событие с данными для UI
        this.game.gameState.eventBus.emit('battle:start', {
            player: this.game.player,
            playerStats: battleStart.player,
            enemyId: battleStart.enemyId,
            enemyData: battleStart.enemyData,
            log: battleStart.log
        });
    }   
    /**
     * Победа в бою
     * @param {Object} defeatedEnemy - побежденный враг (передается из CombatSystem)
     */
    endBattleVictory(defeatedEnemy) {
        // Если враг не передан, пробуем получить из battleState (для обратной совместимости)
        let enemy = defeatedEnemy;
        
        if (!enemy) {
            const battle = this.game.gameState.getBattleState();
            if (!battle.currentEnemyId) return;
            enemy = this.game.gameState.getCurrentEnemy();
            if (!enemy) return;
        }
        
        // ВЫЗЫВАЕТ BattleSystem для расчета наград
        const result = this.battleSystem.endBattleVictory(
            this.game.player,
            enemy,
        );
        
        // ДОБАВЛЯЕТ золото в GameState
        this.game.gameState.addGold(result.gold);
        
        // UI события
        this.game.gameState.eventBus.emit('victory:show', result);
        
        // Очистка состояния боя
        this._endBattleCleanup();
    }
    
    /**
     * Поражение в бою с возрождением
     */
    endBattleDefeat() {
        // 1. Логируем смерть 
        this.game.gameState.eventBus.emit('log:add', { 
            message: "💀 Вы погибли...", 
            type: 'error' 
        });
        
        // 2. Превращаем игрока в труп
        const gameState = this.game.gameState;
        const player = this.game.player;
        const position = gameState.getPosition();
        
        // Меняем состояние игрока на corpse
        player.die();
        
        // Помещаем игрока в текущую комнату как сущность
        if (this.game.zoneManager) {
            this.game.zoneManager.addEntity(position.room, player);
        }
        
        // 3. Создаем нового игрока в стартовой точке
        this._respawnNewPlayer();
        
        // 4. Очищаем состояние боя
        this._endBattleCleanup();
    }
    
    /**
     * Создать нового игрока в стартовой точке
     * @private
     */
    _respawnNewPlayer() {
        const gameState = this.game.gameState;
        const zonesData = this.game.zoneManager?.zonesData;
        const oldPlayer = this.game.player; 
        
        if (!zonesData?.village?.startRoom) {
            console.error('BattleOrchestrator: стартовая точка не найдена');
            return;
        }
        
        const startZone = 'village';
        const startRoom = zonesData.village.startRoom;
        
        // ===== 1. СОЗДАЕМ НОВОГО ИГРОКА =====
        const newPlayer = new PlayerCharacter(gameState, {
            eventBus: gameState.eventBus,
            equipmentService: this.game.equipmentService,
            abilityService: this.game.abilityService,
            battleSystem: this.game.battleSystem
        });
        
        // Копируем имя и уровень
        newPlayer.name = oldPlayer.name;
        newPlayer.level = oldPlayer.level;
        
        // Копируем опыт (с учетом штрафа, который будет позже)
        newPlayer.exp = oldPlayer.exp;
        newPlayer.expToNext = oldPlayer.expToNext;
        
        // ===== 2. УСТАНАВЛИВАЕМ РЕСУРСЫ В 0 =====
        const statManager = newPlayer.getStatManager();
        statManager.setResource('health', 1);
        statManager.setResource('mana', 1);
        statManager.setResource('stamina', 1);
        
        // ===== 3. ЗАМЕНЯЕМ ИГРОКА =====
        this.game.player = newPlayer;
        
        // ===== 4. ОБНОВЛЯЕМ ПОЗИЦИЮ =====
        gameState.updatePosition(startZone, startRoom);
        
        // ===== 5. ДОБАВЛЯЕМ НОВОГО ИГРОКА В КОМНАТУ =====
        this.game.zoneManager.addEntity(startRoom, newPlayer);
        
        // ===== 6. ОБНОВЛЯЕМ МИНИКАРТУ =====
        const minimapMgr = this.game.zoneManager.getMinimapManager();
        if (minimapMgr) {
            minimapMgr.switchZone(startZone);
            if (minimapMgr.onPlayerMoved) minimapMgr.onPlayerMoved();
        }
        
        // ===== 7. ШТРАФ ОПЫТА =====
        const expToNext = gameState.player.expToNext || 100;
        const penalty = Math.floor(expToNext * 0.18);
        gameState.player.exp = Math.max(0, (gameState.player.exp || 0) - penalty);
        
        // ===== 8. СОБЫТИЯ ДЛЯ UI =====
        this.game.gameState.eventBus.emit('minimap:update');
        this.game.gameState.eventBus.emit('player:positionChanged');
        this.game.gameState.eventBus.emit('room:updated', 
            this.game.zoneManager.getCurrentRoomInfo());
        this.game.gameState.eventBus.emit('exploration:show');
        this.game.gameState.eventBus.emit('player:statsChanged', this.game.player.getStats());
        
        // ===== 9. ЛОГИРУЕМ ВОЗРОЖДЕНИЕ =====
        this.game.gameState.eventBus.emit('log:add', {
            message: `Вы возродились в стартовой точке. Потерян опыт: ${penalty}`,
            type: 'warning'
        });
    }
    /**
     * Очистка состояния боя 
     */
    _endBattleCleanup() {
        this.game.gameState.updateBattle(null, false);
        this.game.gameState.eventBus.emit('battle:end');
        this.game.gameState.eventBus.emit('exploration:show');
        this.game.gameState.eventBus.emit('player:statsChanged', this.game.player.getStats());
        this.game.gameState.eventBus.emit('minimap:refresh');
        
        if (this.combatSystem) {
            this.combatSystem.currentBattle = null;
            this.combatSystem.isPlayerTurn = false;
        }
    }
    
    /**
     * Использование предмета в бою 
     */
    useItemInBattle(itemIndex, fromBelt = false) {
        const battle = this.game.gameState.getBattleState();
        if (!battle.inBattle || !battle.currentEnemyId) {
            return; 
        }
        
        const enemy = this.game.gameState.getCurrentEnemy();
        if (!enemy) return;
        
        let item = null;
        let useResult = null;
        
        if (fromBelt) {
            const beltData = this.game.beltSystem.beltSlots[itemIndex];
            if (!beltData || !beltData.item) return;
            
            item = beltData.item;
            useResult = item.use(this.game.player);
            
            if (useResult && useResult.success) {
                item.count--;
                
                if (item.count <= 0) {
                    this.game.beltSystem.beltSlots[itemIndex] = null;
                    this.game.gameState.eventBus.emit('belt:itemRemoved', {
                        slotIndex: itemIndex,
                        item: item.getInfo()
                    });
                } else {
                    this.game.gameState.eventBus.emit('belt:itemUpdated', {
                        slotIndex: itemIndex,
                        count: item.count,
                        item: item.getInfo()
                    });
                }
                
                this.game.gameState.eventBus.emit('belt:itemUsed', {
                    slotIndex: itemIndex,
                    item: item.getInfo(),
                    result: useResult
                });
            } else {
                return; // Если не удалось использовать
            }
        } else {
            return; // Использование из инвентаря не поддерживается
        }
        
        // Враг контратакует
        const playerStats = this.game.player.getStats();
        const enemyDamage = enemy.attackPlayer(playerStats);
        const playerResult = this.game.player.takeDamage(enemyDamage);
        
        this.game.gameState.eventBus.emit('log:batch', [
            { message: `Вы использовали ${item.name}`, type: 'battle' },
            { message: `${enemy.name} атакует!`, type: 'battle' },
            { message: `Вы получили ${enemyDamage} урона`, type: 'battle' }
        ]);
        
        this.game.gameState.eventBus.emit('player:statsChanged', this.game.player.getStats());
        
        if (playerResult.isDead) {
            this.endBattleDefeat();
        } else {
            this.game.gameState.eventBus.emit('battle:update', {
                player: this.game.player.getStats(),
                enemy: enemy.getInfo()
            });
        }
    }
    
    /**
     * Попытка побега 
     */
    tryEscape() {
        const battle = this.game.gameState.getBattleState();
        const enemy = this.game.gameState.getCurrentEnemy();
        
        if (!battle.inBattle || !enemy || enemy.health <= 0) {
            console.warn('tryEscape: бой не активен или враг не найден');
            return;
        }
        
        console.log('tryEscape: пытаемся сбежать от', enemy.name);
        
        // 1. Используем BattleSystem для расчета побега
        const result = this.battleSystem.tryEscape(this.game.player, enemy);
        
        // 2. Логируем результат попытки побега
        if (result.log && result.log.length > 0) {
            this.game.gameState.eventBus.emit('log:batch', 
                result.log.map(msg => ({ message: msg, type: 'battle' }))
            );
        }
        
        // 3. Обрабатываем результат
        if (result.success) {
            // Успешный побег - заканчиваем бой
            this.game.gameState.eventBus.emit('log:add', {
                message: '🏃 Вы успешно сбежали!',
                type: 'success'
            });
            this._endBattleCleanup();
        } else {
            // Провал побега - игрок пропускает ход, враг атакует
            this.game.gameState.eventBus.emit('log:add', {
                message: '❌ Не удалось сбежать! Вы теряете ход.',
                type: 'warning'
            });
            
            if (this.combatSystem && this.combatSystem.currentBattle) {
                // Передаём ход врагу
                this.combatSystem.isPlayerTurn = false;
                
                // Враг атакует в свой ход
                setTimeout(() => {
                    if (this.combatSystem.currentBattle) {
                        this.combatSystem.processEnemyTurn();
                    }
                }, 300);
            }
        }
    }
}

export { BattleOrchestrator };
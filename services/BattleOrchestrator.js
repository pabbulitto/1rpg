import { BattleSystem } from '../system/BattleSystem.js';
import { PlayerCharacter } from '../core/PlayerCharacter.js';
import { EntityContainer } from '../core/EntityContainer.js';
import { PassiveManager } from '../core/PassiveManager.js';
/**
 * BattleOrchestrator - центральный координатор боя
 * Содержит ВСЮ бизнес-логику завершения боя
 * CombatSystem вызывает его для победы/поражения
 */
class BattleOrchestrator {
    constructor(game, battleSystem = null, combatSystem = null) {
        
        this.game = game;
        this.game.gameState.eventBus.on('battle:escape', async () => {
        await this.tryEscape();
        });
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
        
        let startZone = oldPlayer.startZone || 'village';
        let startRoom = oldPlayer.startRoom;

        // Если у игрока нет сохранённой комнаты
        if (!startRoom) {
            // Пробуем взять из данных зоны
            if (zonesData?.village?.startRoom) {
                startRoom = zonesData.village.startRoom;
            } else {
                // Абсолютный fallback
                startRoom = 'village_square';
                console.warn('BattleOrchestrator: используется hardcoded стартовая комната');
            }
        }
        // ===== СОЗДАЁМ НОВЫЙ КОНТЕЙНЕР =====
        const newContainer = new EntityContainer();
        gameState.playerContainer = newContainer;          
        // ===== 1. СОЗДАЕМ НОВОГО ИГРОКА =====
        const newPlayer = new PlayerCharacter(gameState, {
            eventBus: gameState.eventBus,
            equipmentService: this.game.equipmentService,
            abilityService: this.game.abilityService,
            battleSystem: this.game.battleSystem
        });
        // Копируем способности и их мастерство
        const oldAbilities = this.game.abilityService.getCharacterAbilities(oldPlayer.id);
        oldAbilities.forEach(ability => {
            const mastery = this.game.abilityService.getMastery(oldPlayer.id, ability.id);
            this.game.abilityService.addAbilityToCharacter(newPlayer.id, ability.id);
            this.game.abilityService.setMastery(newPlayer.id, ability.id, mastery);
        });
            // Копируем пассивки 
        if (oldPlayer.passiveManager) {
            // Создаем PassiveManager для нового игрока
            newPlayer.passiveManager = new PassiveManager(
                newPlayer.id,
                newPlayer.class,
                gameState,
                window.game.passiveAbilityService,
                window.game.formulaParser,
                window.game.contextManager
            );
            
            // Копируем данные из старого менеджера
            newPlayer.passiveManager.fromJSON(oldPlayer.passiveManager.toJSON());
        }
        // Копируем имя и уровень
        newPlayer.name = oldPlayer.name;
        newPlayer.level = oldPlayer.level;
        
        // Копируем опыт (с учетом штрафа, который будет позже)
        newPlayer.exp = oldPlayer.exp;
        newPlayer.expToNext = oldPlayer.expToNext;
        newPlayer.sprite = oldPlayer.originalSprite || oldPlayer.sprite;     // копируем спрайт
        newPlayer.portrait = oldPlayer.portrait; // копируем портрет
        newPlayer.width = 85;
        newPlayer.height = 85;
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

        // ===== 7. ШТРАФ ОПЫТА =====
        const expToNext = gameState.player.expToNext || 100;
        const penalty = Math.floor(expToNext * 0.18);
        gameState.player.exp = Math.max(0, (gameState.player.exp || 0) - penalty);
        
        // ===== 8. СОБЫТИЯ ДЛЯ UI =====
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
        
        // Обновить список трупов
        const roomId = this.game.gameState.getPosition().room;
        const entities = this.game.zoneManager.getRoomEntitiesInfo(roomId);
        this.game.gameState.eventBus.emit('room:entitiesUpdated', {
            roomId: roomId,
            entities: entities
        });
        
        if (this.combatSystem) {
            this.combatSystem.currentBattle = null;
            this.combatSystem.isPlayerTurn = false;
        }
    }
    /**
     * Попытка побега 
     */
    async tryEscape() {
        const battle = this.game.gameState.getBattleState();
        const enemy = this.game.gameState.getCurrentEnemy();
        
        if (!battle.inBattle || !enemy) {
            console.warn('tryEscape: бой не активен или враг не найден');
            return;
        }
        
        const enemyStats = enemy.getStats ? enemy.getStats() : enemy;
        if (enemyStats.health <= 0) {
            console.warn('tryEscape: враг уже мертв');
            return;
        }
        
        console.log('tryEscape: пытаемся сбежать от', enemy.name);
        
        // Получаем систему побега
        const escapeSystem = this.game.escapeSystem;
        if (!escapeSystem) {
            console.error('tryEscape: EscapeSystem не найдена');
            return;
        }
        
        // Проверяем возможность побега
        const canEscape = escapeSystem.canEscape(this.game.player);
        if (!canEscape.success) {
            this.game.gameState.eventBus.emit('log:add', {
                message: canEscape.reason,
                type: 'warning'
            });
            
            // Провал проверки - враг атакует
            if (this.combatSystem && this.combatSystem.currentBattle) {
                this.combatSystem.isPlayerTurn = false;
                setTimeout(() => {
                    if (this.combatSystem.currentBattle) {
                        this.combatSystem.processEnemyTurn();
                    }
                }, 300);
            }
            return;
        }
        
        // Получаем информацию о побеге
        const escapeInfo = escapeSystem.getEscapeInfo(this.game.player);
        
        // Проверяем пассивку на выбор направления
        const canChoose = this.game.player.passiveManager?.hasFlag('canChooseEscapeDestination');
        
        if (canChoose && escapeInfo.destinations.length > 0) {
            // Есть пассивка - показываем UI выбора
            this.game.gameState.eventBus.emit('escape:showChoices', {
                destinations: escapeInfo.destinations,
                staminaCost: escapeInfo.staminaCost,
                expPenalty: escapeInfo.expPenalty
            });
        } else {
            // Нет пассивки - случайный побег (ждём завершения)
            const result = await escapeSystem.escapeRandom(this.game.player);
            await this._processEscapeResult(result, enemy);
        }
    }
    async _performRandomEscape(escapeSystem, enemy) {
        const result = await escapeSystem.escapeRandom(this.game.player);
        this._processEscapeResult(result, enemy);
    }
    async _processEscapeResult(result, enemy) {
        if (!result.success) {
            // Побег не удался
            this.game.gameState.eventBus.emit('log:add', {
                message: result.reason || 'Не удалось сбежать!',
                type: 'warning'
            });
            
            if (this.combatSystem && this.combatSystem.currentBattle) {
                this.combatSystem.isPlayerTurn = false;
                setTimeout(() => {
                    if (this.combatSystem.currentBattle) {
                        this.combatSystem.processEnemyTurn();
                    }
                }, 300);
            }
            return;
        }
        
        // Успешный побег
        if (result.expPenalty > 0) {
            this.game.gameState.eventBus.emit('log:add', {
                message: `Вы потеряли ${result.expPenalty} опыта при побеге`,
                type: 'warning'
            });
        }
        
        this.game.gameState.eventBus.emit('log:add', {
            message: `🏃 Вы сбежали в ${result.destination.roomName}!`,
            type: 'success'
        });
        
        // Завершаем бой
        this._endBattleCleanup();
    }
}

export { BattleOrchestrator };
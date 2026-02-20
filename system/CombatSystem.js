/**
 * CombatSystem - система мгновенных действий в бою
 * Интегрируется с ActionHandler для обработки выбора игрока
 * Управляет текущим боем и передачей хода
 */
class CombatSystem {
    constructor(battleSystem, eventBus) {
        this.battleSystem = battleSystem;
        this.eventBus = eventBus;
        this.currentBattle = null; // {player, enemies, round, turn}
        this.isPlayerTurn = true;
        
        this.setupEventListeners();
    }
    
    /**
     * Настроить подписки на события
     */
    setupEventListeners() {
        // Начало боя из BattleOrchestrator
        this.eventBus.on('battle:start', (data) => {
            this.startBattle(data.player, data.enemyId || data.enemy);
        });
        
        // AFK-автоатака
        this.eventBus.on('combat:afkAutoAttack', (data) => {
            if (this.currentBattle && this.currentBattle.player.id === data.playerId) {
                this.executePlayerAttack(this.currentBattle.player);
            }
        });
    }
    
    /**
     * Начать бой
     */
    startBattle(player, enemyId) {
        let enemyInstance;
        
        if (enemyId && typeof enemyId === 'object') {
            enemyInstance = enemyId;
        } else if (typeof enemyId === 'string' || typeof enemyId === 'number') {
            enemyInstance = window.game?.enemyService?.getEnemyById(enemyId);
            if (!enemyInstance) {
                console.error('CombatSystem: враг не найден по ID', enemyId);
                return;
            }
        } else {
            console.error('CombatSystem: некорректный enemyId', enemyId);
            return;
        }
        
        this.currentBattle = {
            player: player,
            enemies: [enemyInstance],
            round: 1,
            turn: 'player'
        };
        
        this.isPlayerTurn = true;
    }
    
    /**
     * Закончить бой - ВЫЗЫВАЕТ BattleOrchestrator
     */
    endBattle(victory = true, defeatedEnemy = null) {
        // СБРОСИТЬ КУЛДАУНЫ
        if (window.game?.abilityService) {
            const abilityService = window.game.abilityService;
            for (const ability of abilityService.abilities.values()) {
                if (ability.currentCooldown > 0) {
                    ability.currentCooldown = 0;
                }
            }
        }
        
        // 1. ВЫЗВАТЬ BattleOrchestrator для бизнес-логики
        if (window.game?.battleOrchestrator) {
            if (victory) {
                window.game.battleOrchestrator.endBattleVictory(defeatedEnemy);
            } else {
                window.game.battleOrchestrator.endBattleDefeat();
            }
        }
        
        // 2. ОЧИСТИТЬ СОСТОЯНИЕ БОЯ
        this.currentBattle = null;
        this.isPlayerTurn = false;
        
        // 3. ЭМИТИТЬ СОБЫТИЕ ДЛЯ UI
        this.eventBus.emit(victory ? 'battle:victory' : 'battle:defeat');
        this.eventBus.emit('battle:end');
    }
    
    /**
     * Выполнить атаку игрока
     */
    executePlayerAttack(player) {
        if (!this.currentBattle || !this.isPlayerTurn) return;
    
        const enemy = this.currentBattle.enemies[0];
        if (!enemy) {
            this.endBattle(true);
            return;
        }
        
        const result = this.battleSystem.playerAttack(
            player,
            enemy,
            player.gameState?.getStatManager?.()
        );
            console.log('DEBUG: result.playerDead =', result.playerDead);
        if (result.playerDead) {
            console.log('DEBUG: Вызываем onPlayerDefeated');
            this.onPlayerDefeated(player);
            return;
        }
        // Логи для UI
        if (result.log && result.log.length > 0) {
            this.eventBus.emit('log:batch', 
                result.log.map(msg => ({ message: msg, type: 'battle' }))
            );
        }
        
        // Обновление UI
        this.eventBus.emit('battle:update', {
            player: player.getStats(),
            enemy: enemy.getInfo()
        });
        
        this.eventBus.emit('player:statsChanged', player.getStats());
        
        // Обработка результата атаки
        if (result.enemyDead) {
            this.onEnemyDefeated(enemy);
            return;
        } else if (result.playerDead) {
            this.onPlayerDefeated(player);
            return;
        } else {
            this.isPlayerTurn = false;
            this.processEnemyTurn();
        }
    }
    
    /**
     * Атака врага
     */
    executeEnemyAttack(enemy) {
        if (!this.currentBattle || !this.currentBattle.player) {
            return 0;
        }
        
        const player = this.currentBattle.player;
        const playerStats = player.getStats ? player.getStats() : player;
        const damage = enemy.attackPlayer(playerStats);
        
        if (damage > 0 && player.takeDamage) {
            const result = player.takeDamage(damage);
            
            // Логи для UI
            this.eventBus.emit('log:add', {
                message: `${enemy.name} наносит вам ${damage} урона!`,
                type: 'battle'
            });
            
            this.eventBus.emit('player:statsChanged', player.getStats());
            this.eventBus.emit('battle:update', {
                player: player.getStats(),
                enemy: enemy.getInfo()
            });
            
            if (result && result.isDead) {
                this.onPlayerDefeated(player);
            }
        } else {
            // Промах
            this.eventBus.emit('log:add', {
                message: `${enemy.name} промахнулся по вам!`,
                type: 'battle'
            });
        }
        
        return damage;
    }
    /**
     * Враг побежден
     * @param {NonPlayerCharacter} enemy - побежденный враг
     */
    onEnemyDefeated(enemy) {
        console.log(`CombatSystem: враг ${enemy.id} побежден`);
        
        // ===== ПРЕВРАЩАЕМ ВРАГА В ТРУП =====
        if (enemy && typeof enemy.die === 'function') {
            enemy.die();  // меняет state на 'corpse' и эмитит событие
        }
        
        const index = this.currentBattle.enemies.indexOf(enemy);
        if (index !== -1) {
            this.currentBattle.enemies.splice(index, 1);
        }
        
        if (this.currentBattle.enemies.length === 0) {
            // ===== ИСПРАВЛЕНО: передаем врага в endBattle =====
            this.endBattle(true, enemy);
        }
    }
    /**
     * Игрок побежден
     */
    onPlayerDefeated(player) {
        console.log('CombatSystem: игрок побежден');
        this.endBattle(false);
    }
    /**
     * Обработать ход врага
     */
    processEnemyTurn() {
        // 1. ПРОВЕРКА: бой активен?
        if (!this.currentBattle || !this.currentBattle.enemies) {
            console.warn('CombatSystem: бой уже завершен или не инициализирован');
            return;
        }
        
        // 2. ПРОВЕРКА: враги есть?
        if (this.currentBattle.enemies.length === 0) {
            console.warn('CombatSystem: нет врагов для атаки');
            return;
        }
        
        // 3. ПРОВЕРКА: игрок жив?
        if (!this.currentBattle.player) {
            console.warn('CombatSystem: игрок не найден в текущем бою');
            return;
        }
        
        // 4. ВСЕ враги атакуют (for...of для возможного прерывания)
        for (const enemy of this.currentBattle.enemies) {
            // 4.1. Враг жив?
            if (enemy.health <= 0) continue;
            
            // 4.2. Враг атакует
            this.executeEnemyAttack(enemy);
            
            // 4.3. ПРОВЕРКА ПОСЛЕ АТАКИ: игрок умер?
            if (!this.currentBattle || !this.currentBattle.player) {
                return; 
            }
            // 4.4. ПРОВЕРКА: бой все еще активен?
            if (!this.currentBattle.enemies) {
                console.log('CombatSystem: враги исчезли, прерываем');
                return;
            }
        }
        
        // 5. ПРОВЕРКА ПЕРЕД ОБНОВЛЕНИЕМ ROUND: бой все еще активен?
        if (!this.currentBattle || !this.currentBattle.enemies) {
            console.warn('CombatSystem: бой завершился во время хода врага');
            return;
        }
        // 6. Только если игрок ВЫЖИЛ: новый раунд
        if (window.game?.abilityService) {
            window.game.abilityService.updateCooldowns();
        }
        this.currentBattle.round++;
        this.isPlayerTurn = true;
        
        // 7. Эмитим событие для UI
        this.eventBus.emit('combat:roundStart', { 
            round: this.currentBattle.round,
            playerTurn: true
        });
        
        console.log(`CombatSystem: раунд ${this.currentBattle.round}, ход игрока`);
    }
            
    /**
     * Использовать предмет (заглушка для совместимости)
     */
    executeItemUse(player, item, target = null) {
        if (!this.currentBattle || !this.isPlayerTurn) return;
        
        console.log(`CombatSystem: игрок использует ${item.name}`);
        this.isPlayerTurn = false;
    }   
    /**
     * Получить информацию о текущем бое
     */
    getBattleInfo() {
        if (!this.currentBattle) return null;
        
        return {
            round: this.currentBattle.round,
            playerTurn: this.isPlayerTurn,
            playerHealth: this.currentBattle.player.health,
            enemies: this.currentBattle.enemies.map(e => ({
                id: e.id,
                name: e.name,
                health: e.health
            }))
        };
    }
    
    /**
     * Проверить идет ли бой
     */
    isInCombat() {
        return !!this.currentBattle;
    }
}

export { CombatSystem };
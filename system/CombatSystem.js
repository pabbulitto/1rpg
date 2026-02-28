/**
 * CombatSystem - система мгновенных действий в бою
 * Интегрируется с ActionHandler для обработки выбора игрока
 * Управляет текущим боем и передачей хода
 */
class CombatSystem {
    constructor(battleSystem, eventBus) {
        this.battleSystem = battleSystem;
        this.eventBus = eventBus;
        this.currentBattle = null; 

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Начало боя из BattleOrchestrator
        this.eventBus.on('battle:start', (data) => {
            this.startBattle(data.player, data.enemyId || data.enemy);
        });
        
        this.eventBus.on('time:tick', () => this.processRound());
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
        // 3. ЭМИТИТЬ СОБЫТИЕ ДЛЯ UI
        this.eventBus.emit(victory ? 'battle:victory' : 'battle:defeat');
        this.eventBus.emit('battle:end');
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
     * Обработать один раунд боя (вызывается по тику времени)
     */
    processRound() {
        if (!this.currentBattle) {
            return;
        }
        // 1. ПРОВЕРКА: бой активен?
        if (!this.currentBattle || !this.currentBattle.enemies) {
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
        
        const player = this.currentBattle.player;
        const enemies = this.currentBattle.enemies.filter(e => e.getStats().health > 0);
        const results = {
            playerAttacks: [],
            enemyAttacks: [],
            playerAction: null,
            deaths: []
        };
        
        const logMessages = [];
        
        // 4. Базовая атака игрока (оружие/кулаки)
        if (player.getStats().health > 0) {
            for (const enemy of enemies) {
                const attackResult = this.battleSystem.playerAttack(player, enemy);
                results.playerAttacks.push({
                    target: enemy.id,
                    result: attackResult
                });
                
                // Добавляем лог от playerAttack
                if (attackResult.log && attackResult.log.length > 0) {
                    attackResult.log.forEach(msg => {
                        logMessages.push({ message: msg, type: 'battle' });
                    });
                }
                
                if (attackResult.enemyDead) {
                    results.deaths.push(enemy.id);
                    logMessages.push({ 
                        message: `🎊 ${enemy.name} побежден!`, 
                        type: 'victory' 
                    });
                }
            }
        }
        
        // 5. Базовые атаки всех живых врагов
        for (const enemy of enemies) {
            if (enemy.getStats().health > 0 && player.getStats().health > 0) {
                const attackResult = enemy.attackPlayer(player.getStats());
                if (attackResult && attackResult.damage > 0) {
                    const damageResult = player.takeDamage(attackResult.damage, {
                        isCritical: attackResult.isCritical
                    });
                    
                    results.enemyAttacks.push({
                        attacker: enemy.id,
                        attackerName: enemy.name,
                        damage: attackResult.damage,
                        isCritical: attackResult.isCritical
                    });
                    
                    // Лог атаки врага
                    const critText = attackResult.isCritical ? ' (КРИТ!)' : '';
                    logMessages.push({ 
                        message: `${enemy.name} наносит вам ${attackResult.damage} урона${critText}!`, 
                        type: 'battle' 
                    });
                    
                    if (damageResult.isDead) {
                        results.deaths.push(player.id);
                        logMessages.push({ 
                            message: '💀 Вы погибли...', 
                            type: 'defeat' 
                        });
                    }
                } else {
                    // Промах врага
                    logMessages.push({ 
                        message: `${enemy.name} промахнулся по вам!`, 
                        type: 'battle' 
                    });
                }
            }
        }
        
        // 6. Применить выбранное действие игрока (способность или предмет)
        if (this.playerAction && player.getStats().health > 0) {
            if (this.playerAction.type === 'ability') {
                const ability = this.playerAction.data; // исправлено: было ability, теперь data
                const target = enemies[0]; // цель всегда первый враг
                
                if (target && target.getStats().health > 0) {
                    const abilityResult = ability.use(player, target);
                    results.playerAction = {
                        type: 'ability',
                        name: ability.name,
                        target: target.id,
                        result: abilityResult
                    };
                    
                    // Лог использования способности
                    if (abilityResult.message) {
                        logMessages.push({ message: abilityResult.message, type: 'battle' });
                    }
                    if (abilityResult.damage > 0) {
                        logMessages.push({ 
                            message: `${ability.name} наносит ${abilityResult.damage} урона ${target.name}`, 
                            type: 'battle' 
                        });
                    }
                    
                    if (target.getStats().health <= 0) {
                        results.deaths.push(target.id);
                        logMessages.push({ 
                            message: `🎊 ${target.name} побежден!`, 
                            type: 'victory' 
                        });
                    }
                }
            } else if (this.playerAction.type === 'item') {
                // Использование предмета из пояса
                const item = this.playerAction.data;
                const useResult = item.use(player);
                results.playerAction = {
                    type: 'item',
                    name: item.name,
                    result: useResult
                };
                
                if (useResult.effects) {
                    useResult.effects.forEach(effect => {
                        logMessages.push({ message: effect, type: 'success' });
                    });
                }
            }
            
            // Сбрасываем выбранное действие после применения
            this.playerAction = null;
        }
        
        // 7. Обработка смертей
        for (const deadId of results.deaths) {
            if (deadId === player.id) {
                this.onPlayerDefeated(player);
                return;
            } else {
                const deadEnemy = enemies.find(e => e.id === deadId);
                if (deadEnemy) {
                    this.onEnemyDefeated(deadEnemy);
                }
            }
        }
        
        // 8. Обновление кулдаунов
        if (window.game?.abilityService) {
            window.game.abilityService.updateCooldowns();
        }      
        // 10. Отправляем лог
        if (logMessages.length > 0) {
            this.eventBus.emit('log:batch', logMessages);
        }
        this.eventBus.emit('battle:update', {
            player: player.getStats(),
            enemies: enemies.map(e => e.getInfo())
        });
        // 11. Эмитим результаты для анимаций
        this.eventBus.emit('battle:roundComplete', results);
    }
    /**
     * Получить информацию о текущем бое
     */
    getBattleInfo() {
        if (!this.currentBattle) return null;
        
        return {
            round: this.currentBattle.round,
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
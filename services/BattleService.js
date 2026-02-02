class BattleService {
    constructor(game) {
        this.game = game;
        this.battleSystem = new BattleSystem();
    }
    
    startBattle(enemy) {
        this.game.gameState.updateBattle(enemy, true);
        const battleStart = this.battleSystem.startBattle(this.game.player, enemy);
        this.game.gameState.eventBus.emit('battle:start', battleStart);
    }
    
    playerAttack() {
        const battle = this.game.gameState.getBattleState();
        if (!battle.inBattle || !battle.currentEnemy || battle.currentEnemy.health <= 0) {
            return;
        }
        
        const result = this.battleSystem.playerAttack(
            this.game.player, 
            battle.currentEnemy, 
            this.game.gameState.getStatManager() 
        );
        
        if (!result.enemyDead && !result.playerDead) {
            this.game.gameState.eventBus.emit('log:batch', 
                result.log.map(msg => ({ message: msg, type: 'battle' }))
            );
        }
        
        if (result.enemyDead) {
            this.endBattleVictory();
        } else if (result.playerDead) {
            this.endBattleDefeat();
        } else {
            this.game.gameState.eventBus.emit('battle:update', {
                player: this.game.player.getStats(),
                enemy: battle.currentEnemy.getInfo()
            });
        }
    }
    
    useItemInBattle(itemIndex, fromBelt = false) {
        const battle = this.game.gameState.getBattleState();
        if (!battle.inBattle || !battle.currentEnemy) {
            return;
        }
        
        let item = null;
        let useResult = null;
        
        if (fromBelt) {
            const beltData = this.game.beltSystem.beltSlots[itemIndex];
            if (!beltData || !beltData.item) return;
            
            item = beltData.item;
            useResult = item.use(this.game.player);
            
            if (useResult.success) {
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
            }
        } else {
            const items = this.game.gameState.getInventoryItems();
            if (itemIndex < 0 || itemIndex >= items.length) return;
            
            item = items[itemIndex];
            useResult = item.use(this.game.player);
            
            if (useResult.success) {
                if (item.stackable && item.count > 1) {
                    item.count--;
                    if (item.count === 0) {
                        this.game.gameState.removeInventoryItem(itemIndex);
                    }
                } else {
                    this.game.gameState.removeInventoryItem(itemIndex);
                }
                
                this.game.gameState.eventBus.emit('inventory:updated', 
                    this.game.inventorySystem.getInventoryInfo());
            }
        }
        
        if (!useResult || !useResult.success) {
            return;
        }
        
        const playerStats = this.game.player.getStats();
        const enemyDamage = battle.currentEnemy.attackPlayer(playerStats);
        const playerResult = this.game.player.takeDamage(enemyDamage);
        
        this.game.gameState.eventBus.emit('log:batch', [
            { message: `Вы использовали ${item.name}`, type: 'battle' },
            { message: `${battle.currentEnemy.name} атакует!`, type: 'battle' },
            { message: `Вы получили ${enemyDamage} урона`, type: 'battle' }
        ]);
        
        this.game.gameState.eventBus.emit('player:statsChanged', 
            this.game.player.getStats());
        
        if (playerResult.isDead) {
            this.endBattleDefeat();
        } else {
            this.game.gameState.eventBus.emit('battle:update', {
                player: this.game.player.getStats(),
                enemy: battle.currentEnemy.getInfo()
            });
        }
    }

    useDefenseAction() {
        const battle = this.game.gameState.getBattleState();
        if (!battle.inBattle || !battle.currentEnemy || battle.currentEnemy.health <= 0) {
            return;
        }
        
        const playerStats = this.game.player.getStats();
        const defenseBonus = Math.floor(playerStats.defense * 0.2);
        
        this.game.gameState.getStatManager().addModifier('temp_defense_buff', {
            defense: defenseBonus
        });
        
        this.game.gameState.eventBus.emit('player:statsChanged', this.game.player.getStats());
        
        const enemyDamage = battle.currentEnemy.attackPlayer(playerStats);
        const playerResult = this.game.player.takeDamage(enemyDamage);
        
        this.game.gameState.eventBus.emit('log:batch', [
            { message: `${battle.currentEnemy.name} атакует!`, type: 'battle' },
            { message: `Вы получили ${enemyDamage} урона`, type: 'battle' }
        ]);
        
        this.game.gameState.getStatManager().removeModifier('temp_defense_buff');
        
        if (playerResult.isDead) {
            this.endBattleDefeat();
        }
    }
    
    tryEscape() {
        const battle = this.game.gameState.getBattleState();
        if (!battle.inBattle || !battle.currentEnemy || battle.currentEnemy.health <= 0) {
            return;
        }
        
        const result = this.battleSystem.tryEscape(this.game.player, battle.currentEnemy);
        
        this.game.gameState.eventBus.emit('log:batch', 
            result.log.map(msg => ({ message: msg, type: 'battle' }))
        );
        
        if (result.success) {
            this.game.gameState.updateBattle(null, false);
            this.game.gameState.eventBus.emit('battle:end');
            this.game.gameState.eventBus.emit('exploration:show');
            this.game.gameState.eventBus.emit('minimap:refresh');
        } else if (result.playerDead) {
            this.endBattleDefeat();
        }
    }
    
    endBattleVictory() {
        const battle = this.game.gameState.getBattleState();
        const result = this.battleSystem.endBattleVictory(
            this.game.player,
            battle.currentEnemy,
            this.game.inventorySystem
        );
        
        this.game.gameState.addGold(result.gold);
        
        this.game.gameState.eventBus.emit('victory:show', result);
        
        this.game.gameState.updateBattle(null, false);
        this.game.gameState.eventBus.emit('battle:end');
        this.game.gameState.eventBus.emit('exploration:show');
        this.game.gameState.eventBus.emit('player:statsChanged', this.game.player.getStats());
        this.game.gameState.eventBus.emit('minimap:refresh');
    }
    
    endBattleDefeat() {
        this.game.gameState.eventBus.emit('log:add', { 
            message: "💀 Вы погибли...", 
            type: 'error' 
        });
        this.game.gameState.eventBus.emit('battle:end');
        setTimeout(() => {
            alert("Игра окончена! Начните заново.");
            location.reload();
        }, 1500);
    }
}

export { BattleService };
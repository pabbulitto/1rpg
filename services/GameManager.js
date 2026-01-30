class GameManager {
    constructor(game) {
        this.game = game;
        this.eventBus = game.gameState.eventBus;
    }
    
    explore() {
        const battle = this.game.gameState.getBattleState();
        if (battle.inBattle) {
            this.eventBus.emit('log:add', { message: "Сначала закончите бой!", type: "warning" });
            return;
        }
        
        const roomInfo = this.game.zoneManager.getCurrentRoomInfo();
        this.eventBus.emit('room:updated', roomInfo);
        
        this.eventBus.emit('log:add', { message: `📍 Вы в ${roomInfo.name}`, type: "info" });
        this.eventBus.emit('minimap:refresh');
    }
    
    async move(direction) {
        const battle = this.game.gameState.getBattleState();
        if (battle.inBattle) {
            this.eventBus.emit('log:add', { message: "Нельзя перемещаться во время боя!", type: "warning" });
            return;
        }
        
        const result = await this.game.zoneManager.move(direction);
        
        if (result.success) {
            this.eventBus.emit('log:add', { message: result.message, type: "info" });
            this.explore();
            
            const roomInfo = this.game.zoneManager.getCurrentRoomInfo();
            if (roomInfo.enemies && roomInfo.enemies.length > 0) {
                this.eventBus.emit('log:add', { message: "⚠️ В комнате могут быть враги", type: "warning" });
            }
        } else {
            this.eventBus.emit('log:add', { message: result.message, type: "error" });
        }
    }
    
    searchForEnemies() {
        const enemyData = this.game.zoneManager.getRandomEnemyFromRoom();
        
        if (!enemyData) {
            this.eventBus.emit('log:add', { message: "В этой комнате нет врагов", type: "info" });
            this.eventBus.emit('minimap:refresh');
            return;
        }
        
        const enemy = window.Enemy.createEnemy(enemyData.type, enemyData.level);
        this.game.battleService.startBattle(enemy);
    }
    
    rest() {
        const battle = this.game.gameState.getBattleState();
        if (battle.inBattle) {
            this.eventBus.emit('log:add', { message: "Нельзя отдыхать во время боя!", type: "warning" });
            return;
        }
        
        const player = this.game.gameState.getPlayer();
        const oldHealth = player.health;
        const healed = player.maxHealth - oldHealth;
        
        this.game.gameState.updatePlayerHealth(player.maxHealth);
        
        if (healed > 0) {
            this.eventBus.emit('log:add', { message: `Вы отдохнули и восстановили ${healed} здоровья`, type: "success" });
        } else {
            this.eventBus.emit('log:add', { message: "У вас и так полное здоровье", type: "info" });
        }
    }
    
    openShop() {
        const isShop = this.game.zoneManager.isCurrentRoomShop();
        if (!isShop) {
            this.eventBus.emit('log:add', { message: "Вы не в магазине!", type: "warning" });
            return;
        }
        
        const position = this.game.gameState.getPosition();
        const shopId = `${position.zone}:${position.room}`;
        
        const loaded = this.game.shopSystem.loadShop(shopId);
        if (!loaded) {
            this.eventBus.emit('log:add', { message: "Магазин не работает", type: "error" });
            return;
        }
        
        this.eventBus.emit('shop:open', this.game.shopSystem.getShopInfo());
        this.eventBus.emit('minimap:refresh');
    }
    
    buyItemFromShop(itemId) {
        const result = this.game.shopSystem.buyItem(itemId, this.game.player, this.game.inventorySystem);
        if (result.success) {
            this.eventBus.emit('log:add', { message: result.message, type: 'success' });
        } else {
            this.eventBus.emit('log:add', { message: result.message, type: 'error' });
        }
    }
    
    sellItemToShop(itemIndex) {
        const result = this.game.shopSystem.sellItem(itemIndex, this.game.player, this.game.inventorySystem);
        if (result.success) {
            this.eventBus.emit('log:add', { message: result.message, type: 'success' });
        } else {
            this.eventBus.emit('log:add', { message: result.message, type: 'error' });
        }
    }
}

export { GameManager };
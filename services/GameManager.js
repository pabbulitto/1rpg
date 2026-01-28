import { Enemy } from '../core/Enemy.js';

class GameManager {
    constructor(game) {
        this.game = game;
    }
    
    explore() {
        const battle = this.game.gameState.getBattleState();
        if (battle.inBattle) {
            this.game.uiManager.addToLog("Сначала закончите бой!", "warning");
            return;
        }
        
        const roomInfo = this.game.zoneManager.getCurrentRoomInfo();
        this.game.uiManager.updateRoomInfo(roomInfo);
        
        this.game.uiManager.addToLog(`📍 Вы в ${roomInfo.name}`);
        this.game.uiManager.updateMinimap();
    }
    
    async move(direction) {
        const battle = this.game.gameState.getBattleState();
        if (battle.inBattle) {
            this.game.uiManager.addToLog("Нельзя перемещаться во время боя!", "warning");
            return;
        }
        
        const result = await this.game.zoneManager.move(direction);
        
        if (result.success) {
            this.game.uiManager.addToLog(result.message);
            this.explore();
            
            const roomInfo = this.game.zoneManager.getCurrentRoomInfo();
            if (roomInfo.enemies && roomInfo.enemies.length > 0) {
                this.game.uiManager.addToLog("⚠️ В комнате могут быть враги", "warning");
            }
        } else {
            this.game.uiManager.addToLog(result.message, "error");
        }
    }
    
    searchForEnemies() {
        const enemyData = this.game.zoneManager.getRandomEnemyFromRoom();
        
        if (!enemyData) {
            this.game.uiManager.addToLog("В этой комнате нет врагов");
            this.game.uiManager.updateMinimap();
            return;
        }
        
        const enemy = window.Enemy.createEnemy(enemyData.type, enemyData.level);
        this.game.battleService.startBattle(enemy);
    }
    
    rest() {
        const battle = this.game.gameState.getBattleState();
        if (battle.inBattle) {
            this.game.uiManager.addToLog("Нельзя отдыхать во время боя!", "warning");
            return;
        }
        
        const player = this.game.gameState.getPlayer();
        const oldHealth = player.health;
        const healed = player.maxHealth - oldHealth;
        
        this.game.gameState.updatePlayerHealth(player.maxHealth);
        
        if (healed > 0) {
            this.game.uiManager.addToLog(`Вы отдохнули и восстановили ${healed} здоровья`, "success");
            this.game.uiManager.updatePlayerStats(this.game.player.getStats());
        } else {
            this.game.uiManager.addToLog("У вас и так полное здоровье");
        }
    }
    
    openShop() {
        const isShop = this.game.zoneManager.isCurrentRoomShop();
        if (!isShop) {
            this.game.uiManager.addToLog("Вы не в магазине!", "warning");
            return;
        }
        
        const position = this.game.gameState.getPosition();
        const shopId = `${position.zone}:${position.room}`;
        
        const loaded = this.game.shopSystem.loadShop(shopId);
        if (!loaded) {
            this.game.uiManager.addToLog("Магазин не работает", "error");
            return;
        }
        
        this.game.uiManager.showShop(this.game.shopSystem.getShopInfo());
        this.game.uiManager.updateMinimap();
    }
    
    buyItemFromShop(itemId) {
        const result = this.game.shopSystem.buyItem(itemId, this.game.player, this.game.inventorySystem);
        if (result.success) {
            this.game.uiManager.addToLog(result.message, 'success');
            this.game.uiManager.updatePlayerStats(this.game.player.getStats());
            
            const invInfo = this.game.inventorySystem.getInventoryInfo();
            this.game.uiManager.updateInventory(invInfo);
        } else {
            this.game.uiManager.addToLog(result.message, 'error');
        }
    }
    
    sellItemToShop(itemIndex) {
        const result = this.game.shopSystem.sellItem(itemIndex, this.game.player, this.game.inventorySystem);
        if (result.success) {
            this.game.uiManager.addToLog(result.message, 'success');
            this.game.uiManager.updatePlayerStats(this.game.player.getStats());
            
            const invInfo = this.game.inventorySystem.getInventoryInfo();
            this.game.uiManager.updateInventory(invInfo);
        } else {
            this.game.uiManager.addToLog(result.message, 'error');
        }
    }
}

export { GameManager };
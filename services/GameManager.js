class GameManager {
    static TERRAIN_COSTS = {
        road: 3,
        town: 3,
        plain: 4,
        dungeon: 4,
        forest: 6,
        swamp: 8,
        mountain: 10,
    };
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
        
        // Обновляем список врагов в комнате
        const enemies = this.getRoomEnemies();
        if (enemies.length > 0) {
            this.eventBus.emit('room:enemiesUpdated', {
                enemies: enemies.map(e => e.getInfo()),
                roomId: this.game.gameState.getPosition().room
            });
        } else {
            // Очистить контейнер если врагов нет
            this.eventBus.emit('room:enemiesUpdated', { enemies: [] });
        }
    }
    
    /**
     * Переместиться в заданном направлении
     * @param {string} direction - направление ('north', 'south', 'east', 'west', 'up', 'down')
     */
    async move(direction) {
        const battle = this.game.gameState.getBattleState();
        if (battle.inBattle) {
            this.eventBus.emit('log:add', { message: "Нельзя перемещаться во время боя!", type: "warning" });
            return;
        }

        // 1. Получаем данные текущей комнаты
        const currentRoomInfo = this.game.zoneManager.getCurrentRoomInfo();
        if (!currentRoomInfo) {
            this.eventBus.emit('log:add', { message: "Не удалось определить текущее место", type: "error" });
            return;
        }

        // 2. Определяем стоимость перемещения
        const terrainType = currentRoomInfo.terrain || 'road';
        const staminaCost = GameManager.TERRAIN_COSTS[terrainType] || 3;

        // 3. Проверяем, хватает ли выносливости
        const player = this.game.player;
        const currentStamina = player.getStats().stamina;
        
        if (currentStamina < staminaCost) {
            this.eventBus.emit('log:add', { 
                message: `Нужно ${staminaCost} выносливости для перемещения по ${terrainType} (имеется: ${currentStamina})`, 
                type: "error" 
            });
            return;
        }

        // 4. Пытаемся переместиться (передаем ID игрока для мультиплеера)
        const result = await this.game.zoneManager.move(direction);

        if (result.success) {
            // 5. Тратим выносливость
            const staminaResult = player.takeStamina(staminaCost);
            
            // 6. Логируем успех
            this.eventBus.emit('log:add', { 
                message: `${result.message} (Потрачено ${staminaCost} выносливости)`, 
                type: "info" 
            });
            
            // 7. Обновляем окружение
            this.explore();
        } else {
            // 9. Если перемещение не удалось (например, нет выхода)
            this.eventBus.emit('log:add', { message: result.message, type: "error" });
        }
    }

    getRoomEnemies() {
        const enemyConfigs = this.game.zoneManager.getRoomEnemies();
        if (!enemyConfigs || enemyConfigs.length === 0) {
            return [];
        }
        
        return enemyConfigs.map(config => 
            this.game.enemyService.create(config.type, config.level || 1)
        ).filter(enemy => enemy !== null);
    }

    attackEnemyInRoom(enemyIndex) {
        const enemies = this.getRoomEnemies();
        if (enemyIndex < 0 || enemyIndex >= enemies.length) return;
        
        this.game.battleOrchestrator.startBattle(enemies[enemyIndex]);
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
    }
    
    buyItemFromShop(itemId) {
        const result = this.game.shopSystem.buyItem(itemId, this.game.player);
        if (result.success) {
            this.eventBus.emit('log:add', { message: result.message, type: 'success' });
        } else {
            this.eventBus.emit('log:add', { message: result.message, type: 'error' });
        }
    }
    
    sellItemToShop(itemIndex) {
        const result = this.game.shopSystem.sellItem(itemIndex, this.game.player);
        if (result.success) {
            this.eventBus.emit('log:add', { message: result.message, type: 'success' });
        } else {
            this.eventBus.emit('log:add', { message: result.message, type: 'error' });
        }
    }
}

export { GameManager };
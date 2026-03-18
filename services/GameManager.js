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
        if (!roomInfo) {
            console.error('GameManager: roomInfo is null');
            this.eventBus.emit('log:add', { message: "Ошибка загрузки комнаты", type: "error" });
            return;
        }
        
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

        // 1. Получаем данные текущей комнаты
        const currentRoomInfo = this.game.zoneManager.getCurrentRoomInfo();
        if (!currentRoomInfo) {
            this.eventBus.emit('log:add', { message: "Не удалось определить текущее место", type: "error" });
            return;
        }

        // 2. Определяем стоимость перемещения
        const terrainType = currentRoomInfo.terrain || 'road';
        let staminaCost = GameManager.TERRAIN_COSTS[terrainType] || 3; // ← let

        const player = this.game.player; // ← объявляем player здесь

        // Проверяем эффект полета
        if (player.hasEffect && player.hasEffect('полет')) {
            staminaCost = 2; // Устанавливаем фиксированную стоимость для полета
        }

        // 3. Проверяем, хватает ли выносливости
        const currentStamina = player.getStats().stamina;

        if (currentStamina < staminaCost) {
            this.eventBus.emit('log:add', { 
                message: `Нужно ${staminaCost} выносливости для перемещения по ${terrainType} (имеется: ${currentStamina})`, 
                type: "error" 
            });
            return;
        }

        // 4. Пытаемся переместиться
        const result = await this.game.zoneManager.move(direction);

        if (result.success) {
            // 5. Тратим выносливость
            player.takeStamina(staminaCost);
            
            // 6. Логируем успех
            this.eventBus.emit('log:add', { 
                message: `${result.message} (Потрачено ${staminaCost} выносливости)`, 
                type: "info" 
            });
            
            // 7. Обновляем интерфейс
            const newRoomInfo = this.game.zoneManager.getCurrentRoomInfo();
            if (newRoomInfo) {
                this.eventBus.emit('room:updated', newRoomInfo);
            }
            this.eventBus.emit('player:statsChanged', this.game.player.getStats());
            
            // 8. Обновляем список сущностей в комнате
            const roomId = this.game.gameState.getPosition().room;
            const entities = this.game.zoneManager?.getRoomEntitiesInfo(roomId) || [];
            this.eventBus.emit('room:entitiesUpdated', {
                roomId: roomId,
                entities: entities
            });
        } else {
            // 9. Если перемещение не удалось
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
    
    /**
     * Продать предмет в магазине по instanceId
     * @param {string} instanceId - уникальный ID экземпляра предмета
     */
    sellItemToShop(instanceId) {
        if (!instanceId) {
            this.eventBus.emit('log:add', { 
                message: "Не указан ID предмета", 
                type: "error" 
            });
            return;
        }
        
        const result = this.game.shopSystem.sellItem(instanceId, this.game.player);
        
        if (result.success) {
            this.eventBus.emit('log:add', { 
                message: result.message, 
                type: 'success' 
            });
        } else {
            this.eventBus.emit('log:add', { 
                message: result.message, 
                type: 'error' 
            });
        }
    }
    /**
     * Применить способность к сущности
     * @param {string} abilityId - ID способности
     * @param {string} targetId - ID целевой сущности
     */
    useAbilityOnEntity(abilityId, targetId) {
        const ability = this.game.abilityService.getAbility(abilityId);
        const caster = this.game.player;
        const target = this.game.zoneManager.getEntityById(targetId);
        
        if (!ability || !caster || !target) {
            this.eventBus.emit('log:add', { 
                message: 'Не удалось применить способность', 
                type: 'error' 
            });
            return;
        }
        
        // Применяем способность
        const result = ability.use(caster, target);
        
        if (result.success) {
            // Логируем результат
            this.eventBus.emit('log:add', { 
                message: result.message, 
                type: 'success' 
            });
            
            // Увеличиваем мастерство способности
            if (window.game?.abilityService) {
                window.game.abilityService.addMastery(
                    caster.id,
                    ability.id,
                    ability.masteryGain || 0.03
                );
                
                // Для заклинаний - увеличиваем мастерство школы
                if (ability.type === 'spell' && ability.school) {
                    const schoolSkillId = this._getSchoolSkillId(ability.school);
                    if (schoolSkillId) {
                        window.game.abilityService.addMastery(
                            caster.id,
                            schoolSkillId,
                            0.04
                        );
                    }
                }
            }
            
            // Если способность начинает бой
            if (ability.startsCombat && target.state === 'alive') {
                this.game.battleOrchestrator.startBattle(target);
            }
        }
    }

    /**
     * Получить ID умения школы магии
     * @private
     */
    _getSchoolSkillId(school) {
        const mapping = {
            'fire': 'магия_огня',
            'water': 'магия_воды',
            'air': 'магия_воздуха',
            'earth': 'магия_земли',
            'life': 'магия_жизни',
            'mind': 'магия_разума',
            'dark': 'магия_тьмы'
        };
        return mapping[school] || null;
    }
}

export { GameManager };
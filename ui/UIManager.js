// ui/UIManager.js
/**
 * UIManager - координатор UI компонентов (исправленная версия)
 * Принимает UI компоненты через конструктор
 */
class UIManager {
    constructor(game, uiComponents) {
        this.game = game;
        this.eventBus = game.gameState.eventBus;
        this.uiComponents = uiComponents; // Сохраненные компоненты
        this.components = {};
        
        this.callbacks = {
            onItemUse: (index) => this.onItemUse(index),
            onItemEquip: (index) => this.onItemEquip(index),
            onUnequip: (slot) => this.onUnequip(slot),
            onAttack: () => this.onAttack(),
            onDefense: () => this.onDefense(),
            onEscape: () => this.onEscape(),
            onBuyItem: (itemId) => this.onBuyItem(itemId),
            onSellItem: (itemIndex) => this.onSellItem(itemIndex),
            onAddToBelt: (index) => this.onAddToBelt(index)
        };
        
        this.containers = {};
        this.isInitialized = false;
    }
    
    init() {
        this.cacheContainers();
        this.bindGlobalEvents();
        this.setupEventSubscriptions();
        this.updateAll();
        this.initComponentsSync();
        
        this.isInitialized = true;
        console.log('UIManager: инициализирован (компонентная архитектура)');
    }
    
    cacheContainers() {
        this.containers = {
            // Основные контейнеры
            stats: document.getElementById('stats-content'),
            inventory: document.getElementById('inventory-content'),
            equipment: document.getElementById('equipment-content'),
            skills: document.getElementById('skills-ui'),
            time: document.getElementById('time-ui'),
            log: document.getElementById('log-content'),
            minimap: document.getElementById('minimap'),
            battle: document.getElementById('battle-ui'),
            // Элементы игрока
            playerHealth: document.getElementById('player-health'),
            playerExp: document.getElementById('player-exp'),
            playerGold: document.getElementById('player-gold'),
            playerAttack: document.getElementById('player-attack'),
            playerDefense: document.getElementById('player-defense'),
            healthBar: document.getElementById('health-bar'),
            playerHeader: document.getElementById('player-header'),
            
            // Элементы для маны и выносливости
            playerMana: document.getElementById('player-mana'),
            playerStamina: document.getElementById('player-stamina'),
            manaBar: document.getElementById('mana-bar'),
            staminaBar: document.getElementById('stamina-bar'),            
            // Элементы боя
            enemyName: document.getElementById('enemy-name'),
            enemyHealth: document.getElementById('enemy-health'),
            
            // Кнопки
            exploreBtn: document.getElementById('explore-btn'),
            shopBtn: document.getElementById('shop-btn'),
            searchEnemiesBtn: document.getElementById('search-enemies-btn'),
            attackBtn: document.getElementById('attack-btn'),
            potionBtn: document.getElementById('potion-btn'),
            escapeBtn: document.getElementById('escape-btn'),
            
            // Направления
            northBtn: document.getElementById('north-btn'),
            southBtn: document.getElementById('south-btn'),
            eastBtn: document.getElementById('east-btn'),
            westBtn: document.getElementById('west-btn'),
            upBtn: document.getElementById('up-btn'),
            downBtn: document.getElementById('down-btn'),
            
            // Комната
            roomName: document.getElementById('room-name'),
            roomDescription: document.getElementById('room-description-box')
        };
    }
    
    initComponentsSync() {
        // StatsUI
        if (this.containers.stats) {
            this.components.stats = new this.uiComponents.StatsUI('stats-content');
            this.components.stats.init(this.game);
        }
        
        // InventoryUI
        if (this.containers.inventory) {
            this.components.inventory = new this.uiComponents.InventoryUI(
                this.containers.inventory,
                this.eventBus,
                () => this.game.gameState.playerContainer.getInfo(),
                this.callbacks.onItemUse,
                this.callbacks.onItemEquip,
                this.callbacks.onAddToBelt
            );
            this.components.inventory.init();
        }
        
        // EquipmentUI
        if (this.containers.equipment) {
            this.components.equipment = new this.uiComponents.EquipmentUI(
                this.containers.equipment,
                this.eventBus,
                () => this.game.gameState.playerContainer.getAllEquipment(),
                this.callbacks.onUnequip
            );
            this.components.equipment.init();
        }
        
        // SkillsUI
        if (this.containers.skills) {
            this.components.skills = new this.uiComponents.SkillsUI(
                this.containers.skills,
                this.eventBus,
                () => this.game.gameState.getActiveEffects(),
                () => [] // TODO: доступные умения
            );
            this.components.skills.init();
        }
        
        // TimeUI
        if (this.containers.time) {
            this.components.time = new this.uiComponents.TimeUI(this.containers.time, this.eventBus);
            this.components.time.init();
        }
        
        // LogUI
        if (this.containers.log) {
            this.components.log = new this.uiComponents.LogUI(this.containers.log, this.eventBus, 50);
            this.components.log.init();
        }
        
        // MinimapUI
        if (this.containers.minimap) {
            this.components.minimap = new this.uiComponents.MinimapUI(
                this.containers.minimap,
                this.eventBus,
                () => this.game.zoneManager.getMinimapData()
            );
            this.components.minimap.init();
        }
        
        // BattleUI
        if (this.containers.battle) {
            this.components.battle = new this.uiComponents.BattleUI(
                this.containers.battle,
                this.game  // ← ТОЛЬКО game объект
            );
            this.components.battle.init();
        }
        // BeltUI
        const beltContainer = document.getElementById('belt-slots');
        if (beltContainer && this.game.beltSystem) {
            this.components.belt = new this.uiComponents.BeltUI(
                beltContainer,
                this.eventBus,
                this.game.beltSystem
            );
            this.components.belt.init();
        }
        // ShopUI (модальный)
        this.components.shop = new this.uiComponents.ShopUI(
            this.eventBus,
            () => this.game.shopSystem.getShopInfo(),
            this.callbacks.onBuyItem,
            this.callbacks.onSellItem
        );
        
        // ShopUI требует дополнительного метода
        if (this.components.shop.setInventoryGetter) {
            this.components.shop.setInventoryGetter(
                () => this.game.gameState.getInventoryItems() // сырые ItemData
            );
        }
        
        this.components.shop.init();
    }
    
    bindGlobalEvents() {
        // Табы
        document.querySelectorAll('.tab-button').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // Кнопки перемещения
        const directions = ['north', 'south', 'east', 'west', 'up', 'down'];
        directions.forEach(dir => {
            const btn = document.getElementById(`${dir}-btn`);
            if (btn) {
                btn.addEventListener('click', () => this.game.gameManager.move(dir));
            }
        });
        
        // Основные кнопки
        if (this.containers.exploreBtn) {
            this.containers.exploreBtn.addEventListener('click', () => this.game.gameManager.explore());
        }
        if (this.containers.shopBtn) {
            this.containers.shopBtn.addEventListener('click', () => this.game.gameManager.openShop());
        }     
  
    }
    
    setupEventSubscriptions() {
        // Обновление характеристик игрока
        this.eventBus.on('player:statsChanged', (stats) => {
            this.updatePlayerStats(stats);
        });
        
        // Обновление здоровья
        this.eventBus.on('player:healthChanged', () => {
            this.updatePlayerStats(this.game.player.getStats());
        });
        
        // Обновление золота
        this.eventBus.on('player:goldChanged', (data) => {
            if (this.containers.playerGold) {
                this.containers.playerGold.textContent = data.gold || this.game.player.getStats().gold;
            }
        });
        
        // Обновление инвентаря/экипировки
        this.eventBus.on('player:equipmentChanged', () => {
            this.updateInventory();
        });
        
        // Обновление инвентаря (дополнительное событие)
        this.eventBus.on('inventory:updated', () => {
            this.updateInventory();
        });
        
        // Магазин: открыть
        this.eventBus.on('shop:open', (shopData) => {
            if (this.components.shop) {
                this.components.shop.open(shopData);
            }
        });
        
        // Время: изменение
        this.eventBus.on('time:hourChange', (data) => {
            if (this.components.time) {
                this.components.time.currentTime = data.gameTime;
                this.components.time.updateDisplay();
            }
        });
        
        this.eventBus.on('time:seasonChange', (data) => {
            if (this.components.time) {
                this.components.time.currentTime = data.gameTime;
                this.components.time.updateDisplay();
            }
        });
        
        // Комната обновлена
        this.eventBus.on('room:updated', (roomInfo) => this.updateRoomInfo(roomInfo));
        
        // Победа в бою (только логи, UI управляет BattleUI)
        this.eventBus.on('victory:show', (result) => {
            if (result.log) {
                result.log.forEach(msg => this.addToLog(msg, 'victory'));
            }
        });
        
        // Обновление миникарты
        this.eventBus.on('minimap:update', () => {
            this.updateMinimap();
        });
        
        // Обновление миникарты (альтернативное событие)
        this.eventBus.on('minimap:refresh', () => {
            this.updateMinimap();
        });
        
        // Обновление пояса
        this.eventBus.on('belt:updated', () => {
            if (this.components.belt) {
                this.components.belt.update();
            }
        });
    }
    
    switchTab(tabName) {
        // UI табов
        document.querySelectorAll('.tab-button').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        const activeContent = document.getElementById(`${tabName}-tab`);
        
        if (activeTab) activeTab.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
        
        // Скрываем левую панель при открытии инвентаря
        const leftPanel = document.querySelector('.left-panel');
        if (leftPanel) {
            leftPanel.style.display = (tabName === 'inventory') ? 'none' : 'block';
        }
        
        // Загрузка данных для вкладки
        if (tabName === 'inventory' || tabName === 'equipment') {
            this.updateInventory();
        }
        
        if (tabName === 'stats') {
            this.updatePlayerStats(this.game.player.getStats());
        }
        
        if (tabName === 'skills' && this.components.skills) {
            this.components.skills.refreshData();
        }
    }
    
    updateAll() {
        this.updatePlayerStats(this.game.player.getStats());
        this.updateInventory();
        this.updateRoomInfo();
        this.updateMinimap();
        if (this.components.belt) {
            this.components.belt.update();
        }
    }
    
    updatePlayerStats(stats) {
        if (!stats) return;
        
        // ТЕПЕРЬ stats УЖЕ ПЛОСКИЙ ОБЪЕКТ от GameState.getPlayer()
        // 1. Заголовок (имя и уровень)
        if (this.containers.playerHeader) {
            this.containers.playerHeader.textContent = `${stats.name || 'Герой'} [Ур. ${stats.level || 1}]`;
        }
        
        // 2. Ресурсы (текст)
        if (this.containers.playerHealth) {
            this.containers.playerHealth.textContent = `${stats.health || 0}/${stats.maxHealth || 0}`;
        }
        if (this.containers.playerMana) {
            this.containers.playerMana.textContent = `${stats.mana || 0}/${stats.maxMana || 0}`;
        }
        if (this.containers.playerStamina) {
            this.containers.playerStamina.textContent = `${stats.stamina || 0}/${stats.maxStamina || 0}`;
        }
        
        // 3. Полоски ресурсов
        if (this.containers.healthBar) {
            const healthPercent = stats.maxHealth > 0 ? (stats.health / stats.maxHealth) * 100 : 0;
            this.containers.healthBar.style.width = `${healthPercent}%`;
            this.containers.healthBar.style.background = healthPercent < 30 ? '#ff4444' : 
                                                        healthPercent < 60 ? '#ffaa44' : '#44ff44';
        }
        
        if (this.containers.manaBar) {
            const manaPercent = stats.maxMana > 0 ? (stats.mana / stats.maxMana) * 100 : 0;
            this.containers.manaBar.style.width = `${manaPercent}%`;
            this.containers.manaBar.style.background = manaPercent < 20 ? '#ff4444' : 
                                                    'linear-gradient(90deg, #4a4aff, #8a8aff)';
        }
        
        if (this.containers.staminaBar) {
            const staminaPercent = stats.maxStamina > 0 ? (stats.stamina / stats.maxStamina) * 100 : 0;
            this.containers.staminaBar.style.width = `${staminaPercent}%`;
            this.containers.staminaBar.style.background = staminaPercent < 20 ? '#ff4444' : 
                                                        'linear-gradient(90deg, #44ff44, #aaff44)';
        }
        
        // 4. Остальная информация
        if (this.containers.playerExp) {
            this.containers.playerExp.textContent = `${stats.exp || 0}/${stats.expToNext || 100}`;
        }
        if (this.containers.playerGold) {
            this.containers.playerGold.textContent = stats.gold || 0;
        }
        if (this.containers.playerAttack) {
            this.containers.playerAttack.textContent = stats.attack || 0;
        }
        if (this.containers.playerDefense) {
            // Показываем значение брони (% поглощения)
            const armorText = stats.armorValue ? `${stats.armorValue}ед (${stats.damageReduction || 0}%)` : '0ед (0%)';
            this.containers.playerDefense.textContent = armorText;
        }
    }
    /**
     * Обновить отображение инвентаря
     */
    updateInventory() {
        const containerInfo = this.game.gameState.playerContainer.getInfo();
        
        if (this.components.inventory && containerInfo) {
            this.components.inventory.update(containerInfo);
        }
        
        if (this.components.equipment && containerInfo?.equipment) {
            this.components.equipment.update(containerInfo.equipment);
        }
        if (this.components.belt) {
            this.components.belt.update();
        }
    }
    
    updateRoomInfo() {
        if (!this.game.zoneManager) return;
        
        const roomInfo = this.game.zoneManager.getCurrentRoomInfo();
        if (!roomInfo) return;
        
        // 1. ОБНОВЛЯЕМ ЗАГОЛОВОК ЛОГА (h2#room-name): название + выходы
        if (this.containers.roomName) {
            let titleText = roomInfo.name;
            
            // Добавляем выходы если они есть
            if (roomInfo.directions && Object.keys(roomInfo.directions).length > 0) {
                const exitNames = {
                    north: 'Север',
                    south: 'Юг', 
                    east: 'Восток',
                    west: 'Запад',
                    up: 'Вверх',
                    down: 'Вниз'
                };
                
                const availableExits = [];
                for (const [dir, target] of Object.entries(roomInfo.directions)) {
                    if (target) {
                        const dirName = exitNames[dir] || dir;
                        availableExits.push(dirName);
                    }
                }
                
                if (availableExits.length > 0) {
                    titleText += ` | Выходы: ${availableExits.join(', ')}`;
                }
            }
            
            this.containers.roomName.textContent = titleText;
        }
        
        // 2. Верхняя панель (как было)
        if (this.containers.roomDescription && roomInfo.description) {
            this.containers.roomDescription.textContent = roomInfo.description;
        }
        
        // 3. Показ/скрытие кнопки магазина
        if (this.containers.shopBtn) {
            this.containers.shopBtn.style.display = roomInfo.isShop ? 'flex' : 'none';
        }
    }
    
    updateMinimap() {
        if (this.components.minimap) {
            this.components.minimap.refreshMinimap();
        }
    }
    
    addToLog(message, type = 'info') {
        if (this.components.log) {
            this.components.log.addEntry(message, type);
        } else {
            this.eventBus.emit('log:add', { message, type });
        }
    }
          
    showShop(shopInfo) {
        this.eventBus.emit('shop:open', shopInfo);
    }
    
    showVictoryScreen(result) {
        if (result.log) {
            result.log.forEach(msg => this.addToLog(msg, 'victory'));
        }
    }

    showExplorationUI() {
        this.updateAll();
    }
    
    showError(message) {
        this.addToLog(`ОШИБКА: ${message}`, 'error');
    }
    
    // Callbacks
    onItemUse(index) {
        const result = this.game.player.useItem(index);
        if (result.message) {
            this.addToLog(result.message, result.success ? 'success' : 'error');
        }
    }

    onItemEquip(index) {
        const result = this.game.player.equipItemFromInventory(index);
        if (result.message) {
            this.addToLog(result.message, result.success ? 'success' : 'error');
        }
    }

    onUnequip(slot) {
        const result = this.game.player.unequipItem(slot);
        if (result.message) {
            this.addToLog(result.message, result.success ? 'success' : 'error');
        }
    }
    
    onBuyItem(itemId) {
        this.game.gameManager.buyItemFromShop(itemId);
    }
    
    onSellItem(itemIndex) {
        this.game.gameManager.sellItemToShop(itemIndex);
    }

    onAddToBelt(index) {
        if (!this.game.beltSystem) {
            this.addToLog("Система пояса не найдена", "error");
            return;
        }
        
        const result = this.game.beltSystem.addToBeltFromInventory(index);
        if (result.message) {
            this.addToLog(result.message, result.success ? 'success' : 'error');
        }
    }
    
    destroy() {
        Object.values(this.components).forEach(component => {
            if (component && typeof component.destroy === 'function') {
                component.destroy();
            }
        });
        this.components = {};
        if (this.components.belt) {
            this.components.belt.destroy();
        }
    }
}

export { UIManager };
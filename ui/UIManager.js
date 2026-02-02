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
            playerName: document.getElementById('player-name'),
            playerHealth: document.getElementById('player-health'),
            playerLevel: document.getElementById('player-level'),
            playerExp: document.getElementById('player-exp'),
            playerGold: document.getElementById('player-gold'),
            playerAttack: document.getElementById('player-attack'),
            playerDefense: document.getElementById('player-defense'),
            healthBar: document.getElementById('health-bar'),
            expBar: document.getElementById('exp-bar'),
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
            restBtn: document.getElementById('rest-btn'),
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
                () => this.game.inventorySystem.getInventoryInfo(),
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
                () => this.game.inventorySystem.getInventoryInfo()?.equipment || {},
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
                this.eventBus,
                this.callbacks.onAttack,
                this.callbacks.onDefense,
                this.callbacks.onEscape
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
                () => this.game.inventorySystem.getInventoryInfo()?.items || []
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
        //if (this.containers.searchEnemiesBtn) {
        //    this.containers.searchEnemiesBtn.addEventListener('click', () => this.game.gameManager.searchForEnemies());
        //}
        
        // Кнопки боя
        if (this.containers.attackBtn) {
            this.containers.attackBtn.addEventListener('click', () => this.onAttack());
        }
        if (this.containers.potionBtn) {
            this.containers.potionBtn.addEventListener('click', () => this.onDefense());
        }
        if (this.containers.escapeBtn) {
            this.containers.escapeBtn.addEventListener('click', () => this.onEscape());
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
        
        // Бой: начало
        this.eventBus.on('battle:start', (battleData) => {
            this.showBattleUI(battleData);
            // Скрываем список врагов при начале боя
            const enemiesContainer = document.getElementById('room-enemies-container');
            if (enemiesContainer) enemiesContainer.style.display = 'none';
        });
        
        // Бой: окончание
        this.eventBus.on('battle:end', () => {
            this.hideBattleUI();
            // Показываем список врагов после боя
            const enemiesContainer = document.getElementById('room-enemies-container');
            if (enemiesContainer) enemiesContainer.style.display = 'block';
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
        
        // Враги в комнате обновлены (НОВОЕ)
        this.eventBus.on('room:enemiesUpdated', (data) => {
            this.showEnemiesInRoom(data);
        });
        
        // Победа в бою
        this.eventBus.on('victory:show', (result) => {
            this.showVictoryScreen(result);
        });

        // Возврат к исследованию
        this.eventBus.on('exploration:show', () => {
            this.showExplorationUI();
            // Показываем список врагов при возврате
            const enemiesContainer = document.getElementById('room-enemies-container');
            if (enemiesContainer) enemiesContainer.style.display = 'block';
        });

        // Обновление миникарты
        this.eventBus.on('minimap:update', () => {
            this.updateMinimap();
        });
        
        // Обновление миникарты (альтернативное событие)
        this.eventBus.on('minimap:refresh', () => {
            this.updateMinimap();
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
        
        // Обновляем основные элементы
        if (this.containers.playerName) this.containers.playerName.textContent = stats.name;
        if (this.containers.playerHealth) this.containers.playerHealth.textContent = `${stats.health}/${stats.maxHealth}`;
        if (this.containers.playerLevel) this.containers.playerLevel.textContent = stats.level;
        if (this.containers.playerExp) this.containers.playerExp.textContent = `${stats.exp}/${stats.expToNext}`;
        if (this.containers.playerGold) this.containers.playerGold.textContent = stats.gold;
        
        if (this.containers.playerAttack) this.containers.playerAttack.textContent = stats.attack;
        if (this.containers.playerDefense) this.containers.playerDefense.textContent = stats.defense;
        
        // === НОВЫЙ КОД: Обновление заголовка с именем и уровнем ===
        if (this.containers.playerHeader) {
            this.containers.playerHeader.textContent = `${stats.name} [Ур. ${stats.level}]`;
        }
        
        // === НОВЫЙ КОД: Обновление маны ===
        if (this.containers.playerMana) {
            this.containers.playerMana.textContent = `${stats.mana || 0}/${stats.maxMana || 50}`;
        }
        if (this.containers.manaBar) {
            const manaPercent = stats.maxMana ? (stats.mana / stats.maxMana) * 100 : 0;
            this.containers.manaBar.style.width = `${manaPercent}%`;
            // Опционально: меняем цвет при низкой мане
            if (manaPercent < 20) {
                this.containers.manaBar.style.background = '#ff4444';
            } else {
                this.containers.manaBar.style.background = 'linear-gradient(90deg, #4a4aff, #8a8aff)';
            }
        }
        
        // === НОВЫЙ КОД: Обновление выносливости ===
        if (this.containers.playerStamina) {
            this.containers.playerStamina.textContent = `${stats.stamina || 0}/${stats.maxStamina || 100}`;
        }
        if (this.containers.staminaBar) {
            const staminaPercent = stats.maxStamina ? (stats.stamina / stats.maxStamina) * 100 : 0;
            this.containers.staminaBar.style.width = `${staminaPercent}%`;
            // Опционально: меняем цвет при низкой выносливости
            if (staminaPercent < 20) {
                this.containers.staminaBar.style.background = '#ff4444';
            } else {
                this.containers.staminaBar.style.background = 'linear-gradient(90deg, #44ff44, #aaff44)';
            }
        }
        
        // Полоски здоровья и опыта
        if (this.containers.healthBar) {
            const healthPercent = (stats.health / stats.maxHealth) * 100;
            this.containers.healthBar.style.width = `${healthPercent}%`;
            this.containers.healthBar.style.background = healthPercent < 30 ? '#ff4444' : 
                                                        healthPercent < 60 ? '#ffaa44' : '#44ff44';
        }
        
        if (this.containers.expBar) {
            const expPercent = (stats.exp / stats.expToNext) * 100;
            this.containers.expBar.style.width = `${expPercent}%`;
        }
        
        // Обновление компонента характеристик
        if (this.components.stats) {
            this.components.stats.update(stats);
        }
    }
    
    updateInventory() {
        const invInfo = this.game.inventorySystem.getInventoryInfo();
        
        if (this.components.inventory && invInfo) {
            this.components.inventory.update(invInfo);
        }
        
        if (this.components.equipment && invInfo?.equipment) {
            this.components.equipment.update(invInfo.equipment);
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
    
    updateBattleLog(messages) {
        if (this.components.log && Array.isArray(messages)) {
            this.components.log.addBatch(messages.map(msg => ({ message: msg, type: 'battle' })));
        }
    }
    
    showBattleUI(battleData) {
        const enemiesContainer = document.getElementById('room-enemies-container');
        if (enemiesContainer) enemiesContainer.style.display = 'none';
        if (enemiesContainer) enemiesContainer.style.display = 'none';
        if (this.components.battle) {
            this.components.battle.onBattleStart(battleData);
        }
        
        // Скрываем кнопки исследования
        if (this.containers.exploreBtn) this.containers.exploreBtn.style.display = 'none';
        if (this.containers.searchEnemiesBtn) this.containers.searchEnemiesBtn.style.display = 'none';
    }
    
    hideBattleUI() {
        const enemiesContainer = document.getElementById('room-enemies-container');
            if (enemiesContainer) enemiesContainer.style.display = 'block';

            const battleContainer = document.getElementById('battle-ui');
            if (battleContainer) battleContainer.style.display = 'none';
        if (enemiesContainer) enemiesContainer.style.display = 'block';
        if (this.components.battle) {
            this.components.battle.onBattleEnd();
        }
        
        // Показываем кнопки исследования
        if (this.containers.exploreBtn) this.containers.exploreBtn.style.display = 'flex';
        if (this.containers.searchEnemiesBtn) this.containers.searchEnemiesBtn.style.display = 'flex';
    }
    
    showShop(shopInfo) {
        this.eventBus.emit('shop:open', shopInfo);
    }
    
    showVictoryScreen(result) {
        if (result.log) {
            result.log.forEach(msg => this.addToLog(msg, 'victory'));
        }
    }

    createEnemiesContainer() {        
        const battleContainer = document.getElementById('battle-ui');
        if (!battleContainer) return null;
        
        const existingContainer = document.getElementById('room-enemies-container');
        if (existingContainer) return existingContainer;
        
        const container = document.createElement('div');
        container.id = 'room-enemies-container';
        
        container.className = 'battle-card'; 
        
        battleContainer.parentNode.insertBefore(container, battleContainer);
        
        battleContainer.style.display = 'none';
        container.style.display = 'block';
        
        return container;
    }
    showEnemiesInRoom(data) {
        // 1. Создаем/получаем контейнер
        const container = this.createEnemiesContainer();
        if (!container) return;
        
        // 2. Если врагов нет - скрываем
        if (!data.enemies || data.enemies.length === 0) {
            container.innerHTML = '<div class="no-enemies">В этой комнате:</div>';
            container.style.display = 'block';
            return;
        }
        
        // 3. Отрисовываем КОМПАКТНЫЙ список врагов
        let html = '<div class="room-enemies-header">В этой комнате:</div>';
        
        data.enemies.forEach((enemy, index) => {
            if (!enemy || !enemy.name) return;
            
            html += `
                <div class="room-enemy" data-index="${index}">
                    <div class="enemy-header">
                        <span class="enemy-name">${enemy.name}</span>
                        <span class="enemy-level">[Ур.${enemy.level || 1}]</span>
                    </div>
                    <button class="attack-btn" data-index="${index}">Атака</button>
                </div>
            `;
        });
        
        // 4. Вставляем HTML
        container.innerHTML = html;
        container.style.display = 'block';
        
        // 5. Вешаем обработчики ПОСЛЕ вставки
        setTimeout(() => {
            const buttons = container.querySelectorAll('.attack-btn');
            buttons.forEach(btn => {
                // Удаляем старые обработчики
                btn.replaceWith(btn.cloneNode(true));
            });
            
            // Вешаем новые
            container.querySelectorAll('.attack-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const index = parseInt(e.target.dataset.index);
                    if (!isNaN(index)) {
                        this.onAttackEnemy(index, data.enemies[index]);
                    }
                });
            });
        }, 10);
    }

    onAttackEnemy(index, enemyData) {
        if (!enemyData || !enemyData.type) {
            this.addToLog('Не удалось атаковать: данные врага повреждены', 'error');
            return;
        }
        
        // Скрываем список врагов при начале боя
        const container = document.getElementById('room-enemies-container');
        if (container) container.style.display = 'none';
        
        // Создаем врага и начинаем бой
        const enemy = this.game.enemyService.create(enemyData.type, enemyData.level || 1);
        const battleContainer = document.getElementById('battle-ui');
        if (battleContainer) battleContainer.style.display = 'block';

        const enemiesContainer = document.getElementById('room-enemies-container');
        if (enemiesContainer) enemiesContainer.style.display = 'none';
        if (enemy) {
            this.game.battleService.startBattle(enemy);
        } else {
            this.addToLog('Не удалось создать врага для боя', 'error');
            // Показываем список обратно
            if (container) container.style.display = 'block';
        }
    }

    showExplorationUI() {
        this.hideBattleUI();
        this.updateAll();
    }
    
    showError(message) {
        this.addToLog(`ОШИБКА: ${message}`, 'error');
    }
    
    // Callbacks
    onItemUse(index) {
        const result = this.game.inventorySystem.useItem(index, this.game.player);
        if (result.message) {
            this.addToLog(result.message, result.success ? 'success' : 'error');
        }
    }
    
    onItemEquip(index) {
        const result = this.game.inventorySystem.equipItem(index, this.game.player);
        if (result.message) {
            this.addToLog(result.message, result.success ? 'success' : 'error');
        }
    }
    
    onUnequip(slot) {
        const result = this.game.inventorySystem.unequipItem(slot, this.game.player);
        if (result.message) {
            this.addToLog(result.message, result.success ? 'success' : 'error');
        }
    }
    
    onAttack() {
        this.game.battleService.playerAttack();
    }
    
    onDefense() {
        this.game.battleService.useDefenseAction();
    }
    
    onEscape() {
        this.game.battleService.tryEscape();
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
// ui/UIManager.js
/**
 * UIManager - координатор UI компонентов (исправленная версия)
 * Принимает UI компоненты через конструктор
 */
class UIManager {
    constructor(game, uiComponents, graphicsEngine, battleCanvas) {
        this.game = game;
        this.graphicsEngine = graphicsEngine; 
        this.battleCanvas = battleCanvas;
        this.eventBus = game.gameState.eventBus;
        this.uiComponents = uiComponents; 
        this.components = {};
        
        this.callbacks = {
            onItemUse: (instanceId) => this.onItemUse(instanceId),
            onUnequip: (slot) => this.onUnequip(slot),
            onAttack: () => this.onAttack(),
            onDefense: () => this.onDefense(),
            onEscape: () => this.onEscape(),
            onBuyItem: (itemId) => this.onBuyItem(itemId),
            onSellItem: (instanceId) => this.onSellItem(instanceId),
            onAddToBelt: (instanceId) => this.onAddToBelt(instanceId),
            onItemDrop: (instanceId) => this.onItemDrop(instanceId),
            onEquip: (item, slot) => this.onEquip(item, slot)
        };
        
        this.containers = {};
        this.isInitialized = false;
    }
    
    init() {
        this.cacheContainers();
        this.bindGlobalEvents();
        this.setupEventSubscriptions();
        this.updateAll();
        this.updateRoomEntitiesList();
        this.initComponentsSync();
            // Инициализация графического движка, если он есть
            if (this.graphicsEngine && !this.graphicsEngine.isInitialized) {
                this.graphicsEngine.init();
            }
            if (this.battleCanvas && !this.battleCanvas.isInitialized) {
                this.battleCanvas.init();
            }    
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
            battle: document.getElementById('battle-ui'),
            // Элементы игрока
            playerHealth: document.getElementById('player-health'),
            playerExp: document.getElementById('player-exp'),
            playerGold: document.getElementById('player-gold'),
            playerAttack: document.getElementById('player-attack'),
            playerDefense: document.getElementById('player-defense'),
            healthBar: document.getElementById('health-bar'),
            playerName: document.getElementById('player-name'),
            playerLevel: document.getElementById('player-level'),
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
        // MapUI (не вкладка, а модальное окно)
        this.components.map = new this.uiComponents.MapUI(null, this.eventBus, this.game);
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
                this.callbacks.onItemUse,      // use
                this.callbacks.onAddToBelt,    // belt
                this.callbacks.onItemDrop      // drop
            );
            this.components.inventory.init();
        }
        // EquipmentUI
        if (this.containers.equipment) {
            this.components.equipment = new this.uiComponents.EquipmentUI(
                this.containers.equipment,
                this.eventBus,
                () => this.game.gameState.playerContainer.getAllEquipment(),
                this.callbacks.onUnequip,
                this.callbacks.onEquip
            );
            this.components.equipment.init();
        }
        
        // SkillsUI
        if (this.containers.skills) {
            this.components.skills = new this.uiComponents.SkillsUI(
                this.containers.skills,  
                this.eventBus,            
                this.game                 
            );
            this.components.skills.init();
        }
        // PassivesEffectsUI 
        const passivesContainer = document.getElementById('passives-effects-content');
        if (passivesContainer) {
            this.components.passives = new this.uiComponents.PassivesEffectsUI(
                passivesContainer,
                this.eventBus,
                this.game,
                () => this.game.player?.passiveManager || null,
                () => this.game.player?.getActiveEffects?.() || []
            );
            this.components.passives.init();
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
                // Проверка - идет ли бой
                if (this.game.combatSystem?.isInCombat()) {
                    this.addToLog('Нельзя переключать вкладки во время боя!', 'warning');
                    return;
                }
                
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
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

        this.eventBus.on('room:entitiesUpdated', () => {
            this.updateRoomEntitiesList();
        });
        // Показать карту
        this.eventBus.on('ui:showMap', () => {
            this.showMap();
        });
        // Движение
        this.eventBus.on('move:direction', (data) => {
            this.game.gameManager.move(data.direction);
        });
        // Победа в бою 
        this.eventBus.on('victory:show', (result) => {
            if (result.log) {
                result.log.forEach(msg => this.addToLog(msg, 'victory'));
            }
        });
        // Обновление пояса
        this.eventBus.on('belt:updated', () => {
            if (this.components.belt) {
                this.components.belt.update();
            }
        });

        this.eventBus.on('entity:click', (data) => {
            const entity = this.game.zoneManager?.getEntityById(data.entityId);
            if (!entity) return;
            
            // Мешок - старая модалка
            if (entity.type === 'ground_bag') {
                this.showBagLootModal(data.entityId);
                return;
            }
            
            // Труп - старая модалка (она уже будет с новыми кнопками ✨ и 🌀)
            if (entity.state === 'corpse') {
                this.showCorpseLootModal(data.entityId);
                return;
            }
            
            // Для живых (враги, NPC, игроки) и предметов/объектов - универсальная модалка
            this.showEntityActionModal(entity);
        });
        // Начало боя - переключаем канвасы
        this.eventBus.on('battle:start', () => {
            console.log('BattleCanvas: показываем боевой канвас');
            if (this.graphicsEngine) this.graphicsEngine.hide();
            if (this.battleCanvas) this.battleCanvas.show();
        });

        // Конец боя - возвращаем основной канвас
        this.eventBus.on('battle:end', () => {
            console.log('BattleCanvas: скрываем боевой канвас');
            if (this.battleCanvas) this.battleCanvas.hide();
            if (this.graphicsEngine) this.graphicsEngine.show();
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
        
        // Загрузка данных для вкладки
        if (tabName === 'inventory' || tabName === 'equipment') {
            this.updateInventory();
        }
        
        if (tabName === 'stats') {
            this.updatePlayerStats(this.game.player.getStats());
        }
        
        if (tabName === 'skills' && this.components.skills) {
            this.components.skills.render();
        }
        if (tabName === 'passives' && this.components.passives) {
            this.components.passives.render(); 
        }
    }
    
    updateAll() {
        this.updatePlayerStats(this.game.player.getStats());
        this.updateInventory();
        this.updateRoomInfo();
        if (this.components.belt) {
            this.components.belt.update();
        }
    }
    
    updatePlayerStats(stats) {
        if (!stats) return;
        // Имя в заголовке
        if (this.containers.playerName) {this.containers.playerName.textContent = stats.name || 'Герой';}
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
       // Уровень в отдельной строке
        if (this.containers.playerLevel) {this.containers.playerLevel.textContent = stats.level || 1;}
        
        if (this.containers.playerGold) {
            const items = this.game.gameState.playerContainer.getAllItems();
            const goldItem = items.find(item => item.id === 'gold');
            const goldAmount = goldItem ? goldItem.count : 0;
            this.containers.playerGold.textContent = goldAmount;
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
            // Обновление графики
        if (this.graphicsEngine && roomInfo) {
            this.graphicsEngine.handleRoomUpdate(roomInfo);
        }
        // 3. Показ/скрытие кнопки магазина
        if (this.containers.shopBtn) {
            this.containers.shopBtn.style.display = roomInfo.isShop ? 'flex' : 'none';
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
    showMap() {
        if (this.components.map) {
            this.components.map.show();
        }
    }    
    /**
     * Обработчик использования предмета по instanceId
     * @param {string} instanceId - уникальный ID экземпляра предмета
     */
    onItemUse(instanceId) {
        const result = this.game.player.useItem(instanceId);
        if (result.message) {
            this.addToLog(result.message, result.success ? 'success' : 'error');
        }
    }

    onEquip(item, slot) {
        const result = this.game.player.equipItem(item, slot);
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
    onSellItem(instanceId) {
        this.game.gameManager.sellItemToShop(instanceId);
    }

    /**
     * Обработчик добавления предмета на пояс по instanceId
     * @param {string} instanceId - уникальный ID экземпляра предмета
     */
    onAddToBelt(instanceId) {
        if (!this.game.beltSystem) {
            this.addToLog("Система пояса не найдена", "error");
            return;
        }
        
        const result = this.game.beltSystem.addToBeltFromInventory(instanceId);
        if (result.message) {
            this.addToLog(result.message, result.success ? 'success' : 'error');
        }
    }
    /**
     * Обработчик выбрасывания предмета по instanceId
     * @param {string} instanceId - уникальный ID экземпляра предмета
     */
    onItemDrop(instanceId) {
        const result = this.game.player.dropItem(instanceId);
        if (result.message) {
            this.addToLog(result.message, result.success ? 'success' : 'error');
        }
    }
    /**
     * Показать модалку с содержимым мешка
     * @param {string} bagId - ID мешка
     */
    showBagLootModal(bagId) {
        // Получаем мешок из ZoneManager
        const bag = this.game.zoneManager?.getEntityById(bagId);
        if (!bag || bag.type !== 'ground_bag') return;
        
        const bagInfo = bag.getInfo();
        const items = bagInfo.items || [];
        
        // Создаем модалку
        const modal = document.createElement('div');
        modal.className = 'bag-loot-modal';
        modal.innerHTML = `
            <div class="modal-header">
                <h3>Мешок с предметами</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-content">
                ${items.length === 0 ? '<p>Мешок пуст</p>' : ''}
                <div class="bag-items-list">
                    ${items.map(item => `
                        <div class="bag-item-row" data-instance-id="${item.instanceId}">
                            <span class="item-name">${item.name}</span>
                            ${item.count > 1 ? `<span class="item-count">×${item.count}</span>` : ''}
                            <button class="take-item-btn" data-instance-id="${item.instanceId}">Взять</button>
                        </div>
                    `).join('')}
                </div>
                ${items.length > 0 ? '<button class="take-all-btn">Взять всё</button>' : ''}
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Обработчики
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelectorAll('.take-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const instanceId = btn.dataset.instanceId;
                this.takeItemFromBag(bagId, instanceId);
                modal.remove();
            });
        });
        
        const takeAllBtn = modal.querySelector('.take-all-btn');
        if (takeAllBtn) {
            takeAllBtn.addEventListener('click', () => {
                this.takeAllFromBag(bagId);
                modal.remove();
            });
        }
        
        // Закрытие по клику вне модалки
        setTimeout(() => {
            document.addEventListener('click', function closeHandler(e) {
                if (!modal.contains(e.target)) {
                    modal.remove();
                    document.removeEventListener('click', closeHandler);
                }
            });
        }, 10);
    }
    /**
     * Взять предмет из мешка по instanceId
     * @param {string} bagId - ID мешка
     * @param {string} instanceId - уникальный ID экземпляра предмета
     */
    takeItemFromBag(bagId, instanceId) {
        const bag = this.game.zoneManager?.getEntityById(bagId);
        if (!bag) return;
        
        const item = bag.removeItem(instanceId);
        if (!item) return;
        
        const added = this.game.player.addItem(item);
        
        if (added) {
            this.addToLog(`Вы взяли ${item.name} из мешка`, 'success');
        } else {
            // Если не влезло - возвращаем в мешок
            bag.addItem(item);
            this.addToLog('Недостаточно места в инвентаре', 'error');
        }
        
        this.eventBus.emit('inventory:updated', this.game.gameState.playerContainer.getInfo());
    }

    /**
     * Взять все предметы из мешка
     * @param {string} bagId - ID мешка
     */
    takeAllFromBag(bagId) {
        const bag = this.game.zoneManager?.getEntityById(bagId);
        if (!bag) return;
        
        const result = bag.takeAll(this.game.player);
        
        if (result.success) {
            this.addToLog(result.message, 'success');
        } else {
            this.addToLog(result.message, 'error');
        }
        
        this.eventBus.emit('inventory:updated', this.game.gameState.playerContainer.getInfo());
    }
    // МЕТОДЫ ДЛЯ РАБОТЫ С ТРУПАМИ 
    /**
     * Показать модалку с содержимым трупа (стиль как у мешка)
     * @param {string} corpseId - ID трупа
     */
    showCorpseLootModal(corpseId) {
        const corpse = this.game.zoneManager?.getEntityById(corpseId);
        if (!corpse || corpse.state !== 'corpse') {
            return;
        }
        const corpseInfo = corpse.getInfo();
        const items = corpseInfo.inventory || [];
        
        const modal = document.createElement('div');
        modal.className = 'bag-loot-modal';
        modal.innerHTML = `
            <div class="modal-header">
                <h3>${corpseInfo.name}</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-content">
                ${items.length === 0 ? '<p>В трупе ничего нет</p>' : ''}
                <div class="bag-items-list">
                    ${items.map(item => `
                        <div class="bag-item-row" data-instance-id="${item.instanceId}">
                            <span class="item-name">${item.name}</span>
                            ${item.count > 1 ? `<span class="item-count">×${item.count}</span>` : ''}
                            <button class="take-item-btn" data-instance-id="${item.instanceId}">Взять</button>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Первая строка кнопок: действия с предметами -->
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    ${items.length > 0 ? '<button class="take-all-btn" style="flex: 1;">Взять всё</button>' : ''}
                    <button class="pickup-corpse-btn" style="flex: 1;">🎒 Поднять труп</button>
                </div>
                
                <!-- Вторая строка кнопок: способности -->
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button class="corpse-spells-btn" style="flex: 1;">✨ Заклинания</button>
                    <button class="corpse-skills-btn" style="flex: 1;">🌀 Умения</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Обработчики
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelectorAll('.take-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const instanceId = btn.dataset.instanceId;
                this.takeItemFromCorpse(corpseId, instanceId);
                modal.remove();
            });
        });
        
        const takeAllBtn = modal.querySelector('.take-all-btn');
        if (takeAllBtn) {
            takeAllBtn.addEventListener('click', () => {
                this.takeAllFromCorpse(corpseId);
                modal.remove();
            });
        }
        
        const pickupBtn = modal.querySelector('.pickup-corpse-btn');
        if (pickupBtn) {
            pickupBtn.addEventListener('click', () => {
                this.pickupCorpse(corpseId);
                modal.remove();
            });
        }
        
        // Обработчики для заклинаний и умений
        const spellsBtn = modal.querySelector('.corpse-spells-btn');
        if (spellsBtn) {
            spellsBtn.addEventListener('click', () => {
                this.showAbilitiesForCorpse(corpseId, 'spell');
                modal.remove();
            });
        }
        
        const skillsBtn = modal.querySelector('.corpse-skills-btn');
        if (skillsBtn) {
            skillsBtn.addEventListener('click', () => {
                this.showAbilitiesForCorpse(corpseId, 'skill');
                modal.remove();
            });
        }
        
        // Закрытие по клику вне модалки
        setTimeout(() => {
            document.addEventListener('click', function closeHandler(e) {
                if (!modal.contains(e.target)) {
                    modal.remove();
                    document.removeEventListener('click', closeHandler);
                }
            });
        }, 10);
    }
    // Новый метод для показа способностей для трупа
    showAbilitiesForCorpse(corpseId, type) {
        const corpse = this.game.zoneManager?.getEntityById(corpseId);
        if (!corpse) return;
        
        const modal = new this.uiComponents.EntityActionModal({
            entityId: corpseId,
            entityType: 'corpse',
            entityData: { name: corpse.name },
            game: this.game,
            eventBus: this.eventBus,
            onClose: () => {}
        });
        
        // Принудительно открываем список способностей
        modal.showAbilities(type);
        modal.show();
    }
    /**
     * Взять предмет из трупа по instanceId
     * @param {string} corpseId - ID трупа
     * @param {string} instanceId - уникальный ID экземпляра предмета
     */
    takeItemFromCorpse(corpseId, instanceId) {
        const corpse = this.game.zoneManager?.getEntityById(corpseId);
        if (!corpse || corpse.state !== 'corpse') return;
        
        const item = corpse.lootItem ? corpse.lootItem(instanceId) : null;
        if (!item) return;
        
        const added = this.game.player.addItem(item);
        
        if (added) {
            this.addToLog(`Вы взяли ${item.name} из трупа`, 'success');
            this.eventBus.emit('inventory:updated', this.game.gameState.playerContainer.getInfo());
        } else {
            // Если не влезло - возвращаем в труп
            if (corpse.addItem) {
                corpse.addItem(item);
            }
            this.addToLog('Недостаточно места в инвентаре', 'error');
        }
        
        // Обновляем отображение комнаты
        this.eventBus.emit('room:entitiesUpdated', {
            roomId: this.game.gameState.getPosition().room,
            entities: this.game.zoneManager?.getRoomEntitiesInfo(this.game.gameState.getPosition().room)
        });
    }
    /**
     * Взять все предметы из трупа
     * @param {string} corpseId - ID трупа
     */
    takeAllFromCorpse(corpseId) {
        const corpse = this.game.zoneManager?.getEntityById(corpseId);
        if (!corpse || corpse.state !== 'corpse') return;
        
        const result = corpse.lootAll ? corpse.lootAll() : { items: [], equipment: {} };
        const allItems = [...result.items, ...Object.values(result.equipment).filter(Boolean)];
        
        let taken = 0;
        let failed = 0;
        
        for (const item of allItems) {
            const added = this.game.player.addItem(item);
            if (added) {
                taken++;
            } else {
                failed++;
                // Возвращаем в труп (упрощенно)
                if (corpse.addItem) {
                    corpse.addItem(item);
                }
            }
        }
        
        if (taken > 0) {
            this.addToLog(`Взято ${taken} предметов из трупа`, 'success');
            this.eventBus.emit('inventory:updated', this.game.gameState.playerContainer.getInfo());
        }
        
        if (failed > 0) {
            this.addToLog(`${failed} предметов не влезло в инвентарь`, 'warning');
        }
        
        // Обновляем отображение комнаты
        this.eventBus.emit('room:entitiesUpdated', {
            roomId: this.game.gameState.getPosition().room,
            entities: this.game.zoneManager?.getRoomEntitiesInfo(this.game.gameState.getPosition().room)
        });
    }

    /**
     * Поднять труп как предмет
     * @param {string} corpseId - ID трупа
     */
    pickupCorpse(corpseId) {
        const corpse = this.game.zoneManager?.getEntityById(corpseId);
        if (!corpse || corpse.state !== 'corpse') return;
        
        const corpseItem = corpse.pickupCorpse ? corpse.pickupCorpse(this.game.gameState) : null;
        if (!corpseItem) {
            this.addToLog('Не удалось поднять труп', 'error');
            return;
        }
        
        const added = this.game.player.addItem(corpseItem);
        
        if (added) {
            this.addToLog(`Вы подняли труп ${corpse.name}`, 'success');
            this.eventBus.emit('inventory:updated', this.game.gameState.playerContainer.getInfo());
            
            // Удаляем труп из комнаты
            this.game.zoneManager?.removeEntity(corpseId);
        } else {
            this.addToLog('Недостаточно места в инвентаре', 'error');
        }
        
        // Обновляем отображение комнаты
        this.eventBus.emit('room:entitiesUpdated', {
            roomId: this.game.gameState.getPosition().room,
            entities: this.game.zoneManager?.getRoomEntitiesInfo(this.game.gameState.getPosition().room)
        });
    }

    showEntityActionModal(entity) {
        // Определяем тип для модалки
        let modalType = 'living';
        if (entity.type === 'item') modalType = 'item';
        if (entity.type === 'object') modalType = 'object';
        
        // Собираем дополнительные данные для живых
        const entityData = {
            name: entity.name,
            level: entity.level || null,
            health: entity.getStats?.().health || null,
            maxHealth: entity.getStats?.().maxHealth || null
        };
        
        const modal = new this.uiComponents.EntityActionModal({
            entityId: entity.id,
            entityType: modalType,
            entityData: entityData,  // ← теперь с уровнем и здоровьем
            game: this.game,
            eventBus: this.eventBus,
            onClose: () => {}
        });
        
        modal.show();
    }

    updateRoomEntitiesList() {
        const container = document.getElementById('battle-ui');
        if (!container) return;
        
        const roomId = this.game.gameState.getPosition().room;
        const entities = this.game.zoneManager?.getRoomEntities(roomId) || [];
        
        // Фильтруем только живые сущности (state = 'alive')
        const aliveEntities = entities.filter(e => e.isAlive && e.isAlive());
        
        let html = '<h2><i class="fas fa-users"></i> Кто в комнате</h2>';
        html += '<div class="room-entities-list">';
        
        aliveEntities.forEach(entity => {
            const isPlayer = entity.type === 'player';
            const nameClass = isPlayer ? 'player-name' : 'enemy-name';
            html += `<div class="room-entity-item ${nameClass}">${entity.name}</div>`;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    destroy() {
        Object.values(this.components).forEach(component => {
            if (component && typeof component.destroy === 'function') {
                component.destroy();
            }
        });
        this.components = {};
        
        // Очистка графического движка
        if (this.graphicsEngine && typeof this.graphicsEngine.destroy === 'function') {
            this.graphicsEngine.destroy();
        }
        this.graphicsEngine = null;
        if (this.battleCanvas) {
            this.battleCanvas.destroy();
        }
        if (this.components.passives) {
            this.components.passives.destroy();
        }
    }
}

export { UIManager };
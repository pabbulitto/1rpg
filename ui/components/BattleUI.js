// ui/components/BattleUI.js

class BattleUI {
    constructor(container, game) {
        if (!container) {
            throw new Error('BattleUI: container не указан');
        }
        if (!game) {
            throw new Error('BattleUI: game объект не передан');
        }
        
        this.container = container;
        this.game = game;
        this.eventBus = game.gameState?.eventBus;
        this.combatSystem = game.combatSystem;
        this.battleOrchestrator = game.battleOrchestrator;
        this.enemyService = game.enemyService;
        
        this.unsubscribeFunctions = [];
        this.elements = {};
        this.corpsesContainer = null;
    }
    
    init() {
        this.cacheElements();
        this.setupButtonListeners();
        this.setupEventSubscriptions();
        // Создаём вкладки вместо отдельного контейнера врагов
        const battleContainer = document.getElementById('battle-ui')?.parentNode;
        if (battleContainer) {
            const existingTabs = document.getElementById('location-tabs-container');
            if (existingTabs) existingTabs.remove();
            
            const tabsContainer = this.createLocationTabs();
            battleContainer.insertBefore(tabsContainer, document.getElementById('battle-ui'));
            this.initLocationTabs();
        }
        
        this.resetUI();
        this.container.style.display = 'none';
        return this;
    }
    
    // ========== НОВЫЕ МЕТОДЫ ДЛЯ ВКЛАДОК ==========
    
    /**
     * Создать контейнер с вкладками
     */
    createLocationTabs() {
        const container = document.createElement('div');
        container.className = 'location-tabs-container';
        container.id = 'location-tabs-container';
        
        container.innerHTML = `
            <div class="location-tabs">
                <button class="location-tab active" data-tab="enemies">
                    <i class="fas fa-skull"></i> Враги
                    <span class="tab-count" id="enemies-count">0</span>
                </button>
                <button class="location-tab" data-tab="corpses">
                    <i class="fas fa-box"></i> Трупы
                    <span class="tab-count" id="corpses-count">0</span>
                </button>
            </div>
            <div class="location-content">
                <div id="location-enemies" class="location-pane active"></div>
                <div id="location-corpses" class="location-pane"></div>
                <div id="location-items" class="location-pane"></div>
            </div>
        `;
        
        return container;
    }
    
    /**
     * Инициализация вкладок
     */
    initLocationTabs() {
        const container = document.getElementById('location-tabs-container');
        if (!container) return;
        
        container.querySelectorAll('.location-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = tab.dataset.tab;
                
                container.querySelectorAll('.location-tab').forEach(t => 
                    t.classList.remove('active'));
                tab.classList.add('active');
                
                container.querySelectorAll('.location-pane').forEach(p => 
                    p.classList.remove('active'));
                document.getElementById(`location-${tabName}`).classList.add('active');
            });
        });
    }
    
    /**
     * Показать врагов в комнате
     */
    showEnemiesInRoom(data) {
        const pane = document.getElementById('location-enemies');
        if (!pane) return;
        
        // Фильтруем врагов: только не-игроки
        const enemies = data.enemies ? data.enemies.filter(e => e.type !== 'player') : [];
        
        if (!enemies || enemies.length === 0) {
            pane.innerHTML = '<div class="no-entities">Врагов нет</div>';
            document.getElementById('enemies-count').textContent = '0';
            return;
        }
        
        let html = '<div class="entities-list">';
        enemies.forEach((enemy, index) => {
            html += `
                <div class="entity-item enemy" data-enemy-id="${enemy.id}">
                    <div class="entity-icon"><i class="fas fa-skull"></i></div>
                    <div class="entity-info">
                        <div class="entity-name">${enemy.name}</div>
                        <div class="entity-level">Ур.${enemy.level || 1}</div>
                        <div class="entity-health">❤️ ${enemy.health || 0}/${enemy.maxHealth || 0}</div>
                    </div>
                    <button class="entity-action attack-btn" data-enemy-id="${enemy.id}">
                        Атаковать
                    </button>
                </div>
            `;
        });
        html += '</div>';
        
        pane.innerHTML = html;
        document.getElementById('enemies-count').textContent = enemies.length;
        
        pane.querySelectorAll('.attack-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const enemyId = btn.dataset.enemyId;
                if (enemyId) this.onAttackEnemy(enemyId);
            });
        });
    }
    
    /**
     * Показать трупы в комнате
     */
    showCorpsesInRoom(corpses) {
        const pane = document.getElementById('location-corpses');
        if (!pane) return;
        
        if (!corpses || corpses.length === 0) {
            pane.innerHTML = '<div class="no-entities">Трупов нет</div>';
            document.getElementById('corpses-count').textContent = '0';
            return;
        }
        
        let html = '<div class="entities-list">';
        corpses.forEach((corpse, index) => {
            // corpse теперь может быть как старым объектом Corpse, так и Entity с state = 'corpse'
            const timeLeft = corpse.remainingTicks ? Math.ceil(corpse.remainingTicks / 10) : 0;
            
            // Получаем инвентарь (работает и для Corpse, и для Entity)
            const inventory = corpse.inventory || (corpse.container?.getAllItems?.() || []);
            const equipment = corpse.equipment || (corpse.container?.getAllEquipment?.() || {});
            
            const itemCount = inventory.length + 
                            Object.values(equipment).filter(Boolean).length;
            
            html += `
                <div class="entity-item corpse" data-corpse-id="${corpse.id}">
                    <div class="entity-icon"><i class="fas fa-box"></i></div>
                    <div class="entity-info">
                        <div class="entity-name">${corpse.name}</div>
                        <div class="entity-level">Ур.${corpse.level || 1}</div>
                        <div class="entity-items">📦 ${itemCount} предметов</div>
                        ${timeLeft ? `<div class="entity-timer">⏳ ${timeLeft}с</div>` : ''}
                    </div>
                    <div class="entity-actions">
                        <button class="entity-action loot-btn" data-corpse-id="${corpse.id}">
                            Осмотреть
                        </button>
                        <button class="entity-action loot-all-btn" data-corpse-id="${corpse.id}">
                            Взять всё
                        </button>
                        <button class="entity-action pickup-btn" data-corpse-id="${corpse.id}">
                            Поднять
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        pane.innerHTML = html;
        document.getElementById('corpses-count').textContent = corpses.length;
        
        this.attachCorpseEventListeners(pane);
    }
    
    /**
     * Показать предметы на земле (заглушка)
     */
    showItemsOnGround(items) {
        const pane = document.getElementById('location-items');
        if (!pane) return;
        
        if (!items || items.length === 0) {
            pane.innerHTML = '<div class="no-entities">Предметов нет</div>';
            document.getElementById('items-count').textContent = '0';
            return;
        }
        
        let html = '<div class="entities-list">';
        items.forEach((item, index) => {
            html += `
                <div class="entity-item item" data-item-id="${item.id}">
                    <div class="entity-icon"><i class="fas fa-apple-alt"></i></div>
                    <div class="entity-info">
                        <div class="entity-name">${item.name}</div>
                        ${item.count > 1 ? `<div class="entity-count">×${item.count}</div>` : ''}
                    </div>
                    <button class="entity-action pickup-item-btn" data-item-index="${index}">
                        Поднять
                    </button>
                </div>
            `;
        });
        html += '</div>';
        
        pane.innerHTML = html;
        document.getElementById('items-count').textContent = items.length;
    }
    
    /**
     * Обновить счётчики на вкладках
     */
    updateTabCounts() {
        const roomInfo = this.game.zoneManager.getCurrentRoomInfo();
        if (!roomInfo) return;
        
        const enemies = this.game.zoneManager.getRoomEnemies?.() || [];
        document.getElementById('enemies-count').textContent = enemies.length;
        
        const corpses = this.game.zoneManager.getRoomCorpses?.(roomInfo.roomId) || [];
        document.getElementById('corpses-count').textContent = corpses.length;
        
        document.getElementById('items-count').textContent = '0';
    }
    
    /**
     * Заглушка для обратной совместимости
     */
    createEnemiesContainer() {
        return null;
    }
    
    // ========== МЕТОДЫ ДЛЯ РАБОТЫ С ТРУПАМИ ==========
    attachCorpseEventListeners(pane) {
        if (!pane) return;
        
        // Удаляем старый обработчик если был
        pane.removeEventListener('click', this._corpseClickHandler);
        
        // Создаём и сохраняем обработчик
        this._corpseClickHandler = (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            const corpseId = btn.dataset.corpseId;
            if (!corpseId) return;
            
            e.stopPropagation();
            
            if (btn.classList.contains('loot-btn')) {
                this.openCorpseLoot(corpseId);
            } else if (btn.classList.contains('loot-all-btn')) {
                this.lootAllCorpse(corpseId);
            } else if (btn.classList.contains('pickup-btn')) {
                this.pickupCorpse(corpseId);
            }
        };
        
        // Вешаем один обработчик на весь контейнер
        pane.addEventListener('click', this._corpseClickHandler);
    }
    
    openCorpseLoot(corpseId) {
        const roomInfo = this.game.zoneManager.getCurrentRoomInfo();
        if (!roomInfo) return;
        
        const corpses = this.game.zoneManager.getRoomCorpses(roomInfo.roomId);
        const corpse = corpses.find(c => c.id === corpseId);
        if (!corpse) return;
        
        const corpseInfo = corpse.getInfo();
        
        const modal = document.createElement('div');
        modal.className = 'corpse-loot-modal';
        modal.innerHTML = `
            <div class="corpse-loot-header">
                <h3>${corpseInfo.name}</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="corpse-loot-content">
                <div class="corpse-inventory">
                    <h4>Предметы</h4>
                    <div class="corpse-items-grid">
                        ${this.renderCorpseItems(corpseInfo.inventory || [])}
                    </div>
                </div>
                <div class="corpse-equipment">
                    <h4>Экипировка</h4>
                    <div class="corpse-equipment-grid">
                        ${this.renderCorpseEquipment(corpseInfo.equipment || {})}
                    </div>
                </div>
            </div>
            <div class="corpse-loot-footer">
                <button class="btn loot-all-from-corpse" data-corpse-id="${corpseId}">
                    📦 Взять всё
                </button>
                <button class="btn pickup-corpse" data-corpse-id="${corpseId}">
                    🎒 Поднять труп
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('.loot-all-from-corpse')?.addEventListener('click', () => {
            this.lootAllCorpse(corpseId);
            modal.remove();
        });
        
        modal.querySelector('.pickup-corpse')?.addEventListener('click', () => {
            this.pickupCorpse(corpseId);
            modal.remove();
        });
        
        modal.querySelectorAll('.loot-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemIndex = parseInt(btn.dataset.index);
                this.lootCorpseItem(corpseId, itemIndex);
                modal.remove();
            });
        });
        
        modal.querySelectorAll('.loot-equipment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slot = btn.dataset.slot;
                this.lootCorpseEquipment(corpseId, slot);
                modal.remove();
            });
        });
    }
    
    renderCorpseItems(items) {
        if (!items || items.length === 0) {
            return '<p class="no-items">Нет предметов</p>';
        }
        
        return items.map((item, index) => `
            <div class="corpse-item-row">
                <span class="item-name">${item.name}</span>
                ${item.count > 1 ? `<span class="item-count">×${item.count}</span>` : ''}
                <button class="loot-item-btn" data-index="${index}">
                    Взять
                </button>
            </div>
        `).join('');
    }
    
    renderCorpseEquipment(equipment) {
        const slotNames = {
            head: 'Голова', neck1: 'Шея 1', neck2: 'Шея 2',
            arms: 'Руки', hands: 'Кисти',
            ring1: 'Кольцо 1', ring2: 'Кольцо 2',
            body: 'Тело', belt: 'Пояс',
            legs: 'Ноги', feet: 'Ступни',
            right_hand: 'Правая рука', left_hand: 'Левая рука'
        };
        
        let html = '';
        Object.entries(equipment).forEach(([slot, item]) => {
            if (item) {
                html += `
                    <div class="corpse-equipment-row">
                        <span class="slot-name">${slotNames[slot] || slot}:</span>
                        <span class="item-name">${item.name}</span>
                        <button class="loot-equipment-btn" data-slot="${slot}">
                            Взять
                        </button>
                    </div>
                `;
            }
        });
        
        return html || '<p class="no-items">Нет экипировки</p>';
    }
    /**
     * Забрать все вещи из трупа
     * @param {string} corpseId - ID трупа
     */
    lootAllCorpse(corpseId) {
        const roomInfo = this.game.zoneManager.getCurrentRoomInfo();
        if (!roomInfo) return;
        
        // Получаем труп из ZoneManager по ID
        const corpse = this.game.zoneManager.getEntityById(corpseId);
        if (!corpse || corpse.state !== 'corpse') return;
        
        // Забираем все вещи из трупа
        const { items, equipment } = corpse.lootAll();
        
        // Добавляем предметы в инвентарь игрока
        items.forEach(item => this.game.gameState.playerContainer.addItem(item));
        Object.values(equipment).forEach(item => {
            if (item) this.game.gameState.playerContainer.addItem(item);
        });
        
        this.eventBus.emit('inventory:updated');
        this.eventBus.emit('log:add', {
            message: `Вы забрали все вещи из трупа`,
            type: 'success'
        });
    }
    /**
     * Забрать конкретный предмет из трупа
     * @param {string} corpseId - ID трупа
     * @param {number} itemIndex - индекс предмета в инвентаре трупа
     */
    lootCorpseItem(corpseId, itemIndex) {
        const roomInfo = this.game.zoneManager.getCurrentRoomInfo();
        if (!roomInfo) return;
        
        // Получаем труп из ZoneManager по ID
        const corpse = this.game.zoneManager.getEntityById(corpseId);
        if (!corpse || corpse.state !== 'corpse') return;
        
        // Забираем предмет из трупа
        const item = corpse.lootItem(itemIndex);
        if (!item) return;
        
        // Добавляем предмет в инвентарь игрока
        this.game.gameState.playerContainer.addItem(item);

        this.eventBus.emit('inventory:updated');
        this.eventBus.emit('log:add', {
            message: `Вы взяли ${item.name} из трупа`,
            type: 'success'
        });
    }
    /**
     * Забрать предмет экипировки из трупа
     * @param {string} corpseId - ID трупа
     * @param {string} slot - слот экипировки
     */
    lootCorpseEquipment(corpseId, slot) {
        const roomInfo = this.game.zoneManager.getCurrentRoomInfo();
        if (!roomInfo) return;
        
        // Получаем труп из ZoneManager по ID
        const corpse = this.game.zoneManager.getEntityById(corpseId);
        if (!corpse || corpse.state !== 'corpse') return;
        
        // Забираем предмет экипировки из трупа
        const item = corpse.lootEquipment(slot);
        if (!item) return;
        
        // Добавляем предмет в инвентарь игрока
        this.game.gameState.playerContainer.addItem(item);
        
        this.eventBus.emit('inventory:updated');
        this.eventBus.emit('player:equipmentChanged', { slot, item: null });
        this.eventBus.emit('log:add', {
            message: `Вы сняли ${item.name} с трупа`,
            type: 'success'
        });
    }
    /**
     * Поднять труп как предмет
     * @param {string} corpseId - ID трупа
     */
    pickupCorpse(corpseId) {
        const roomInfo = this.game.zoneManager.getCurrentRoomInfo();
        if (!roomInfo) return;
        
        // Получаем труп из ZoneManager по ID
        const corpse = this.game.zoneManager.getEntityById(corpseId);
        if (!corpse || corpse.state !== 'corpse') return;
        
        // Поднимаем труп (превращаем в предмет)
        const corpseItem = corpse.pickupCorpse(this.game.gameState);
        if (!corpseItem) return;
        
        // Добавляем предмет-труп в инвентарь игрока
        this.game.gameState.playerContainer.addItem(corpseItem);
        
        // Удаляем труп из комнаты
        this.game.zoneManager.removeEntity(corpseId);
        
        this.eventBus.emit('inventory:updated');
        this.eventBus.emit('log:add', {
            message: `Вы подняли труп ${corpse.name}`,
            type: 'success'
        });
    }
    // ========== СУЩЕСТВУЮЩИЕ МЕТОДЫ (БЕЗ ИЗМЕНЕНИЙ) ==========
    
    cacheElements() {
        this.elements = {
            enemyName: this.container.querySelector('#enemy-name'),
            enemyHealthText: this.container.querySelector('#enemy-health'),
            enemyHealthBar: this.container.querySelector('.enemy-health-bar'),
            attackBtn: this.container.querySelector('#attack-btn'),
            potionBtn: this.container.querySelector('#potion-btn'),
            escapeBtn: this.container.querySelector('#escape-btn'),
            skillsBtn: this.container.querySelector('#skills-btn') || null,
            spellsBtn: this.container.querySelector('#spells-btn') || null
        };
    }
    
    setupButtonListeners() {
        if (this.elements.attackBtn) {
            this.elements.attackBtn.addEventListener('click', () => this.handleAttack());
        }
        if (this.elements.potionBtn) {
            this.elements.potionBtn.addEventListener('click', () => this.handlePotion());
        }
        if (this.elements.escapeBtn) {
            this.elements.escapeBtn.addEventListener('click', () => this.handleEscape());
        }
        if (this.elements.skillsBtn) {
            this.elements.skillsBtn.addEventListener('click', () => this.handleSkills());
        }
        if (this.elements.spellsBtn) {
            this.elements.spellsBtn.addEventListener('click', () => this.handleSpells());
        }
    }

    setupEventSubscriptions() {
        const battleStart = this.eventBus.on('battle:start', (data) => this.onBattleStart(data));
        const battleUpdate = this.eventBus.on('battle:update', (data) => this.onBattleUpdate(data));
        const battleEnd = this.eventBus.on('battle:end', () => this.onBattleEnd());
        const explorationShow = this.eventBus.on('exploration:show', () => 
            this.showExplorationUI());
        
        // ===== НОВАЯ ПОДПИСКА: ВСЕ СУЩНОСТИ В КОМНАТЕ =====
        const entitiesUpdated = this.eventBus.on('room:entitiesUpdated', (data) => {
            if (data.roomId === this.game.gameState.getPosition().room) {
                // Фильтруем живых врагов
                const living = data.entities.filter(e => e.state === 'alive');
                // Фильтруем трупы
                const corpses = data.entities.filter(e => e.state === 'corpse');
                
                this.showEnemiesInRoom({ enemies: living });
                this.showCorpsesInRoom(corpses);
            }
        });
        
        this.unsubscribeFunctions.push(
            battleStart, 
            battleUpdate, 
            battleEnd, 
            explorationShow, 
            entitiesUpdated
        );
    }
    
    setLocationPanelsVisible(visible) {
        const tabsContainer = document.getElementById('location-tabs-container');
        if (tabsContainer) {
            tabsContainer.style.display = visible ? 'block' : 'none';
        }
    }

    onBattleStart(battleData) {
        if (!battleData) return;
        
        const enemyInfo = battleData.enemyData || battleData.enemy;
        if (!enemyInfo) return;
        
        if (this.elements.enemyName) {
            this.elements.enemyName.textContent = enemyInfo.name;
        }
        
        this.updateEnemyHealth(enemyInfo.health, enemyInfo.maxHealth);
        this.setButtonsEnabled(true);
        
        // ПОКАЗАТЬ БЛОК БОЯ, СКРЫТЬ ВКЛАДКИ
        this.container.style.display = 'block';
        this.setLocationPanelsVisible(false);
    }
    
    onBattleUpdate(battleData) {
        if (!battleData) return;
        
        const enemyInfo = battleData.enemyData || battleData.enemy;
        if (!enemyInfo) return;
        
        this.updateEnemyHealth(enemyInfo.health, enemyInfo.maxHealth);
    }
    
    onBattleEnd() {
        this.resetUI();
        this.setButtonsEnabled(false);
        
        this.container.style.display = 'none';
        this.setLocationPanelsVisible(true);
    }
    
    /**
     * Обработать атаку врага по ID
     * @param {string} enemyId - ID врага
     */
    onAttackEnemy(enemyId) {
        if (!enemyId) {
            this.addToLog('Ошибка: ID врага не указан', 'error');
            return;
        }
        
        // Получаем врага по ID через EnemyService
        const enemy = this.game.enemyService.getEnemyById(enemyId);
        
        if (!enemy) {
            console.error(`BattleUI: враг с ID ${enemyId} не найден`);
            this.addToLog('Враг не найден', 'error');
            return;
        }
        
        // Проверяем, жив ли враг
        if (enemy.state !== 'alive') {
            this.addToLog('Враг уже мертв', 'warning');
            return;
        }
        
        // Показываем блок боя
        this.container.style.display = 'block';
        this.setLocationPanelsVisible(false);
        
        // Запускаем бой
        this.game.battleOrchestrator.startBattle(enemy);
    }
    
    showExplorationUI() {
        this.setLocationPanelsVisible(true);
    }
    
    handleAttack() {
        if (this.combatSystem && this.combatSystem.isInCombat()) {
            this.eventBus.emit('combat:playerAction', {
                player: this.game.player,
                actionType: 'attack',
                data: null
            });
        }
    }
    
    handlePotion() {
        const player = this.game.player;
        if (!player) return;
        
        this.eventBus.emit('combat:playerAction', {
            player: player,
            actionType: 'item',
            data: { itemId: 'health_potion', fromInventory: true }
        });
    }
    
    handleEscape() {
        if (this.game.battleOrchestrator && this.game.battleOrchestrator.tryEscape) {
            this.game.battleOrchestrator.tryEscape();
        }
    }
    
    handleSkills() {
        if (this.combatSystem && this.combatSystem.isInCombat()) {
            this.showAbilitySelection('skill');
        }
    }
    
    handleSpells() {
        if (this.combatSystem && this.combatSystem.isInCombat()) {
            this.showAbilitySelection('spell');
        }
    }
    
    updateEnemyHealth(current, max) {
        if (!this.elements.enemyHealthText) return;
        
        this.elements.enemyHealthText.textContent = `${current}/${max}`;
        
        if (this.elements.enemyHealthBar) {
            const percent = Math.max(0, (current / max) * 100);
            this.elements.enemyHealthBar.style.width = `${percent}%`;
            
            if (percent < 30) {
                this.elements.enemyHealthBar.style.background = '#ff4444';
            } else if (percent < 60) {
                this.elements.enemyHealthBar.style.background = '#ffaa44';
            } else {
                this.elements.enemyHealthBar.style.background = '#44ff44';
            }
        }
    }
    
    setButtonsEnabled(enabled) {
        const btns = [
            this.elements.attackBtn,
            this.elements.potionBtn,
            this.elements.escapeBtn,
            this.elements.skillsBtn,
            this.elements.spellsBtn
        ].filter(btn => btn !== null);
        
        btns.forEach(btn => {
            if (btn) btn.disabled = !enabled;
        });
    }
    
    resetUI() {
        if (this.elements.enemyName) {
            this.elements.enemyName.textContent = '-';
        }
        if (this.elements.enemyHealthText) {
            this.elements.enemyHealthText.textContent = '-/-';
        }
        if (this.elements.enemyHealthBar) {
            this.elements.enemyHealthBar.style.width = '0%';
        }
        
        this.setButtonsEnabled(false);
    }
    
    addToLog(message, type = 'info') {
        this.eventBus.emit('log:add', { message, type });
    }
    
    showAbilitySelection(type) {
        const player = this.game.player;
        const abilityService = this.game.abilityService;
        
        if (!player || !abilityService) return;
        
        const abilities = abilityService.getAvailableAbilitiesForCharacter(player, type);
        if (abilities.length === 0) return;
        
        const modal = document.createElement('div');
        modal.className = 'ability-selection-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #2a2a2a;
            border: 2px solid #666;
            border-radius: 8px;
            padding: 10px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 5px;
            min-width: 150px;
            max-width: 200px;
            max-height: 300px;
            overflow-y: auto;
        `;
        
        abilities.forEach(ability => {
            const btn = document.createElement('button');
            btn.textContent = ability.name;
            btn.style.cssText = `
                padding: 4px 8px;
                background: #444;
                color: white;
                border: 1px solid #666;
                border-radius: 2px;
                cursor: pointer;
                text-align: left;
                font-size: 11px;
            `;
            btn.addEventListener('click', () => {
                this.eventBus.emit('combat:playerAction', {
                    player: player,
                    actionType: 'ability',
                    data: { abilityId: ability.id }
                });
                this.closeAbilityModal(modal);
            });
            modal.appendChild(btn);
        });
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            padding: 4px;
            background: transparent;
            color: #999;
            border: none;
            cursor: pointer;
            align-self: flex-end;
            font-size: 12px;
            margin-top: 5px;
        `;
        closeBtn.addEventListener('click', () => this.closeAbilityModal(modal));
        modal.appendChild(closeBtn);
        
        document.body.appendChild(modal);
        
        const closeOnOutsideClick = (e) => {
            if (!modal.contains(e.target) && !e.target.closest(`#${this.container.id}`)) {
                this.closeAbilityModal(modal);
                document.removeEventListener('click', closeOnOutsideClick);
            }
        };
        
        setTimeout(() => document.addEventListener('click', closeOnOutsideClick), 10);
    }
    
    closeAbilityModal(modal) {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }
    
    destroy() {
        this.unsubscribeFunctions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') unsubscribe();
        });
        this.unsubscribeFunctions = [];
            // Очищаем обработчик
        if (this._corpseClickHandler) {
            document.removeEventListener('click', this._corpseClickHandler);
        }
    }
}


export { BattleUI };

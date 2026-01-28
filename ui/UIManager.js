class UIManager {
  constructor(game) {
    this.game = game;
    this.elements = {};
  }
  
  init() {
    this.cacheElements();
    this.bindEvents();
    this.bindInventoryEvents();
    this.setupTabs();
    this.updateAll();
  }
  
  cacheElements() {
    this.elements.playerName = document.getElementById('player-name');
    this.elements.playerHealth = document.getElementById('player-health');
    this.elements.playerLevel = document.getElementById('player-level');
    this.elements.playerExp = document.getElementById('player-exp');
    this.elements.playerGold = document.getElementById('player-gold');
    this.elements.playerAttack = document.getElementById('player-attack');
    this.elements.playerDefense = document.getElementById('player-defense');
    
    this.elements.healthBar = document.getElementById('health-bar');
    this.elements.expBar = document.getElementById('exp-bar');
    
    this.elements.roomName = document.getElementById('room-name');
    this.elements.roomDesc = document.getElementById('room-description');
    this.elements.roomDescriptionBox = document.getElementById('room-description-box');
    
    this.elements.logContent = document.getElementById('log-content');
    
    this.elements.exploreBtn = document.getElementById('explore-btn');
    this.elements.restBtn = document.getElementById('rest-btn');
    this.elements.shopBtn = document.getElementById('shop-btn');
    this.elements.searchEnemiesBtn = document.getElementById('search-enemies-btn');
    
    this.elements.northBtn = document.getElementById('north-btn');
    this.elements.southBtn = document.getElementById('south-btn');
    this.elements.eastBtn = document.getElementById('east-btn');
    this.elements.westBtn = document.getElementById('west-btn');
    this.elements.upBtn = document.getElementById('up-btn');
    this.elements.downBtn = document.getElementById('down-btn');
    
    this.elements.battleUI = document.getElementById('battle-ui');
    this.elements.enemyName = document.getElementById('enemy-name');
    this.elements.enemyHealth = document.getElementById('enemy-health');
    this.elements.attackBtn = document.getElementById('attack-btn');
    this.elements.potionBtn = document.getElementById('potion-btn');
    this.elements.escapeBtn = document.getElementById('escape-btn');
    
    this.elements.minimap = document.getElementById('minimap');
    
    this.elements.tabs = document.querySelectorAll('.tab-button');
    this.elements.tabContents = document.querySelectorAll('.tab-content');
    
    this.elements.inventoryContent = document.getElementById('inventory-content');
    this.elements.equipmentContent = document.getElementById('equipment-content');
    
  }
  
  bindEvents() {
    this.elements.exploreBtn.addEventListener('click', () => this.game.explore());
    this.elements.restBtn.addEventListener('click', () => this.game.rest());
    this.elements.shopBtn.addEventListener('click', () => this.game.openShop());
    this.elements.searchEnemiesBtn.addEventListener('click', () => this.game.searchForEnemies());
    
    this.elements.northBtn.addEventListener('click', () => this.game.move('north'));
    this.elements.southBtn.addEventListener('click', () => this.game.move('south'));
    this.elements.eastBtn.addEventListener('click', () => this.game.move('east'));
    this.elements.westBtn.addEventListener('click', () => this.game.move('west'));
    this.elements.upBtn.addEventListener('click', () => this.game.move('up'));
    this.elements.downBtn.addEventListener('click', () => this.game.move('down'));
    
    this.elements.attackBtn.addEventListener('click', () => this.game.playerAttack());
    this.elements.potionBtn.addEventListener('click', () => this.game.useDefenseAction());
    this.elements.escapeBtn.addEventListener('click', () => this.game.tryEscape());
    this.elements.statsTitle = document.getElementById('stats-title');
    this.elements.goldOnHand = document.getElementById('gold-on-hand');
    this.elements.goldInBank = document.getElementById('gold-in-bank');
    this.elements.totalExp = document.getElementById('total-exp');
    this.elements.expToNext = document.getElementById('exp-to-next');
    
    this.elements.affectsList = document.getElementById('affects-list');
    this.elements.skillsList = document.getElementById('skills-list');
    this.elements.spellsList = document.getElementById('spells-list');
   
  }
  
  setupTabs() {
    this.elements.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }
  
  switchTab(tabName) {
    // Снимаем активный класс со всех вкладок и контента
    this.elements.tabs.forEach(tab => tab.classList.remove('active'));
    this.elements.tabContents.forEach(content => content.classList.remove('active'));
    
    // Активируем выбранную вкладку
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`${tabName}-tab`);
    
    if (activeTab) activeTab.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
    
    // Обработка специфичного контента для каждой вкладки
    if (tabName === 'inventory' || tabName === 'equipment') {
      // Обновляем инвентарь/экипировку
      const invInfo = this.game.inventorySystem.getInventoryInfo();
      this.updateInventory(invInfo);
    }
    
    // НОВОЕ: Обновляем вкладку характеристик при переключении
    if (tabName === 'stats') {
      const stats = this.game.player.getStats();
      this.updateStatsTab(stats);
    }
    
    // НОВОЕ: Обновляем вкладку способностей при переключении
    if (tabName === 'abilities') {
      this.updateAbilitiesTab();
    }
  }
  
  updateAll() {
    this.updatePlayerStats(this.game.player.getStats());
    
    if (this.game.zoneManager && this.game.isInitialized) {
      const roomInfo = this.game.zoneManager.getCurrentRoomInfo();
      if (roomInfo) {
        this.updateRoomInfo(roomInfo);
        this.updateDirections();
        this.updateMinimap();
      }
    }
  }
  
  updatePlayerStats(stats) {
    if (!stats) return;
    
    this.elements.playerName.textContent = stats.name || "Герой";
    this.elements.playerHealth.textContent = `${stats.health}/${stats.maxHealth}`;
    this.elements.playerLevel.textContent = stats.level || 1;
    this.elements.playerExp.textContent = `${stats.exp}/${stats.expToNext || 50}`;
    this.elements.playerGold.textContent = stats.gold || 0;

    if (this.elements.playerAttack) {
      this.elements.playerAttack.textContent = stats.attack || 15;
    }
    if (this.elements.playerDefense) {
      this.elements.playerDefense.textContent = stats.defense || 5;
    }
    
    // Прогресс-бары
    const healthPercent = (stats.health / stats.maxHealth) * 100;
    this.elements.healthBar.style.width = `${healthPercent}%`;
    
    if (healthPercent < 30) {
      this.elements.healthBar.style.background = '#ff4444';
    } else if (healthPercent < 60) {
      this.elements.healthBar.style.background = '#ffaa44';
    } else {
      this.elements.healthBar.style.background = '#44ff44';
    }
    
    const expPercent = (stats.exp / (stats.expToNext || 50)) * 100;
    this.elements.expBar.style.width = `${expPercent}%`;
    
    if (this.elements.statsTitle) {
      const race = stats.race || "Человек";
      const name = stats.name || "Герой";
      const level = stats.level || 1;
      this.elements.statsTitle.innerHTML = `<i class="fas fa-chart-bar"></i> [${race}] ${name} (Ур. ${level})`;
    }
    
    if (this.elements.goldOnHand) {
      this.elements.goldOnHand.textContent = stats.gold || 0;
    }
    if (this.elements.goldInBank) {
      this.elements.goldInBank.textContent = stats.bankGold || 0;
    }
    if (this.elements.totalExp) {
      this.elements.totalExp.textContent = stats.totalExp || stats.exp || 0;
    }
    if (this.elements.expToNext) {
      this.elements.expToNext.textContent = stats.expToNext || 50;
    }
    
    this.updateStatsTab(stats);
  }

  updateStatsTab(stats) {
    const container = document.getElementById('stats-content');
    if (!container) return;
    
    let html = `
      <div class="stats-grid">
        <!-- БЛОК А: АТРИБУТЫ -->
        <div class="stats-block">
          <h3><i class="fas fa-dumbbell"></i> Атрибуты</h3>
          <div class="stat-row"><span class="stat-label">Сила:</span><span class="stat-value">${stats.strength || 10}</span></div>
          <div class="stat-row"><span class="stat-label">Ловкость:</span><span class="stat-value">${stats.agility || 10}</span></div>
          <div class="stat-row"><span class="stat-label">Телосложение:</span><span class="stat-value">${stats.constitution || 10}</span></div>
          <div class="stat-row"><span class="stat-label">Мудрость:</span><span class="stat-value">${stats.wisdom || 10}</span></div>
          <div class="stat-row"><span class="stat-label">Интеллект:</span><span class="stat-value">${stats.intelligence || 10}</span></div>
          <div class="stat-row"><span class="stat-label">Обаяние:</span><span class="stat-value">${stats.charisma || 10}</span></div>
        </div>
        
        <!-- БЛОК Б: БОЕВЫЕ -->
        <div class="stats-block">
          <h3><i class="fas fa-fist-raised"></i> Боевые</h3>
          <div class="stat-row"><span class="stat-label">Атака:</span><span class="stat-value">${stats.attack || 15}</span></div>
          <div class="stat-row"><span class="stat-label">Защита:</span><span class="stat-value">${stats.defense || 5}</span></div>
          <div class="stat-row"><span class="stat-label">Попадание:</span><span class="stat-value">${stats.hitChance || 75}%</span></div>
          <div class="stat-row"><span class="stat-label">Крит шанс:</span><span class="stat-value">${stats.critChance || 5}%</span></div>
          <div class="stat-row"><span class="stat-label">Сила крита:</span><span class="stat-value">${stats.critPower || 150}%</span></div>
          <div class="stat-row"><span class="stat-label">Уворот:</span><span class="stat-value">${stats.dodge || 0}%</span></div>
          <div class="stat-row"><span class="stat-label">Инициатива:</span><span class="stat-value">${stats.initiative || 10}</span></div>
          <div class="stat-row"><span class="stat-label">Блок (90% урона):</span><span class="stat-value">${stats.blockChance || 0}%</span></div>
        </div>
        
        <!-- БЛОК В: РЕСУРСЫ -->
        <div class="stats-block">
          <h3><i class="fas fa-heartbeat"></i> Ресурсы</h3>
          <div class="stat-row"><span class="stat-label">Здоровье:</span><span class="stat-value">${stats.health || 100}/${stats.maxHealth || 100}</span></div>
          <div class="stat-row"><span class="stat-label">Восст. здоровья:</span><span class="stat-value">+${stats.healthRegen || 0}/ход</span></div>
          <div class="stat-row"><span class="stat-label">Мана:</span><span class="stat-value">${stats.mana || 50}/${stats.maxMana || 50}</span></div>
          <div class="stat-row"><span class="stat-label">Восст. маны:</span><span class="stat-value">+${stats.manaRegen || 0}/ход</span></div>
          <div class="stat-row"><span class="stat-label">Выносливость:</span><span class="stat-value">${stats.stamina || 100}/${stats.maxStamina || 100}</span></div>
          <div class="stat-row"><span class="stat-label">Восст. вынос.:</span><span class="stat-value">+${stats.staminaRegen || 0}/ход</span></div>
        </div>
        
        <!-- БЛОК Г: СОПРОТИВЛЕНИЯ -->
        <div class="stats-block">
          <h3><i class="fas fa-shield-alt"></i> Сопротивления</h3>
          <div class="stat-row"><span class="stat-label">Огонь:</span><span class="stat-value">${stats.fireResistance || 0}%</span></div>
          <div class="stat-row"><span class="stat-label">Вода:</span><span class="stat-value">${stats.waterResistance || 0}%</span></div>
          <div class="stat-row"><span class="stat-label">Земля:</span><span class="stat-value">${stats.earthResistance || 0}%</span></div>
          <div class="stat-row"><span class="stat-label">Воздух:</span><span class="stat-value">${stats.airResistance || 0}%</span></div>
          <div class="stat-row"><span class="stat-label">Тьма:</span><span class="stat-value">${stats.darkResistance || 0}%</span></div>
          <div class="stat-row"><span class="stat-label">Яды:</span><span class="stat-value">${stats.poisonResistance || 0}%</span></div>
          <div class="stat-row"><span class="stat-label">Физ. приёмы:</span><span class="stat-value">${stats.physicalResistance || 0}%</span></div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  }
  
  updateAbilitiesTab() {
    // Получаем данные о способностях (заглушка - пока нет системы)
    const abilitiesData = {
      affects: [], // активные аффекты
      skills: [],  // изученные умения  
      spells: []   // известные заклинания
    };
    
    // Обновляем список аффектов
    if (this.elements.affectsList) {
      if (abilitiesData.affects.length > 0) {
        let html = '';
        abilitiesData.affects.forEach(affect => {
          html += `<div class="ability-item" data-id="${affect.id}">${affect.name}</div>`;
        });
        this.elements.affectsList.innerHTML = html;
      } else {
        this.elements.affectsList.innerHTML = '<div class="empty-message">Нет активных эффектов</div>';
      }
    }
    
    // Обновляем список умений
    if (this.elements.skillsList) {
      if (abilitiesData.skills.length > 0) {
        let html = '';
        abilitiesData.skills.forEach(skill => {
          html += `<div class="ability-item" data-id="${skill.id}">${skill.name}</div>`;
        });
        this.elements.skillsList.innerHTML = html;
      } else {
        this.elements.skillsList.innerHTML = '<div class="empty-message">Умения не изучены</div>';
      }
    }
    
    // Обновляем список заклинаний
    if (this.elements.spellsList) {
      if (abilitiesData.spells.length > 0) {
        let html = '';
        abilitiesData.spells.forEach(spell => {
          html += `<div class="ability-item" data-id="${spell.id}">${spell.name}</div>`;
        });
        this.elements.spellsList.innerHTML = html;
      } else {
        this.elements.spellsList.innerHTML = '<div class="empty-message">Заклинания неизвестны</div>';
      }
    }
  }

  updateStatElement(id, label, value) {
    let container = document.getElementById('stats-content');
    if (!container) return;
    
    let element = document.getElementById(`stat-${id}`);
    if (!element) {
      element = document.createElement('div');
      element.id = `stat-${id}`;
      element.className = 'stat-row';
      element.innerHTML = `
        <span class="stat-label">${label}:</span>
        <span class="stat-value" id="stat-value-${id}">${value}</span>
      `;
      container.appendChild(element);
    } else {
      const valueElement = document.getElementById(`stat-value-${id}`);
      if (valueElement) valueElement.textContent = value;
    }
  }
  
  updateRoomInfo(roomInfo) {
    if (!roomInfo) return;
  
    this.elements.roomName.textContent = roomInfo.name;
    
    if (this.elements.roomDescriptionBox && roomInfo.description) {
      this.elements.roomDescriptionBox.textContent = roomInfo.description;
    }
    
    if (roomInfo.isShop) {
      this.elements.shopBtn.style.display = 'flex';
    } else {
      this.elements.shopBtn.style.display = 'none';
    }
    
    if (roomInfo.directions && Object.keys(roomInfo.directions).length > 0) {
      const directionsText = this.formatDirections(roomInfo.directions);
      this.addToLog(`📍 Выходы: ${directionsText}`, 'directions');
    }
  }
  
  formatDirections(directions) {
    const directionNames = {
      'north': 'Север',
      'south': 'Юг', 
      'east': 'Восток',
      'west': 'Запад',
      'up': 'Вверх',
      'down': 'Вниз'
    };
    
    return Object.keys(directions)
      .map(dir => directionNames[dir] || dir)
      .join(', ');
  }
  
  updateDirections() {
    const directionButtons = [
      this.elements.northBtn,
      this.elements.southBtn,
      this.elements.eastBtn,
      this.elements.westBtn,
      this.elements.upBtn,
      this.elements.downBtn
    ];
    
    directionButtons.forEach(btn => {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    });
  }
  
  updateMinimap() {
    if (!this.elements.minimap || !this.game.zoneManager) return;
    
    const minimapManager = this.game.zoneManager.getMinimapManager();
    if (!minimapManager) {
      this.elements.minimap.innerHTML = '<div class="minimap-error">Миникарта не загружена</div>';
      return;
    }
    
    const minimapData = minimapManager.getMinimapData();
    if (!minimapData || !minimapData.grid) {
      this.elements.minimap.innerHTML = '<div class="minimap-error">Нет данных для миникарты</div>';
      return;
    }
    
    let html = `<div class="minimap-header">${minimapData.zoneName}</div>`;
    html += '<div class="minimap-grid">';
    
    for (let y = 0; y < minimapData.dimensions.height; y++) {
      for (let x = 0; x < minimapData.dimensions.width; x++) {
        const cell = minimapData.grid[y][x];
        const cellClasses = this.getMinimapCellClasses(cell);
        const cellContent = this.getMinimapCellContent(cell);
        
        html += `
          <div class="minimap-cell ${cellClasses}" 
               title="${cell.roomId ? cell.name : 'Неизвестно'}"
               data-x="${x}" data-y="${y}">
            ${cellContent}
          </div>
        `;
      }
    }
    
    html += '</div>';
    
    this.elements.minimap.innerHTML = html;
  }
  
  getMinimapCellClasses(cell) {
    const classes = ['minimap-cell'];
    
    if (cell.roomId) {
      if (cell.visited) {
        classes.push('visited');
      } else {
        classes.push('unvisited');
      }
      
      if (cell.isPlayer) {
        classes.push('player');
      }
      
      if (cell.directions) {
        if (!cell.directions.north) classes.push('no-north');
        if (!cell.directions.south) classes.push('no-south');
        if (!cell.directions.east) classes.push('no-east');
        if (!cell.directions.west) classes.push('no-west');
      }
      
      if (cell.special) {
        const special = cell.special.toLowerCase();
        
        if (special.includes('shop') || special.includes('market') || 
            special.includes('blacksmith') || special.includes('healer')) {
          classes.push('cell-shop');
        } else if (special.includes('forest') || special.includes('wood') || 
                  special.includes('grove') || special.includes('glade')) {
          classes.push('cell-forest');
        } else if (special.includes('road') || special.includes('path') || 
                  special.includes('bridge')) {
          classes.push('cell-road');
        } else if (special.includes('town') || special.includes('village') || 
                  special.includes('square') || special.includes('central')) {
          classes.push('cell-town');
        } else if (special.includes('water') || special.includes('river') || 
                  special.includes('swamp') || special.includes('marsh')) {
          classes.push('cell-water');
        } else if (special.includes('cave') || special.includes('dungeon') || 
                  special.includes('tunnel') || special.includes('underground')) {
          classes.push('cell-cave');
        } else if (special.includes('boss') || special.includes('throne') || 
                  special.includes('arena')) {
          classes.push('cell-boss');
        } else {
          classes.push('cell-default');
        }
      } else {
        classes.push('cell-default');
      }
    } else {
      classes.push('empty');
    }
    
    return classes.join(' ');
  }
  
  getMinimapCellContent(cell) {
    if (!cell.roomId) {
      return '';
    }
    
    if (cell.directions && (cell.directions.up || cell.directions.down)) {
      return '<i class="fas fa-stairs"></i>';
    }
    
    if (cell.isPlayer) {
      return '<i class="fas fa-user"></i>';
    }
    
    if (cell.visited) {
      if (cell.special) {
        const special = cell.special.toLowerCase();
        
        if (special.includes('shop') || special.includes('market')) {
          return '<i class="fas fa-coins"></i>'; // СТОПКА МОНЕТ для магазина
        } else if (special.includes('blacksmith')) {
          return '<i class="fas fa-hammer"></i>';
        } else if (special.includes('healer')) {
          return '<i class="fas fa-heart"></i>';
        } else if (special.includes('forest')) {
          return '<i class="fas fa-tree"></i>';
        } else if (special.includes('water')) {
          return '<i class="fas fa-water"></i>';
        } else if (special.includes('cave') || special.includes('dungeon')) {
          return '<i class="fas fa-mountain"></i>';
        } else if (special.includes('boss')) {
          return '<i class="fas fa-skull"></i>';
        } else if (special.includes('town') || special.includes('village')) {
          return '<i class="fas fa-home"></i>';
        }
      }
      return '<i class="fas fa-map-marker-alt"></i>';
    }
    
    return '<i class="fas fa-question"></i>';
  }
  
  addToLog(message, type = 'info') {
    if (!this.elements.logContent) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.textContent = `> ${message}`;
    
    this.elements.logContent.appendChild(logEntry);
    this.elements.logContent.scrollTop = this.elements.logContent.scrollHeight;
    
    const entries = this.elements.logContent.querySelectorAll('.log-entry');
    if (entries.length > 50) {
      entries[0].remove();
    }
  }
  
  updateBattleLog(messages) {
    if (!messages || !Array.isArray(messages)) return;
    
    messages.forEach(msg => {
      this.addToLog(msg, 'battle');
    });
  }
  
  showBattleUI(battleStart) {
    if (this.elements.battleUI) this.elements.battleUI.style.display = 'block';
    if (this.elements.exploreBtn) this.elements.exploreBtn.style.display = 'none';
    if (this.elements.searchEnemiesBtn) this.elements.searchEnemiesBtn.style.display = 'none';
    
    if (battleStart.enemy && this.elements.enemyName && this.elements.enemyHealth) {
      this.elements.enemyName.textContent = battleStart.enemy.name;
      this.elements.enemyHealth.textContent = `${battleStart.enemy.health}/${battleStart.enemy.maxHealth}`;
    }
    
    if (battleStart.log) {
      battleStart.log.forEach(msg => this.addToLog(msg, 'battle'));
    }
  }
  
  updateBattleStats(playerStats, enemyInfo) {
    this.updatePlayerStats(playerStats);
    
    if (enemyInfo && this.elements.enemyName && this.elements.enemyHealth) {
      this.elements.enemyName.textContent = enemyInfo.name;
      this.elements.enemyHealth.textContent = `${enemyInfo.health}/${enemyInfo.maxHealth}`;
    }
  }
  
  showVictoryScreen(result) {
    this.addToLog("=".repeat(40), 'victory');
    if (result.log) {
      result.log.forEach(msg => this.addToLog(msg, 'victory'));
    }
    this.addToLog("=".repeat(40), 'victory');
  }
  
  showExplorationUI() {
    if (this.elements.battleUI) this.elements.battleUI.style.display = 'none';
    if (this.elements.exploreBtn) this.elements.exploreBtn.style.display = 'flex';
    if (this.elements.searchEnemiesBtn) this.elements.searchEnemiesBtn.style.display = 'flex';
    this.updateAll();
  }
  
  updateInventory(inventoryInfo) {
    const content = this.elements.inventoryContent;
    if (!content) return;
    
    if (!inventoryInfo) {
      content.innerHTML = '<p>Инвентарь не загружен</p>';
      return;
    }
    
    content.innerHTML = '';
    
    if (!inventoryInfo.items || inventoryInfo.items.length === 0) {
      content.innerHTML = '<p>Инвентарь пуст</p>';
      return;
    }
    
    let html = '<div class="inventory-grid">';
    
    inventoryInfo.items.forEach((item, index) => {
      if (!item) return;
      
      const countText = item.count > 1 ? ` ×${item.count}` : '';
      const statsText = this.formatItemStats(item.stats || {});
      
      html += `
        <div class="inventory-item" data-index="${index}">
          <div class="item-header">
            <span class="item-name">${item.name}${countText}</span>
            <span class="item-type">${item.type || 'предмет'}</span>
          </div>
          <div class="item-stats">${statsText}</div>
          <div class="item-actions">
      `;
      
      if (item.type === 'consumable') {
        html += `<button class="btn-inv use-btn" data-index="${index}">Использовать</button>`;
      }
      
      if (item.slot && item.slot !== 'none') {
        html += `<button class="btn-inv equip-btn" data-index="${index}">Надеть</button>`;
      }
      
      html += `
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    content.innerHTML = html;
    
    if (inventoryInfo.equipment) {
      this.updateEquipment(inventoryInfo.equipment);
    }
  }
  
  updateEquipment(equipment) {
    const content = this.elements.equipmentContent;
    if (!content) return;
    
    let html = '<div class="equipment-grid">';
    
    const slots = {
      head: 'Голова',
      neck1: 'Шея (1)',
      neck2: 'Шея (2)',
      arms: 'Руки',
      hands: 'Кисти',
      ring1: 'Кольцо (1)',
      ring2: 'Кольцо (2)',
      body: 'Тело',
      belt: 'Пояс',
      legs: 'Ноги',
      feet: 'Стопы',
      right_hand: 'Правая рука',
      left_hand: 'Левая рука'
    };
    
    Object.entries(slots).forEach(([slot, name]) => {
      const item = equipment[slot];
      html += `
        <div class="equipment-slot" data-slot="${slot}">
          <div class="slot-name">${name}</div>
          <div class="slot-item">${item ? item.name : 'Пусто'}</div>
          ${item ? `<button class="btn-inv unequip-btn" data-slot="${slot}">Снять</button>` : ''}
        </div>
      `;
    });
    
    html += '</div>';
    content.innerHTML = html;
    
    this.bindInventoryEvents();
  }
  
  formatItemStats(stats) {
    if (!stats) return 'Нет бонусов';
    
    const parts = [];
    if (stats.health) parts.push(`Здоровье +${stats.health}`);
    if (stats.attack) parts.push(`Атака +${stats.attack}`);
    if (stats.defense) parts.push(`Защита +${stats.defense}`);
    
    return parts.length > 0 ? parts.join(', ') : 'Нет бонусов';
  }
  
  showShop(shopInfo) {
    if (!shopInfo) {
      this.addToLog("Информация о магазине не загружена", "error");
      return;
    }
    
    let shopHTML = `
      <div class="shop-modal" id="shop-modal">
        <div class="shop-header">
          <h2><i class="fas fa-store"></i> ${shopInfo.name}</h2>
          <p>${shopInfo.description}</p>
          <div class="shop-gold">Ваше золото: <span class="gold-text">${shopInfo.playerGold}</span> <i class="fas fa-coins"></i></div>
        </div>
        
        <div class="shop-tabs">

         <button class="shop-tab-btn active"data-tab="buy">
            <i class="fas fa-shopping-cart"></i> Купить
          </button>
          <button class="shop-tab-btn" data-tab="sell"> 
            <i class="fas fa-coins"></i> Продать
          </button>
        </div>
        <div class="shop-tab-content active" id="shop-buy-tab">
          <div class="shop-items">
            <h3>Товары магазина:</h3>
    `;

    if (!shopInfo.items || shopInfo.items.length == 0) {
      shopHTML += '<p>В магазине нет товаров</p>';
    } else {
      shopHTML += '<div class="shop-grid">';
      
      shopInfo.items.forEach((item) => {
        const canAfford = shopInfo.playerGold >= (item.price || 0);
        const statsText = this.formatItemStats(item.stats || {});
        
        shopHTML += `
          <div class="shop-item ${canAfford ? '' : 'cannot-afford'}" data-item-id="${item.id}">
            <div class="shop-item-header">
              <span class="item-name">${item.name}</span>
              <span class="item-price">${item.price || 0} <i class="fas fa-coins"></i></span>
            </div>
            <div class="item-type">${item.type || 'предмет'}</div>
            <div class="item-stats">${statsText}</div>
            <button class="btn-shop buy-btn" data-item-id="${item.id}" ${canAfford ? '' : 'disabled'}>
              ${canAfford ? 'Купить' : 'Недостаточно золота'}
            </button>
          </div>
        `;
      });
      
      shopHTML += '</div>';
    }

    shopHTML += `
          </div>
        </div>
        
        <div class="shop-tab-content" id="shop-sell-tab">
          <div class="sell-items">
            <h3>Ваши предметы для продажи:</h3>
            ${this.renderSellableItems()}
          </div>
        </div>
        
        <div class="shop-actions">
          <button class="btn btn-secondary" id="close-shop-btn">
            <i class="fas fa-times"></i> Закрыть
          </button>
        </div>
      </div>
    `;

    this.addToLog(`Вы зашли в ${shopInfo.name}`, 'info');

    const modalContainer = document.createElement('div');
    modalContainer.id = 'shop-modal-container';
    modalContainer.innerHTML = shopHTML;
    document.body.appendChild(modalContainer);

    this.bindShopEvents();
  }

  renderSellableItems() {
    const invInfo = this.game.inventorySystem.getInventoryInfo();

    if (!invInfo || !invInfo.items || invInfo.items.length == 0) {
      return '<p class="empty-inventory">В инвентаре нет предметов для продажи</p>';
    }

    let html = '<div class="sell-grid">';

    invInfo.items.forEach((item, index) => {
      if (!item) return;

      const sellPrice = Math.floor((item.price || 1) / 2);
      const countText = item.count > 1 ? `x${item.count}` : "";
      const statsText = this.formatItemStats(item.stats || {});

      html += `
        <div class="sell-item" data-item-index="${index}">
          <div class="sell-item-header">
            <span class="item-name">${item.name}${countText}</span>
            <span class="item-sell-price">${sellPrice} <i class="fas fa-coins"></i></span>
          </div>
          <div class="item-type">${item.type || 'предмет'}</div>
          <div class="item-stats">${statsText}</div>
          <button class="btn-sell" data-item-index="${index}">
            <i class="fas fa-coins"></i> Продать за ${sellPrice}
          </button>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  bindShopEvents() {
    const modal = document.getElementById('shop-modal-container');
    if (!modal) return;

    modal.addEventListener('click', (e) => {
      if (e.target.id === 'close-shop-btn' || e.target.closest('#close-shop-btn')) {
        modal.remove();
        return;
      }

      if (e.target.classList.contains('shop-tab-btn') || e.target.closest('.shop-tab-btn')) {
        const tabBtn = e.target.classList.contains('shop-tab-btn') ? e.target : e.target.closest('.shop-tab-btn');
        const tab = tabBtn.dataset.tab;

        modal.querySelectorAll('.shop-tab-btn').forEach(btn => btn.classList.remove('active'));
        modal.querySelectorAll('.shop-tab-content').forEach(content => content.classList.remove('active'));
        
        tabBtn.classList.add('active');
        const tabContent = modal.querySelector(`#shop-${tab}-tab`);
        if (tabContent) tabContent.classList.add('active');

        if (tab === 'sell') {
          const sellTab = modal.querySelector('#shop-sell-tab .sell-items');
          if (sellTab) {
            sellTab.innerHTML = `<h3>Ваши предметы для продажи:</h3>${this.renderSellableItems()}`;
          }
        }
        return;
      }

      if (e.target.classList.contains('buy-btn')) {
        const itemId = e.target.dataset.itemId;
        this.game.buyItemFromShop(itemId);

        const goldElement = modal.querySelector('.shop-gold .gold-text');
        if (goldElement) {
          goldElement.textContent = this.game.player.getStats().gold;
        }

        modal.querySelectorAll('.shop-item').forEach(itemEl => {
          const itemPrice = parseInt(itemEl.querySelector('.item-price').textContent) || 0;
          const canAfford = this.game.player.getStats().gold >= itemPrice;
          const button = itemEl.querySelector('.buy-btn');
          itemEl.classList.toggle('cannot-afford', !canAfford);
          button.disabled = !canAfford;
          button.textContent = canAfford ? 'Купить' : 'Недостаточно золота';
        });
        
        const sellTab = modal.querySelector('#shop-sell-tab .sell-items');
        if (sellTab) {
          sellTab.innerHTML = `<h3>Ваши предметы для продажи:</h3>${this.renderSellableItems()}`;
        }
        return;
      }

      if (e.target.classList.contains('btn-sell')) {
        const itemIndex = parseInt(e.target.dataset.itemIndex);
        if (!isNaN(itemIndex)) {
          this.game.sellItemToShop(itemIndex);
          
          const goldElement = modal.querySelector('.shop-gold .gold-text');
          if (goldElement) {
            goldElement.textContent = this.game.player.getStats().gold;
          }

          const sellTab = modal.querySelector('#shop-sell-tab .sell-items');
          if (sellTab) {
            sellTab.innerHTML = `<h3>Ваши предметы для продажи:</h3>${this.renderSellableItems()}`;
          }
          
          modal.querySelectorAll('.shop-item').forEach(itemEl => {
            const itemPrice = parseInt(itemEl.querySelector('.item-price').textContent) || 0;
            const canAfford = this.game.player.getStats().gold >= itemPrice;
            const button = itemEl.querySelector('.buy-btn');
            itemEl.classList.toggle('cannot-afford', !canAfford);
            button.disabled = !canAfford;
            button.textContent = canAfford ? 'Купить' : 'Недостаточно золота';
          });
        }
        return;
      }
    });

    const goldElement = modal.querySelector('.shop-gold .gold-text');
    if (goldElement) {
      goldElement.textContent = this.game.player.getStats().gold;
    }
  }

  showError(message) {
    this.addToLog(`ОШИБКА: ${message}`, 'error');
  }

  bindInventoryEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('use-btn')) {
        const index = parseInt(e.target.dataset.index);
        if (!isNaN(index)) {
          this.game.useInventoryItem(index);
        }
        return;
      }

      if (e.target.classList.contains('equip-btn')) {
        const index = parseInt(e.target.dataset.index);
        if (!isNaN(index)) {
          this.game.equipInventoryItem(index);
        }
        return;
      }

      if (e.target.closest('.unequip-btn')) {
        const btn = e.target.closest('.unequip-btn');
        const slot = btn.dataset.slot;
        console.log('Кнопка "Снять" нажата, слот:', slot);
        if (slot) {
          this.game.unequipItem(slot);
        }
        return;
      }
    });
  }
}

export { UIManager };

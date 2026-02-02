import { DataService } from './services/DataService.js';
import { GameState } from './core/GameState.js';
import { Player } from './core/Player.js';
import { EnemyService } from './services/EnemyService.js';
import { Item } from './core/Item.js';
import { EquipmentService } from './services/EquipmentService.js';
import { ZoneManager } from './system/ZoneManager.js';
import { BattleSystem } from './system/BattleSystem.js';
import { InventorySystem } from './system/InventorySystem.js';
import { ShopSystem } from './system/ShopSystem.js';
import { UIManager } from './ui/UIManager.js';
import { BattleService } from './services/BattleService.js';
import { GameManager } from './services/GameManager.js';
import { BeltSystem } from './system/BeltSystem.js';
import { SaveLoadService } from './services/SaveLoadService.js';

// Импорт всех UI компонентов
import { StatsUI } from './ui/components/StatsUI.js';
import { InventoryUI } from './ui/components/InventoryUI.js';
import { EquipmentUI } from './ui/components/EquipmentUI.js';
import { SkillsUI } from './ui/components/SkillsUI.js';
import { TimeUI } from './ui/components/TimeUI.js';
import { LogUI } from './ui/components/LogUI.js';
import { MinimapUI } from './ui/components/MinimapUI.js';
import { BattleUI } from './ui/components/BattleUI.js';
import { ShopUI } from './ui/components/ShopUI.js';
import { BeltUI } from './ui/components/BeltUI.js';

// Костыли для обратной совместимости (пока)
window.BattleSystem = BattleSystem;
window.Item = Item;

class Game {
  constructor() {
    this.gameState = new GameState();
    this.dataService = new DataService();
    this.enemyService = new EnemyService(this.dataService.enemiesData);
    this.player = new Player(this.gameState);
    this.zoneManager = new ZoneManager(this.gameState);
    this.battleSystem = new BattleSystem();
    // Создаем EquipmentService
    this.equipmentService = new EquipmentService(
        this.gameState.eventBus,
        this.gameState.statManager
    );
    this.inventorySystem = new InventorySystem(
        this.gameState, 
        this.equipmentService  // ← новый параметр
    );
    this.beltSystem = new BeltSystem(this.gameState, this.inventorySystem);
    this.shopSystem = new ShopSystem(this.gameState);
    this.saveLoadService = new SaveLoadService(this.gameState);
    
    // Собираем UI компоненты в объект
    const uiComponents = {
      StatsUI,
      InventoryUI,
      EquipmentUI,
      SkillsUI,
      TimeUI,
      LogUI,
      MinimapUI,
      BattleUI,
      ShopUI,
      BeltUI
    };
    
    // Передаем компоненты в UIManager
    this.uiManager = new UIManager(this, uiComponents);
    this.battleService = new BattleService(this);
    this.gameManager = new GameManager(this);
    
    this.isInitialized = false;
  }
  
  async init() {
      try {
          // 1. Загружаем данные игры
          await this.dataService.loadGameData();
          
          // 2. Инициализируем EnemyService ПОСЛЕ загрузки данных
          this.enemyService = new EnemyService(this.dataService.enemiesData);
          
          // 3. Запускаем системы
          this.gameState.getTimeSystem().start();
          this.gameState.updatePlayer({ gold: 50, potions: 2 });
          
          // 4. Начальные предметы
          this.inventorySystem.addItemById('health_potion', 3);
          this.inventorySystem.addItemById('rusty_sword', 1);
          this.inventorySystem.addItemById("leather_jacket", 1);
          
          // 5. Инициализируем зоны
          await this.zoneManager.init();
          
          // 6. UI
          this.uiManager.init();
          this.isInitialized = true;
          
          // 7. Имя игрока (только для новой игры)
          let playerName = "Герой";
          const hasExistingSave = this.saveLoadService.hasSave();
          
          if (!hasExistingSave) {
              const inputName = prompt("Введите имя вашего героя:", playerName);
              if (inputName && inputName.trim() !== "") {
                  playerName = inputName.trim();
              }
          } else {
              const saveInfo = this.saveLoadService.getSaveInfo();
              playerName = saveInfo?.playerName || "Герой";
          }
          
          // Устанавливаем имя
          this.gameState.updatePlayer({ name: playerName });
          
          // Приветствие
          this.uiManager.addToLog(`🏰 Добро пожаловать, ${playerName}! 🏰`);
          this.uiManager.addToLog("Нажмите 'Исследовать', чтобы начать.");
          
          // 8. Начинаем игру
          this.gameManager.explore();
          
      } catch (error) {
          console.error('Ошибка инициализации:', error);
          this.uiManager.showError("Не удалось загрузить игру");
      }
  }

  saveGame() {
    const result = this.saveLoadService.saveGame();
    if (result.success) {
      this.uiManager.addToLog("Игра сохранена", "success");
    } else {
      this.uiManager.addToLog(`Ошибка сохранения: ${result.error}`, "error");
    }
  }
  
  loadGame() {
    const result = this.saveLoadService.loadGame();
    if (result.success) {
      this.uiManager.addToLog("Игра загружена", "success");
      this.uiManager.updatePlayerStats(this.player.getStats());
      this.gameManager.explore();
    } else {
      this.uiManager.showError(`Ошибка загрузки: ${result.error}`);
    }
  }
}

let gameInstance;

window.addEventListener('DOMContentLoaded', () => {
  gameInstance = new Game();
  gameInstance.init();
  
  window.game = gameInstance;
  
  document.getElementById('save-btn').addEventListener('click', () => {
    gameInstance.saveGame();
  });
  
  document.getElementById('load-btn')?.addEventListener('click', () => {
    gameInstance.loadGame();
  });
});

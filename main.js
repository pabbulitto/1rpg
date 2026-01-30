import { DataService } from './services/DataService.js';
import { GameState } from './core/GameState.js';
import { Player } from './core/Player.js';
import { Enemy } from './core/Enemy.js';
import { Item } from './core/Item.js';
import { ZoneManager } from './system/ZoneManager.js';
import { BattleSystem } from './system/BattleSystem.js';
import { InventorySystem } from './system/InventorySystem.js';
import { ShopSystem } from './system/ShopSystem.js';
import { UIManager } from './ui/UIManager.js';
import { BattleService } from './services/BattleService.js';
import { GameManager } from './services/GameManager.js';
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

// Костыли для обратной совместимости (пока)
window.BattleSystem = BattleSystem;
window.Enemy = Enemy;
window.Item = Item;

class Game {
  constructor() {
    this.gameState = new GameState();
    this.dataService = new DataService();
    this.player = new Player(this.gameState);
    this.zoneManager = new ZoneManager(this.gameState);
    this.battleSystem = new BattleSystem();
    this.inventorySystem = new InventorySystem(this.gameState);
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
      ShopUI
    };
    
    // Передаем компоненты в UIManager
    this.uiManager = new UIManager(this, uiComponents);
    this.battleService = new BattleService(this);
    this.gameManager = new GameManager(this);
    
    this.isInitialized = false;
  }
  
  async init() {
      try {
          // === ВСЁ КАК БЫЛО В ИСХОДНОМ КОДЕ ===
          await this.dataService.loadGameData();
          
          this.gameState.getTimeSystem().start();
          
          this.gameState.updatePlayer({ gold: 50, potions: 2 });
          
          this.inventorySystem.addItemById('health_potion', 3);
          this.inventorySystem.addItemById('rusty_sword', 1);
          this.inventorySystem.addItemById("leather_jacket", 1);
          
          await this.zoneManager.init();
          
          this.uiManager.init();
          this.isInitialized = true;
          
          // === ДОБАВЛЯЕМ ТОЛЬКО ЭТО ===
          let playerName = "Герой";
          const hasExistingSave = this.saveLoadService.hasSave();
          
          if (!hasExistingSave) {
              // Только для новой игры
              const inputName = prompt("Введите имя вашего героя:", playerName);
              if (inputName && inputName.trim() !== "") {
                  playerName = inputName.trim();
              }
          } else {
              // Для загруженной игры
              const saveInfo = this.saveLoadService.getSaveInfo();
              playerName = saveInfo?.playerName || "Герой";
          }
          
          // Устанавливаем имя
          this.gameState.updatePlayer({ name: playerName });
          // === КОНЕЦ ДОБАВЛЕНИЯ ===
          
          // Обновляем приветствие с именем (было без имени)
          this.uiManager.addToLog(`🏰 Добро пожаловать, ${playerName}! 🏰`);
          this.uiManager.addToLog("Нажмите 'Исследовать', чтобы начать.");
          
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

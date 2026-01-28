import { Player } from './core/Player.js';
import { Enemy } from './core/Enemy.js';
import { ZoneManager } from './system/ZoneManager.js';
import { BattleSystem } from './system/BattleSystem.js';
import { InventorySystem } from './system/InventorySystem.js';
import { ShopSystem } from './system/ShopSystem.js';
import { UIManager } from './ui/UIManager.js';
import { GameState } from './core/GameState.js';
import { BattleService } from './services/BattleService.js';
import { DataService } from './services/DataService.js';
import { GameManager } from './services/GameManager.js';
import { SaveLoadService } from './services/SaveLoadService.js';
window.Enemy = Enemy;

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
    
    this.uiManager = new UIManager(this);
    this.battleService = new BattleService(this);
    this.gameManager = new GameManager(this);
    
    this.isInitialized = false;
  }
  
  async init() {
    try {
      await this.dataService.loadGameData();
      
      this.gameState.getTimeSystem().start();
      
      this.gameState.updatePlayer({ gold: 50, potions: 2 });
      
      this.inventorySystem.addItemById('health_potion', 3);
      this.inventorySystem.addItemById('rusty_sword', 1);
      this.inventorySystem.addItemById("leather_jacket", 1);
      
      await this.zoneManager.init();
      
      this.uiManager.init();
      this.isInitialized = true;
      
      this.uiManager.addToLog("🏰 Добро пожаловать в RPG! 🏰");
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


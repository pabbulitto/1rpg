import { Player } from './core/Player.js';
import { Enemy } from './core/Enemy.js';
import { ZoneManager } from './system/ZoneManager.js';
import { BattleSystem } from './system/BattleSystem.js';
import { InventorySystem } from './system/InventorySystem.js';
import { ShopSystem } from './system/ShopSystem.js';
import { UIManager } from './ui/UIManager.js';
import { GameState } from './core/GameState.js';

class Game {
  constructor() {
    this.gameState = new GameState();
    this.player = new Player(this.gameState);
    this.zoneManager = new ZoneManager(this.gameState);
    this.battleSystem = new BattleSystem();
    this.inventorySystem = new InventorySystem(this.gameState);
    this.shopSystem = new ShopSystem(this.gameState);
    this.uiManager = new UIManager(this);
    this.isActionInProgress = false;
    this.isInitialized = false;
  }
  
  async init() {
    try {
      await this.loadGameData();
      
      this.gameState.updatePlayer({ gold: 50, potions: 2 });
      
      this.inventorySystem.addItemById('health_potion', 3);
      this.inventorySystem.addItemById('rusty_sword', 1);
      this.inventorySystem.addItemById("leather_jacket", 1);
      
      await this.zoneManager.init();
      
      this.uiManager.init();
      this.isInitialized = true;
      
      this.uiManager.addToLog("🏰 Добро пожаловать в RPG! 🏰");
      this.uiManager.addToLog("Нажмите 'Исследовать', чтобы начать.");
      
      this.explore();
      
    } catch (error) {
      console.error('Ошибка инициализации:', error);
      this.uiManager.showError("Не удалось загрузить игру");
    }
  }
  
  async loadGameData() {
    const [enemiesData, itemsData, shopsData] = await Promise.all([
      fetch('./data/enemies.json').then(r => r.json()),
      fetch('./data/items.json').then(r => r.json()),
      fetch('./data/shops.json').then(r => r.json()), 
    ]);
    
    window.enemiesData = enemiesData;
    window.itemsData = itemsData;
    window.shopsData = shopsData;
    
    console.log('Данные игры загружены');
  }
  
  explore() {
    const battle = this.gameState.getBattleState();
    if (battle.inBattle) {
      this.uiManager.addToLog("Сначала закончите бой!", "warning");
      return;
    }
    
    const roomInfo = this.zoneManager.getCurrentRoomInfo();
    this.uiManager.updateRoomInfo(roomInfo);
    
    this.uiManager.addToLog(`📍 Вы в ${roomInfo.name}`);
  }
  
  async move(direction) {
    const battle = this.gameState.getBattleState();
    if (battle.inBattle) {
      this.uiManager.addToLog("Нельзя перемещаться во время боя!", "warning");
      return;
    }
    
    const result = await this.zoneManager.move(direction);
    
    if (result.success) {
      this.uiManager.addToLog(result.message);
      this.explore();
      
      const roomInfo = this.zoneManager.getCurrentRoomInfo();
      if (roomInfo.enemies && roomInfo.enemies.length > 0) {
        this.uiManager.addToLog("⚠️ В комнате могут быть враги", "warning");
      }
    } else {
      this.uiManager.addToLog(result.message, "error");
    }
  }
  
  searchForEnemies() {
    const enemyData = this.zoneManager.getRandomEnemyFromRoom();
    
    if (!enemyData) {
      this.uiManager.addToLog("В этой комнате нет врагов");
      return;
    }
    
    const enemy = Enemy.createEnemy(enemyData.type, enemyData.level);
    this.startBattle(enemy);
  }
  
  startBattle(enemy) {
    this.gameState.updateBattle(enemy, true);
    const battleStart = this.battleSystem.startBattle(this.player, enemy);
    this.uiManager.showBattleUI(battleStart);
  }
  
  playerAttack() {
    const battle = this.gameState.getBattleState();
    if (!battle.inBattle || !battle.currentEnemy) return;
    
    const result = this.battleSystem.playerAttack(
      this.player, 
      battle.currentEnemy, 
      this.gameState.getStatManager() 
    );
    this.uiManager.updateBattleLog(result.log);
    
    if (result.enemyDead) {
      this.endBattleVictory();
    } else if (result.playerDead) {
      this.endBattleDefeat();
    } else {
      this.uiManager.updateBattleStats(
        this.player.getStats(),
        battle.currentEnemy.getInfo()
      );
    }
  }
  
  endBattleVictory() {
    const battle = this.gameState.getBattleState();
    const result = this.battleSystem.endBattleVictory(
      this.player,
      battle.currentEnemy,
      this.inventorySystem
    );
    this.gameState.addGold(result.gold);
    this.uiManager.updateBattleLog(result.log);
    this.uiManager.showVictoryScreen(result);
    
    setTimeout(() => {
      this.gameState.updateBattle(null, false);
      this.uiManager.showExplorationUI();
      this.uiManager.updatePlayerStats(this.player.getStats());
    }, 2000);
  }
  
  endBattleDefeat() {
    this.uiManager.addToLog("💀 Вы погибли...", "error");
    
    setTimeout(() => {
      alert("Игра окончена! Начните заново.");
      location.reload();
    }, 1500);
  }
  
  useDefenseAction() {
    const battle = this.gameState.getBattleState();
    if (!battle.inBattle || !battle.currentEnemy) {
      this.uiManager.addToLog("Не в бою!", "warning");
      return;
    }
  
    const playerStats = this.player.getStats();
    const defenseBonus = Math.floor(playerStats.defense * 0.2); 
    
    this.gameState.getStatManager().addModifier('temp_defense_buff', {
      defense: defenseBonus
    });
    
    this.uiManager.updatePlayerStats(this.player.getStats());
 
    const enemyDamage = battle.currentEnemy.attackPlayer(playerStats);
    const playerResult = this.player.takeDamage(enemyDamage);
    
    this.uiManager.updateBattleLog([
      `${battle.currentEnemy.name} атакует!`,
      `Вы получили ${enemyDamage} урона`
    ]);
   
    this.gameState.getStatManager().removeModifier('temp_defense_buff');
    
    if (playerResult.isDead) {
      this.endBattleDefeat();
    }
  }  
  
  tryEscape() {
    const battle = this.gameState.getBattleState();
    if (!battle.inBattle || !battle.currentEnemy) return;
    
    const result = this.battleSystem.tryEscape(this.player, battle.currentEnemy);
    this.uiManager.updateBattleLog(result.log);
    
    if (result.success) {
      this.gameState.updateBattle(null, false);
      this.uiManager.showExplorationUI();
    } else if (result.playerDead) {
      this.endBattleDefeat();
    }
  }
  
  rest() {
    const battle = this.gameState.getBattleState();
    if (battle.inBattle) {
      this.uiManager.addToLog("Нельзя отдыхать во время боя!", "warning");
      return;
    }
    
    const player = this.gameState.getPlayer();
    const oldHealth = player.health;
    const healed = player.maxHealth - oldHealth;
    
    this.gameState.updatePlayerHealth(player.maxHealth);
    
    if (healed > 0) {
      this.uiManager.addToLog(`Вы отдохнули и восстановили ${healed} здоровья`, "success");
      this.uiManager.updatePlayerStats(this.player.getStats());
    } else {
      this.uiManager.addToLog("У вас и так полное здоровье");
    }
  }
  
  buyItemFromShop(itemId) {
    const result = this.shopSystem.buyItem(itemId, this.player, this.inventorySystem);
    if (result.success) {
      this.uiManager.addToLog(result.message, 'success');
      this.uiManager.updatePlayerStats(this.player.getStats());
      
      const invInfo = this.inventorySystem.getInventoryInfo();
      this.uiManager.updateInventory(invInfo);
    } else {
      this.uiManager.addToLog(result.message, 'error');
    }
  }

  sellItemToShop(itemIndex) {
    const result = this.shopSystem.sellItem(itemIndex, this.player, this.inventorySystem);
    if (result.success) {
      this.uiManager.addToLog(result.message, 'success');
      this.uiManager.updatePlayerStats(this.player.getStats());
      
      const invInfo = this.inventorySystem.getInventoryInfo();
      this.uiManager.updateInventory(invInfo);
    } else {
      this.uiManager.addToLog(result.message, 'error');
    }
  }
  
  openShop() {
    const isShop = this.zoneManager.isCurrentRoomShop();
    if (!isShop) {
      this.uiManager.addToLog("Вы не в магазине!", "warning");
      return;
    }
    
    const position = this.gameState.getPosition();
    const shopId = `${position.zone}:${position.room}`;
    
    const loaded = this.shopSystem.loadShop(shopId);
    if (!loaded) {
      this.uiManager.addToLog("Магазин не работает", "error");
      return;
    }
    
    this.uiManager.showShop(this.shopSystem.getShopInfo());
  }
    
  equipInventoryItem(index) {
    if (this.isActionInProgress) {
      console.log('Действие уже выполняется, пропускаем...');
      return;
    }
    
    this.isActionInProgress = true;
    console.log('=== equipInventoryItem called ===', index, Date.now());
    
    const result = this.inventorySystem.equipItem(index, this.player);
    console.log('Result:', result);
    
    if (result.success) {
      this.uiManager.addToLog(result.message, 'success');
      this.uiManager.updatePlayerStats(this.player.getStats());
    }
    
    const invInfo = this.inventorySystem.getInventoryInfo();
    this.uiManager.updateInventory(invInfo);
    
    setTimeout(() => {
      this.isActionInProgress = false;
    }, 200);
  }

  unequipItem(slot) {
    const result = this.inventorySystem.unequipItem(slot, this.player);

    if (result.isEmpty) {
      return;
    }
    
    if (result.success) {
      this.uiManager.addToLog(result.message, 'success');
      this.uiManager.updatePlayerStats(this.player.getStats());
    } else {
      this.uiManager.addToLog(result.message, 'error');
    }
    
    const invInfo = this.inventorySystem.getInventoryInfo();
    this.uiManager.updateInventory(invInfo);
  }
  useInventoryItem(index) {
    const result = this.inventorySystem.useItem(index, this.player);
    if (result.success) {
      this.uiManager.addToLog(result.message, 'success');
      this.uiManager.updatePlayerStats(this.player.getStats());
    } else {
      this.uiManager.addToLog(result.message, 'error');
    }
    
    const invInfo = this.inventorySystem.getInventoryInfo();
    this.uiManager.updateInventory(invInfo);
  }
  
  saveGame() {
    const saveData = {
      gameState: this.gameState.toJSON(),
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('rpg_save', JSON.stringify(saveData));
    this.uiManager.addToLog("Игра сохранена", "success");
  }
  
  loadGame() {
    const saveData = localStorage.getItem('rpg_save');
    if (!saveData) return;
    
    try {
      const data = JSON.parse(saveData);
      this.gameState.fromJSON(data.gameState);
      
      this.uiManager.addToLog("Игра загружена", "success");
      this.uiManager.updatePlayerStats(this.player.getStats());
      
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      this.uiManager.showError("Ошибка загрузки сохранения");
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

});

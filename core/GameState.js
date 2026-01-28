/**
 * GameState - единый источник данных для всей игры
 * Хранит ВСЁ состояние игры, не содержит игровой логики
 */
import { StatManager } from './StatManager.js';

class GameState {
  constructor() {
    // Игрок
    this.player = {
      name: "Герой",
      level: 1,
      exp: 0,
      expToNext: 50,
      gold: 50,
      potions: 2,
      
      // Экипировка
      equipment: {
        head: null,
        neck1: null,
        neck2: null,
        arms: null,
        hands: null,
        ring1: null,
        ring2: null,
        body: null,
        belt: null,
        legs: null,
        feet: null,
        right_hand: null,
        left_hand: null
      }
    };
    // Инициализируем StatManager с базовыми характеристиками
    this.statManager = new StatManager({
      health: 100,
      maxHealth: 100,
      attack: 15,
      defense: 5
    });
    // Синхронизируем здоровье игрока
    this.player.health = this.statManager.getFinalStats().health;
    // Позиция в мире
    this.position = {
      zone: 'village',
      room: 'village_square',
      visitedRooms: new Set(['village:village_square'])
    };
    // Инвентарь
    this.inventory = {
      items: [],
      capacity: 30
    };
    // Бой
    this.battle = {
      inBattle: false,
      currentEnemy: null,
      battleLog: []
    };
    // Магазин
    this.shop = {
      currentShop: null,
      shopItems: []
    };
    // Прогресс игры
    this.progress = {
      gameTime: 0,
      kills: 0,
      goldEarned: 0,
      goldSpent: 0
    };
  }
  // === Геттеры для удобства ===
  getPlayer() {
    const finalStats = this.statManager.getFinalStats();
    
    if (this.player.health > finalStats.maxHealth) {
      this.player.health = finalStats.maxHealth;
    }
    
    return {
      ...this.player,
      health: this.player.health,
      maxHealth: finalStats.maxHealth,
      attack: finalStats.attack,
      defense: finalStats.defense
    };
  }
  
  getPosition() {
    return { ...this.position };
  }
  
  getBattleState() {
    return { ...this.battle };
  }
  
  getInventory() {
    return { 
      items: [...this.inventory.items],
      equipment: { ...this.player.equipment },
      capacity: this.inventory.capacity
    };
  }
  
  getInventoryItems() {
    return [...this.inventory.items];
  }
  
  getEquipment() {
    return { ...this.player.equipment };
  }
  
  getShopState() {
    return { ...this.shop };
  }

  getStatManager() {
    return this.statManager;
  }
  // === Методы обновления состояния ===
  updatePlayer(updates) {
    this.player = { ...this.player, ...updates };
  }
  
  updatePlayerHealth(health) {
    const finalStats = this.statManager.getFinalStats();
    const newHealth = Math.max(0, Math.min(health, finalStats.maxHealth));
    this.player.health = newHealth;
  }
  
  updatePosition(zone, room) {
    this.position.zone = zone;
    this.position.room = room;
    this.position.visitedRooms.add(`${zone}:${room}`);
  }
  
  updateBattle(enemy = null, inBattle = false) {
    this.battle.currentEnemy = enemy;
    this.battle.inBattle = inBattle;
    if (!inBattle) {
      this.battle.battleLog = [];
    }
  }
  
  addBattleLog(message) {
    this.battle.battleLog.push(message);
    if (this.battle.battleLog.length > 50) {
      this.battle.battleLog.shift();
    }
  }
  
  addInventoryItem(item) {
    this.inventory.items.push(item);
  }

  removeInventoryItem(index) {
    if (index >= 0 && index < this.inventory.items.length) {
      const removedItem = this.inventory.items[index];
      this.inventory.items.splice(index, 1);
      return removedItem;
    }
    return null;
  }
  
  updateEquipment(slot, item) {
    this.player.equipment[slot] = item;
  }
  
  updateShop(shopData, items) {
    this.shop.currentShop = shopData;
    this.shop.shopItems = items || [];
  }
  
  addGold(amount) {
    this.player.gold += amount;
    if (amount > 0) {
      this.progress.goldEarned += amount;
    }
  }
  
  spendGold(amount) {
    if (this.player.gold >= amount) {
      this.player.gold -= amount;
      this.progress.goldSpent += amount;
      return true;
    }
    return false;
  }
  
  addExp(amount) {
    this.player.exp += amount;
    let levelsGained = 0;
    
    while (this.player.exp >= this.player.expToNext) {
      this.player.exp -= this.player.expToNext;
      this.player.level++;
      this.player.expToNext = Math.floor(this.player.expToNext * 1.5);
      levelsGained++;
      // Увеличиваем базовые характеристики при уровне
      const baseStats = this.statManager.getBaseStats();
      const newBaseStats = {
        ...baseStats,
        maxHealth: baseStats.maxHealth + 20,
        health: (baseStats.health || 0) + 20,
        attack: baseStats.attack + 5,
        defense: baseStats.defense + 2
      };
      
      this.statManager.setBaseStats(newBaseStats);
    }
    
    return levelsGained;
  }
  // === Сериализация ===
  toJSON() {
    return {
      player: this.player,
      position: {
        ...this.position,
        visitedRooms: Array.from(this.position.visitedRooms)
      },
      inventory: this.inventory,
      battle: this.battle,
      shop: this.shop,
      progress: this.progress,
      statManager: {
        baseStats: this.statManager.getBaseStats(),
        modifiers: this.statManager.getModifiers()
      }
    };
  }
  
  fromJSON(data) {
    this.player = data.player;
    this.position = {
      ...data.position,
      visitedRooms: new Set(data.position.visitedRooms)
    };
    this.inventory = data.inventory;
    this.battle = data.battle;
    this.shop = data.shop;
    this.progress = data.progress;
    // Восстанавливаем StatManager
    if (data.statManager) {
      this.statManager = new StatManager(data.statManager.baseStats);
      // Восстанавливаем модификаторы
      data.statManager.modifiers.forEach(mod => {
        this.statManager.addModifier(mod.source, mod.stats);
      });
    } else {
      // Совместимость со старыми сохранениями
      this.statManager = new StatManager({
        health: this.player.health || 100,
        maxHealth: this.player.maxHealth || 100,
        attack: this.player.attack || 15,
        defense: this.player.defense || 5
      });
    }
  }
  // === Статические методы ===
  static createDefault() {
    return new GameState();
  }
}

export { GameState };

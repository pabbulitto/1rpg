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
      // Старые характеристики для обратной совместимости
      health: 100,
      maxHealth: 100,
      attack: 15,
      defense: 5,
      
      // БЛОК А: АТРИБУТЫ (базовые значения)
      strength: 10,      // Сила
      agility: 10,       // Ловкость
      constitution: 10,  // Телосложение
      wisdom: 10,        // Мудрость
      intelligence: 10,  // Интеллект
      charisma: 10,      // Обаяние
      
      // БЛОК В: РЕСУРСЫ (мана и выносливость)
      mana: 50,
      maxMana: 50,
      stamina: 100,
      maxStamina: 100,
      
      // БЛОК Г: СОПРОТИВЛЕНИЯ (базовые 0)
      fireResistance: 0,
      waterResistance: 0,
      earthResistance: 0,
      airResistance: 0,
      darkResistance: 0,
      poisonResistance: 0,
      physicalResistance: 0
    });
    
    // Синхронизируем здоровье игрока с StatManager
    const stats = this.statManager.getFinalStats();
    this.player.health = stats.health;
    this.player.maxHealth = stats.maxHealth;
    
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
    
    // НОВОЕ: Состояния (аффекты)
    this.conditions = {
      hungry: false,      // Голод
      thirsty: false,     // Жажда
      poisoned: false,    // Отравлен
      blessed: false,     // Благословлён
      cursed: false       // Проклят
    };
  }
  
  // === Геттеры для удобства ===
  getPlayer() {
    const finalStats = this.statManager.getFinalStats();
    
    // Синхронизируем здоровье
    if (this.player.health > finalStats.maxHealth) {
      this.player.health = finalStats.maxHealth;
    }
    
    // Возвращаем объект со всеми характеристиками
    return {
      ...this.player,
      health: this.player.health,
      maxHealth: finalStats.maxHealth,
      attack: finalStats.attack,
      defense: finalStats.defense,
      
      // НОВОЕ: Добавляем остальные характеристики
      mana: finalStats.mana,
      maxMana: finalStats.maxMana,
      stamina: finalStats.stamina,
      maxStamina: finalStats.maxStamina,
      
      // Атрибуты
      strength: finalStats.strength,
      agility: finalStats.agility,
      constitution: finalStats.constitution,
      wisdom: finalStats.wisdom,
      intelligence: finalStats.intelligence,
      charisma: finalStats.charisma,
      
      // Боевые
      initiative: finalStats.initiative,
      hitChance: finalStats.hitChance,
      critChance: finalStats.critChance,
      critPower: finalStats.critPower,
      dodge: finalStats.dodge,
      blockChance: finalStats.blockChance,
      
      // Восстановление
      healthRegen: finalStats.healthRegen,
      manaRegen: finalStats.manaRegen,
      staminaRegen: finalStats.staminaRegen
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
  
  // НОВОЕ: Геттер для условий (аффектов)
  getConditions() {
    return { ...this.conditions };
  }
  
  // НОВОЕ: Геттер для всех характеристик (для UI)
  getAllStats() {
    return this.statManager.getStatsForUI();
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
  
  // НОВОЕ: Обновление маны
  updatePlayerMana(mana) {
    const finalStats = this.statManager.getFinalStats();
    const newMana = Math.max(0, Math.min(mana, finalStats.maxMana));
    
    // Обновляем через statManager
    const currentStats = this.statManager.getFinalStats();
    const manaDifference = newMana - currentStats.mana;
    
    if (manaDifference !== 0) {
      this.statManager.addModifier('temp_mana_adjustment', { mana: manaDifference });
    }
  }
  
  // НОВОЕ: Обновление выносливости
  updatePlayerStamina(stamina) {
    const finalStats = this.statManager.getFinalStats();
    const newStamina = Math.max(0, Math.min(stamina, finalStats.maxStamina));
    
    const currentStats = this.statManager.getFinalStats();
    const staminaDifference = newStamina - currentStats.stamina;
    
    if (staminaDifference !== 0) {
      this.statManager.addModifier('temp_stamina_adjustment', { stamina: staminaDifference });
    }
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
        defense: baseStats.defense + 2,
        
        // НОВОЕ: Увеличиваем атрибуты при уровне
        strength: baseStats.strength + 1,
        agility: baseStats.agility + 1,
        constitution: baseStats.constitution + 1,
        wisdom: baseStats.wisdom + 1,
        intelligence: baseStats.intelligence + 1,
        charisma: baseStats.charisma + 1,
        
        // Увеличиваем ресурсы
        maxMana: baseStats.maxMana + 10,
        maxStamina: baseStats.maxStamina + 15
      };
      
      this.statManager.setBaseStats(newBaseStats);
    }
    
    return levelsGained;
  }
  
  // НОВОЕ: Установить условие (аффект)
  setCondition(condition, value) {
    if (this.conditions.hasOwnProperty(condition)) {
      this.conditions[condition] = value;
      
      // Применяем эффекты условий
      this.applyConditionEffects();
    }
  }
  
  // НОВОЕ: Применить эффекты условий
  applyConditionEffects() {
    let modifiers = {};
    
    // Голод: -50% к восстановлению ресурсов
    if (this.conditions.hungry) {
      modifiers.healthRegen = -0.5;
      modifiers.manaRegen = -0.5;
      modifiers.staminaRegen = -0.5;
    }
    
    // Жажда: -50% к восстановлению ресурсов
    if (this.conditions.thirsty) {
      modifiers.healthRegen = (modifiers.healthRegen || 1) * 0.5;
      modifiers.manaRegen = (modifiers.manaRegen || 1) * 0.5;
      modifiers.staminaRegen = (modifiers.staminaRegen || 1) * 0.5;
    }
    
    // Отравление: -10% к характеристикам
    if (this.conditions.poisoned) {
      modifiers.strength = -0.1;
      modifiers.agility = -0.1;
      modifiers.constitution = -0.1;
    }
    
    // Применяем модификаторы условий
    this.statManager.removeModifier('conditions_effects');
    if (Object.keys(modifiers).length > 0) {
      this.statManager.addModifier('conditions_effects', modifiers);
    }
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
      conditions: this.conditions, // НОВОЕ
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
    
    // НОВОЕ: Восстанавливаем условия
    this.conditions = data.conditions || {
      hungry: false,
      thirsty: false,
      poisoned: false,
      blessed: false,
      cursed: false
    };
    
    // Восстанавливаем StatManager
    if (data.statManager) {
      this.statManager = new StatManager(data.statManager.baseStats);
      
      // Восстанавливаем модификаторы
      data.statManager.modifiers.forEach(mod => {
        this.statManager.addModifier(mod.source, mod.stats);
      });
      
      // Применяем эффекты условий
      this.applyConditionEffects();
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

// core/GameState.js
import { StatManager } from './StatManager.js';
import { TimeSystem } from '../system/TimeSystem.js';
import { EventBus } from './EventBus.js';
import { EntityContainer } from './EntityContainer.js';
import { itemFactory } from './ItemFactory.js';

class GameState {
  constructor() {
    this.eventBus = new EventBus();
    window.EventBus = this.eventBus;
    
    // === ИГРОК (старые поля - пока оставляем для совместимости) ===
    this.player = {
      name: "Герой",
      level: 1,
      exp: 0,
      expToNext: 100,
      potions: 2,
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
      },
      activeEffects: []
    };
    
    // === НОВОЕ: КОНТЕЙНЕР ИГРОКА ===
    /** @type {EntityContainer} */
    this.playerContainer = new EntityContainer({
      equipment: { ...this.player.equipment } // копируем начальную экипировку
    });
    
    this.statManager = new StatManager({
      strength: 17,
      dexterity: 19,
      constitution: 14,
      intelligence: 14,
      wisdom: 12,
      charisma: 12,
      health: 20,
      mana: 28,
      stamina: 40,
      attack: 0,
      defense: 0,
      armorClass: 0
    });
    
    // === ПОЗИЦИЯ И ИССЛЕДОВАНИЕ ===
    this.position = {
      zone: 'village',
      room: 'village_square',
      visitedRooms: new Set(['village:village_square'])
    };
    
    // === ИНВЕНТАРЬ (старый - пока оставляем для совместимости) ===
    this.inventory = {
      items: [],  // Здесь будут предметы, но мы будем их дублировать в playerContainer
      capacity: 30
    };
    
    // === БОЙ ===
    this.battle = {
      inBattle: false,
      currentEnemyId: null,
      enemyData: null,
      battleLog: []
    };
    
    // === МАГАЗИН ===
    this.shop = {
      currentShop: null,
      shopItems: []
    };
    
    // === ПРОГРЕСС ===
    this.progress = {
      gameTime: 0,
      kills: 0,
      goldEarned: 0,
      goldSpent: 0
    };
    
    // === СОСТОЯНИЯ ===
    this.conditions = {
      hungry: false,
      thirsty: false,
      poisoned: false,
      blessed: false,
      cursed: false
    };
    
    // === СИСТЕМА ВРЕМЕНИ ===
    this.timeSystem = new TimeSystem(this);
    this.setupTimeListeners();

    this.itemsData = null;
    
    // Синхронизируем старый инвентарь с новым контейнером
    this._syncInventoryFromContainer();
  }
  
  // === НОВЫЙ МЕТОД: синхронизация старого инвентаря с контейнером ===
  _syncInventoryFromContainer() {
      // Просто передаём ссылки на предметы из контейнера
      this.inventory.items = this.playerContainer.getAllItems();
      
      console.log(`📊 Синхронизация завершена: всего предметов ${this.inventory.items.length}`);
  }
    
  // === НОВЫЙ МЕТОД: синхронизация контейнера со старым инвентарем ===
  _syncContainerFromInventory() {
    // Очищаем контейнер
    this.playerContainer.items = [];
    
    // Копируем все предметы из старого инвентаря в контейнер
    this.inventory.items.forEach(item => {
      this.playerContainer.addItem(item);
    });
    
    // Копируем экипировку
    Object.entries(this.player.equipment).forEach(([slot, item]) => {
      if (item) {
        this.playerContainer.equipment[slot] = item;
      }
    });
  }
   
  setItemsData(itemsData) {
    this.itemsData = itemsData;
  }

  getEventBus() {
    return this.eventBus;
  }

  setupTimeListeners() {
    const timeSystem = this.timeSystem;
    
    timeSystem.registerCondition(() => {
      this.updateConditionsOverTime();
    });
    
    timeSystem.registerCustom('gameState', (tick, gameTime) => {
      this.progress.gameTime = tick;
    });
    
    timeSystem.registerCustom('resource_regeneration', (tick, gameTime) => {
      this.regenerateResources();
    });
  }
  
  updateConditionsOverTime() {
    const gameTime = this.timeSystem.getGameTime();
    
    if (gameTime.hour % 4 === 0 && gameTime.minute === 0) {
      if (!this.conditions.hungry) this.conditions.hungry = true;
      if (!this.conditions.thirsty) this.conditions.thirsty = true;
      this.applyConditionEffects();
    }
  }

  regenerateResources() {
    const stats = this.statManager.getFinalStats();
    
    if (stats.healthRegen > 0) {
      const currentHealth = this.statManager.getResource('health');
      if (currentHealth > 0 && currentHealth < stats.maxHealth) {
        const newHealth = Math.min(currentHealth + stats.healthRegen, stats.maxHealth);
        this.statManager.setResource('health', newHealth);
        this.eventBus.emit('player:statsChanged', this.getPlayer());
      }
    }
    
    if (stats.manaRegen > 0) {
      const currentMana = this.statManager.getResource('mana');
      if (currentMana < stats.maxMana) {
        const newMana = Math.min(currentMana + stats.manaRegen, stats.maxMana);
        this.statManager.setResource('mana', newMana);
        this.eventBus.emit('player:statsChanged', this.getPlayer());
      }
    }
    
    if (stats.staminaRegen > 0) {
      const currentStamina = this.statManager.getResource('stamina');
      if (currentStamina < stats.maxStamina) {
        const newStamina = Math.min(currentStamina + stats.staminaRegen, stats.maxStamina);
        this.statManager.setResource('stamina', newStamina);
        this.eventBus.emit('player:statsChanged', this.getPlayer());
      }
    }
  }    
  
  removeEffect(effectId) {
    const index = this.player.activeEffects.findIndex(e => e.id === effectId);
    if (index >= 0) {
      const effect = this.player.activeEffects[index];
      
      if (effect.remove) {
        effect.remove(this);
      }
      
      this.player.activeEffects.splice(index, 1);
      return true;
    }
    return false;
  }
  
  getActiveEffects() {
    return [...this.player.activeEffects];
  }
  
  hasEffect(effectId) {
    return this.player.activeEffects.some(e => e.id === effectId);
  }
  
  getTimeSystem() {
    return this.timeSystem;
  }
  
  getPlayer() {
    // 1. Базовые вычисления
    const finalStats = this.statManager.getFinalStats();
    const resources = {
      health: this.statManager.getResource('health'),
      mana: this.statManager.getResource('mana'),
      stamina: this.statManager.getResource('stamina')
    };
    
    // 2. Получаем данные из контейнера
    const containerInfo = this.playerContainer.getInfo();
    
    // 3. Синхронизируем старые поля для обратной совместимости
    this.player.equipment = containerInfo.equipment;
    this.inventory.items = containerInfo.items;
    
    // 4. Создаем плоский объект для UI
    const playerData = {
      // === БАЗОВАЯ ИНФОРМАЦИЯ ===
      name: this.player.name || "Герой",
      level: window.game?.player?.level || this.player.level || 1,
      exp: this.player.exp || 0,
      expToNext: this.player.getExpForNextLevel ? this.player.getExpForNextLevel() : 100,
      gold: this.player.gold || 0,
      
      // === РЕСУРСЫ ===
      health: resources.health,
      maxHealth: finalStats.maxHealth,
      mana: resources.mana,
      maxMana: finalStats.maxMana,
      stamina: resources.stamina,
      maxStamina: finalStats.maxStamina,
      
      // === ОСНОВНЫЕ ХАРАКТЕРИСТИКИ ===
      strength: finalStats.strength,
      dexterity: finalStats.dexterity,
      constitution: finalStats.constitution,
      intelligence: finalStats.intelligence,
      wisdom: finalStats.wisdom,
      charisma: finalStats.charisma,
      
      // === МОДИФИКАТОРЫ ===
      strengthMod: finalStats.strengthMod,
      dexterityMod: finalStats.dexterityMod,
      constitutionMod: finalStats.constitutionMod,
      intelligenceMod: finalStats.intelligenceMod,
      wisdomMod: finalStats.wisdomMod,
      charismaMod: finalStats.charismaMod,
      
      // === АТАКА ===
      attack: finalStats.hitroll || 0,  
      hitroll: finalStats.hitroll || 0, 
      damroll: finalStats.damroll || 0,
      
      // === ЗАЩИТА ===
      armorClass: finalStats.armorClass,
      magicArmorClass: finalStats.magicArmorClass,
      armorValue: finalStats.armorValue || 0,
      damageReduction: finalStats.damageReduction || 0,
      
      // === РЕГЕНЕРАЦИЯ ===
      healthRegen: finalStats.healthRegen || 0,
      manaRegen: finalStats.manaRegen || 0,
      staminaRegen: finalStats.staminaRegen || 0,
      
      // === СПЕЦИАЛЬНЫЕ ===
      initiative: finalStats.initiative,
      spellPower: finalStats.spellPower,
      luckBonus: finalStats.luckBonus || 0,
      carryCapacity: finalStats.carryCapacity || 0,
      
      // === СОПРОТИВЛЕНИЯ ===
      poisonResistance: finalStats.poisonResistance || 0,
      diseaseResistance: finalStats.diseaseResistance || 0,
      spellResistance: finalStats.spellResistance || 0,
      mentalResistance: finalStats.mentalResistance || 0,
      
      // === СОЦИАЛЬНЫЕ ===
      charmChance: finalStats.charmChance || 0,
      persuasionDC: finalStats.persuasionDC || 10,
      
      // === ПРИРОСТ НА УРОВЕНЬ ===
      healthPerLevel: finalStats.healthPerLevel || 4,
      manaPerLevel: finalStats.manaPerLevel || 3,
      
      // === СИСТЕМНЫЕ ДАННЫЕ ===
      equipment: { ...this.player.equipment },
      inventory: this.inventory.items.map(item => item.getInfo ? item.getInfo() : item),
      activeEffects: this.getActiveEffects().map(effect => 
        effect.getInfo ? effect.getInfo() : effect
      ),
      conditions: this.getConditions(),
      
      // === ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ СО STATSUI ===
      fullStats: this.statManager.getStatsForUI()
    };
    
    return playerData;
  }

  // === НОВЫЙ МЕТОД: получить контейнер игрока ===
  getPlayerContainer() {
    return this.playerContainer;
  }

  getPosition() {
    return { ...this.position };
  }

  getBattleState() {
    return {
      inBattle: this.battle.inBattle,
      currentEnemyId: this.battle.currentEnemyId,
      enemyData: this.battle.enemyData ? { ...this.battle.enemyData } : null,
      battleLog: [...this.battle.battleLog]
    };
  }
  /**
   * Получить текущего врага как экземпляр NonPlayerCharacter
   * @returns {NonPlayerCharacter|null} экземпляр врага или null
   */
  getCurrentEnemy() {
      if (!this.battle.currentEnemyId) {
          return null;
      }
      
      try {
          // Только поиск через ZoneManager, никакого создания
          const entity = window.game?.zoneManager?.getEntityById(this.battle.currentEnemyId);
          
          // Возвращаем только живых врагов (не трупы и не игроков)
          if (entity && entity.state === 'alive' && entity.type !== 'player') {
              return entity;
          }
          
          return null;
      } catch (error) {
          console.error('GameState: ошибка получения врага', error);
          return null;
      }
  }  
  // === СТАРЫЕ МЕТОДЫ (оставляем для совместимости, но внутри используем контейнер) ===
  
  getInventory() {
    return { 
      items: [...this.inventory.items],
      equipment: { ...this.player.equipment },
      capacity: this.inventory.capacity
    };
  }

  getInventoryItems() {
      return this.inventory.items;
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
  
  getConditions() {
    return { ...this.conditions };
  }
  
  getAllStats() {
    return this.statManager.getStatsForUI();
  }
  
  updatePlayer(updates) {
    this.player = { ...this.player, ...updates };
    this.eventBus.emit('player:statsChanged', this.getPlayer());
  }
  
  updatePlayerHealth(health) {
    const finalStats = this.statManager.getFinalStats();
    const newHealth = Math.max(0, Math.min(health, finalStats.maxHealth));
    this.statManager.setResource('health', newHealth);
    this.eventBus.emit('player:statsChanged', this.getPlayer());
  }
  
  addEffect(effect) {
    if (!effect || !effect.id) return false;
    
    const existingIndex = this.player.activeEffects.findIndex(e => e.id === effect.id);
    
    if (existingIndex >= 0) {
      const existing = this.player.activeEffects[existingIndex];
      if (existing.addStack) {
        existing.addStack(1);
      }
      return false;
    } else {
      this.player.activeEffects.push(effect);
      
      if (effect.apply) {
        effect.apply(this);
      }
      
      return true;
    }
  }
  
  removeEffect(effectId) {
    const index = this.player.activeEffects.findIndex(e => e.id === effectId);
    if (index >= 0) {
      const effect = this.player.activeEffects[index];
      
      if (effect.remove) {
        effect.remove(this);
      }
      
      this.player.activeEffects.splice(index, 1);
      return true;
    }
    return false;
  }
  
  updatePosition(zone, room) {
    this.position.zone = zone;
    this.position.room = room;
    this.position.visitedRooms.add(`${zone}:${room}`);
  }
  
  updateBattle(enemy = null, inBattle = false) {
      if (enemy && enemy.id) {
          this.battle.currentEnemyId = enemy.id;
          
          // Получаем актуальные статы через getStats()
          const enemyStats = enemy.getStats ? enemy.getStats() : enemy;
          
          if (enemy.getInfo && typeof enemy.getInfo === 'function') {
              this.battle.enemyData = enemy.getInfo();
          } else {
              this.battle.enemyData = {
                  id: enemy.id,
                  name: enemy.name || 'Враг',
                  type: enemy.type || 'creature',
                  level: enemy.level || 1,
                  health: enemyStats.health || 0,
                  maxHealth: enemyStats.maxHealth || 0,
                  armorClass: enemyStats.armorClass || 6,
                  attack: enemyStats.attack || 0,
                  expReward: enemy.expReward,
                  goldReward: enemy.goldReward
              };
          }
      } else {
          this.battle.currentEnemyId = null;
          this.battle.enemyData = null;
      }
      this.battle.inBattle = inBattle;
  }
  
  addBattleLog(message) {
    this.battle.battleLog.push(message);
    if (this.battle.battleLog.length > 50) {
      this.battle.battleLog.shift();
    }
  }
  
  // === ИЗМЕНЕННЫЕ МЕТОДЫ РАБОТЫ С ИНВЕНТАРЕМ ===
  
  addInventoryItem(item) {
    // Добавляем в контейнер
    const result = this.playerContainer.addItem(item);
    
    // Синхронизируем старый инвентарь
    if (result) {
      this._syncInventoryFromContainer();
      this.eventBus.emit('inventory:updated', this.getInventory());
    }
    
    return result;
  }

  removeInventoryItem(index) {
    if (index < 0 || index >= this.inventory.items.length) return null;
    
    // Удаляем из контейнера (по индексу в старом массиве)
    const item = this.playerContainer.removeItem(index);
    
    if (item) {
      // Синхронизируем старый инвентарь
      this._syncInventoryFromContainer();
      this.eventBus.emit('inventory:updated', this.getInventory());
    }
    
    return item;
  }
  
  updateEquipment(slot, item) {
    // Обновляем в контейнере
    if (item) {
      // Сначала снимаем старый предмет, если есть
      const oldItem = this.playerContainer.equipment[slot];
      if (oldItem) {
        this.playerContainer.addItem(oldItem);
      }
      this.playerContainer.equipment[slot] = item;
      
      // Удаляем предмет из инвентаря, если он там был
      const itemIndex = this.playerContainer.findItemIndex(item.id);
      if (itemIndex !== -1) {
        this.playerContainer.removeItem(itemIndex);
      }
    } else {
      // Снимаем предмет
      const oldItem = this.playerContainer.equipment[slot];
      if (oldItem) {
        this.playerContainer.addItem(oldItem);
        this.playerContainer.equipment[slot] = null;
      }
    }
    
    // Синхронизируем старые поля
    this._syncInventoryFromContainer();
    this.player.equipment = this.playerContainer.getAllEquipment();
    
    this.eventBus.emit('player:equipmentChanged', { slot, item });
    this.eventBus.emit('player:statsChanged', this.getPlayer());
    this.eventBus.emit('inventory:updated', this.getInventory());
  }
  
  /**
   * Добавить опыт игроку
   * @param {number} amount - количество опыта
   * @returns {number} количество полученных уровней
   */
  addExp(amount) {
      if (!this.player) return 0;
            const result = this.player.gainExp(amount);
      // Обновляем UI
      this.eventBus.emit('player:statsChanged', this.getPlayer());
      
      return result.levelsGained;
  }
  
  setCondition(condition, value) {
    if (this.conditions.hasOwnProperty(condition)) {
      this.conditions[condition] = value;
      this.applyConditionEffects();
    }
  }
  
  applyConditionEffects() {
    let modifiers = {};
    
    if (this.conditions.hungry) {
      modifiers.healthRegen = -0.5;
      modifiers.manaRegen = -0.5;
      modifiers.staminaRegen = -0.5;
    }
    
    if (this.conditions.thirsty) {
      modifiers.healthRegen = (modifiers.healthRegen || 1) * 0.5;
      modifiers.manaRegen = (modifiers.manaRegen || 1) * 0.5;
      modifiers.staminaRegen = (modifiers.staminaRegen || 1) * 0.5;
    }
    
    if (this.conditions.poisoned) {
      modifiers.strength = -0.1;
      modifiers.agility = -0.1;
      modifiers.constitution = -0.1;
    }
    
    this.statManager.removeModifier('conditions_effects');
    if (Object.keys(modifiers).length > 0) {
      this.statManager.addModifier('conditions_effects', modifiers);
    }
  }
  
  toJSON() {
    const savedEffects = this.player.activeEffects.map(effect => {
      if (effect.getInfo) {
        return {
          ...effect.getInfo(),
          className: effect.constructor.name
        };
      }
      return effect;
    });
    
    return {
      player: {
        ...this.player,
        activeEffects: savedEffects
      },
      // Сохраняем контейнер
      playerContainer: this.playerContainer.toJSON(),
      position: {
        ...this.position,
        visitedRooms: Array.from(this.position.visitedRooms)
      },
      inventory: this.inventory,
      battle: {
        inBattle: this.battle.inBattle,
        currentEnemyId: this.battle.currentEnemyId,
        enemyData: this.battle.enemyData,
        battleLog: this.battle.battleLog
      },
      shop: this.shop,
      progress: this.progress,
      conditions: this.conditions,
      statManager: this.statManager.toJSON(),
      timeState: this.timeSystem.saveTimeState()
    };
  }
  
  fromJSON(data) {
      this.player = data.player || this.player;
      
      // Загружаем контейнер, если есть
      if (data.playerContainer) {
          this.playerContainer = EntityContainer.fromJSON(data.playerContainer);
      }
      
      this.position = {
          ...data.position,
          visitedRooms: new Set(data.position.visitedRooms || [])
      };
      
      // ===== ИСПРАВЛЕНО: используем фабрику для восстановления предметов =====
      if (data.inventory && data.inventory.items) {
          this.inventory.items = data.inventory.items.map(itemData => {
              try {
                  // Используем фабрику для создания из сохранения
                  return itemFactory.createFromSave(itemData);
              } catch (e) {
                  console.warn('Не удалось восстановить предмет:', itemData, e);
                  return null;
              }
          }).filter(item => item !== null);
      } else {
          this.inventory.items = [];
      }
      
      this.battle = data.battle || {
          inBattle: false,
          currentEnemyId: null,
          enemyData: null,
          battleLog: []
      };
      
      this.shop = data.shop || {
          currentShop: null,
          shopItems: []
      };
      
      this.progress = data.progress || {
          gameTime: 0,
          kills: 0,
          goldEarned: 0,
          goldSpent: 0
      };
      
      this.conditions = data.conditions || {
          hungry: false,
          thirsty: false,
          poisoned: false,
          blessed: false,
          cursed: false
      };
      
      if (data.statManager) {
          this.statManager.fromJSON(data.statManager);
          this.applyConditionEffects();
      }
      
      if (data.timeState) {
          this.timeSystem.loadTimeState(data.timeState);
      }
      
      if (data.player?.activeEffects) {
          this.player.activeEffects = data.player.activeEffects;
      }
      
      // Синхронизируем старые поля с контейнером
      this._syncInventoryFromContainer();
      this.player.equipment = this.playerContainer.getAllEquipment();
      
      setTimeout(() => {
          if (this.timeSystem && !this.timeSystem.isRunning) {
              this.timeSystem.start();
          }
      }, 1000);
  }
  
  pauseTime() {
    if (this.timeSystem) {
      this.timeSystem.stop();
    }
  }
  
  resumeTime() {
    if (this.timeSystem && !this.timeSystem.isRunning) {
      this.timeSystem.start();
    }
  }
  
  fastForwardTime(ticks) {
    if (this.timeSystem) {
      this.timeSystem.fastForward(ticks);
    }
  }
}

export { GameState };
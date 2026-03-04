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
    
    // === ИГРОК (только данные, не дублируем экипировку) ===
    this.player = {
      name: "Герой",
      level: 1,
      exp: 0,
      activeEffects: []
    };
    
    // === НОВОЕ: КОНТЕЙНЕР ИГРОКА ===
    /** @type {EntityContainer} */
    this.playerContainer = new EntityContainer();
    
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
  }
  
  updateConditionsOverTime() {
    const gameTime = this.timeSystem.getGameTime();
    
    if (gameTime.hour % 4 === 0 && gameTime.minute === 0) {
      if (!this.conditions.hungry) this.conditions.hungry = true;
      if (!this.conditions.thirsty) this.conditions.thirsty = true;
      this.applyConditionEffects();
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
    
    // 3. Создаем плоский объект для UI
    const playerData = {
      // === БАЗОВАЯ ИНФОРМАЦИЯ ===
      name: this.player.name || "Герой",
      level: window.game?.player?.level || this.player.level || 1,
      exp: window.game?.player?.exp || 0,
      expToNext: window.game?.player?.getExpForNextLevel ? window.game.player.getExpForNextLevel() : 100,
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
      defense: finalStats.defense || 0,

      
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
      equipment: containerInfo.equipment,
      inventory: containerInfo.items,
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
  
  // === МЕТОДЫ РАБОТЫ С ИНВЕНТАРЕМ (теперь только через контейнер) ===
  
  getInventory() {
    return { 
      items: this.playerContainer.getAllItems(),
      equipment: this.playerContainer.getAllEquipment(),
      capacity: 30 // TODO: вынести в конфиг
    };
  }

  getInventoryItems() {
      return this.playerContainer.getAllItems();
  }
  
  getEquipment() {
    return this.playerContainer.getAllEquipment();
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
  
  // === МЕТОДЫ РАБОТЫ С ИНВЕНТАРЕМ (без синхронизации) ===
  
  addInventoryItem(item) {
    // Добавляем в контейнер
    const result = this.playerContainer.addItem(item);
    
    if (result) {
      this.eventBus.emit('inventory:updated', this.getInventory());
    }
    
    return result;
  }

  removeInventoryItem(instanceId) {
      if (!instanceId) return null;
      
      // Удаляем из контейнера по instanceId
      const item = this.playerContainer.removeItemById(instanceId);
      
      if (item) {
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
          
          // Надеваем новый предмет
          this.playerContainer.equipment[slot] = item;
          
          // Удаляем предмет из инвентаря по его instanceId
          const removed = this.playerContainer.removeItemById(item.instanceId);
          if (!removed) {
              console.warn(`GameState.updateEquipment: не удалось удалить предмет ${item.instanceId} из инвентаря`);
          }
      } else {
          // Снимаем предмет
          const oldItem = this.playerContainer.equipment[slot];
          if (oldItem) {
              this.playerContainer.addItem(oldItem);
              this.playerContainer.equipment[slot] = null;
          }
      }
      
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
      // Сохраняем только контейнер (единый источник правды)
      playerContainer: this.playerContainer.toJSON(),
      position: {
        ...this.position,
        visitedRooms: Array.from(this.position.visitedRooms)
      },
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
      
      // Загружаем контейнер (единый источник правды)
      if (data.playerContainer) {
          this.playerContainer = EntityContainer.fromJSON(data.playerContainer);
      }
      
      this.position = {
          ...data.position,
          visitedRooms: new Set(data.position.visitedRooms || [])
      };
      
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
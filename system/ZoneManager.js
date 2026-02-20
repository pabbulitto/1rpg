// system/ZoneManager.js

import { MinimapManager } from './MinimapManager.js';

class ZoneManager {
  constructor(gameState) {
    this.gameState = gameState;
    this.loadedZones = new Map();
    this.zonesData = null;
    
    // Миникарта
    this.minimapManager = new MinimapManager(gameState, this);
    
    // ===== НОВАЯ СТРУКТУРА: ЕДИНОЕ ХРАНЕНИЕ ВСЕХ СУЩНОСТЕЙ =====
    /** @type {Map<string, {entities: Map<string, Entity>}>} */
    this.rooms = new Map();

    if (this.gameState.timeSystem) {
        // Регенерация
        this.gameState.timeSystem.registerCustom('zoneManager_regen', (tick) => {
            this.processRegeneration(tick);
        });
          
         // Распад трупов
        this.gameState.timeSystem.registerCustom('zoneManager_corpseDecay', (tick) => {
            this.processCorpseDecay(tick);
         });
    }
  }
  
  async init() {
    try {
      this.zonesData = await this.loadJson('data/zones.json');
      
      const position = this.gameState.getPosition();
      
      if (!position.zone || !position.room) {
        const newZone = 'village';
        const newRoom = this.zonesData.village.startRoom;
        this.gameState.updatePosition(newZone, newRoom);
      }
      
      await this.loadZone(position.zone);
      
      // Инициализируем миникарту
      this.minimapManager.initForZone(position.zone);
      
      // Инициализируем комнату с текущей позицией
      this._initRoom(position.room);
      
      // Загружаем врагов в текущую комнату
      await this._loadEnemiesForRoom(position.room);
      
      console.log('ZoneManager инициализирован');
      return true;
    } catch (error) {
      console.error('Ошибка инициализации ZoneManager:', error);
      return false;
    }
  }
  
  /**
   * Инициализировать комнату, если её нет
   * @private
   */
  _initRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        entities: new Map()
      });
    }
  }
  
  /**
   * Загрузить врагов для комнаты из конфига
   * @private
   */
  async _loadEnemiesForRoom(roomId) {
      const position = this.gameState.getPosition();
      const zoneData = this.loadedZones.get(position.zone);
      const roomData = zoneData?.[roomId];
      
      if (!roomData || !roomData.enemies || roomData.enemies.length === 0) {
          return;
      }
      
      // Получаем комнату из памяти
      const room = this.rooms.get(roomId);
      
      if (room) {
          // Получаем все сущности в комнате
          const entities = Array.from(room.entities.values());
          
          // Проверяем наличие живых врагов
          const livingEnemies = entities.filter(e => e.state === 'alive' && e.type !== 'player');
          if (livingEnemies.length > 0) {
              console.log(`ZoneManager: в комнате ${roomId} уже есть живые враги, пропускаем загрузку`);
              return;
          }
          
          // Проверяем наличие трупов
          const corpses = entities.filter(e => e.state === 'corpse');
          if (corpses.length > 0) {
              console.log(`ZoneManager: в комнате ${roomId} есть трупы, новых врагов не создаем`);
              return;
          }
      }
      
      const enemyService = window.game?.enemyService;
      if (!enemyService) {
          console.warn('ZoneManager: enemyService не найден');
          return;
      }
      
      console.log(`ZoneManager: создаем ${roomData.enemies.length} врагов для ${roomId}`);
      
      for (const enemyConfig of roomData.enemies) {
          const enemy = enemyService.create(enemyConfig.type, enemyConfig.level || 1);
          if (enemy) {
              enemy.zoneId = position.zone;
              this.addEntity(roomId, enemy);
          }
      }
  }
    
  // ===== НОВЫЕ МЕТОДЫ ДЛЯ РАБОТЫ С ENTITIES =====
  /**
   * Добавить сущность в комнату
   * @param {string} roomId 
   * @param {Entity} entity 
   */
  addEntity(roomId, entity) {
      this._initRoom(roomId);
      const room = this.rooms.get(roomId);
      
      // Если сущность уже была в другой комнате, удаляем оттуда
      if (entity.roomId && entity.roomId !== roomId) {
          this.removeEntity(entity.id);
      }
      
      entity.roomId = roomId;
      room.entities.set(entity.id, entity);
      
      this.gameState.eventBus.emit('room:entitiesUpdated', {
          roomId,
          entities: this.getRoomEntitiesInfo(roomId)
      });
  }
  
  /**
   * Удалить сущность из комнаты
   * @param {string} entityId 
   * @returns {Entity|null}
   */
  removeEntity(entityId) {
    for (const [roomId, room] of this.rooms) {
      if (room.entities.has(entityId)) {
        const entity = room.entities.get(entityId);
        room.entities.delete(entityId);
        
        // Оповещаем UI
        this.gameState.eventBus.emit('room:entitiesUpdated', {
          roomId,
          entities: this.getRoomEntitiesInfo(roomId)
        });
        
        return entity;
      }
    }
    return null;
  }
  
  /**
   * Получить все сущности в комнате
   * @param {string} roomId 
   * @returns {Array<Entity>}
   */
  getRoomEntities(roomId) {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.entities.values()) : [];
  }
  
  /**
   * Получить информацию о сущностях для UI
   * @param {string} roomId 
   * @returns {Array}
   */
  getRoomEntitiesInfo(roomId) {
    const entities = this.getRoomEntities(roomId);
    return entities
      .filter(entity => entity !== null && entity.state !== 'removed')
      .map(entity => entity.getInfo?.() || null)
      .filter(Boolean);
  }
  
  /**
   * Получить живые сущности в комнате (state = 'alive')
   * @param {string} roomId 
   * @returns {Array<Entity>}
   */
  getLivingEntities(roomId) {
    const entities = this.getRoomEntities(roomId);
    return entities.filter(entity => entity.isAlive && entity.isAlive());
  }
  
  /**
   * Получить трупы в комнате (state = 'corpse')
   * @param {string} roomId 
   * @returns {Array<Entity>}
   */
  getCorpses(roomId) {
    const entities = this.getRoomEntities(roomId);
    return entities.filter(entity => entity.isCorpse && entity.isCorpse());
  }
  
  /**
   * Найти сущность по ID
   * @param {string} entityId 
   * @returns {Entity|null}
   */
  getEntityById(entityId) {
    for (const room of this.rooms.values()) {
      if (room.entities.has(entityId)) {
        return room.entities.get(entityId);
      }
    }
    return null;
  }
  /**
   * Обработать распад трупов (вызывается каждый тик)
   * @param {number} currentTick - текущий тик (не используется, но передается)
   */
  processCorpseDecay(currentTick) {
      for (const [roomId, room] of this.rooms) {
          const corpses = [];
          const toRemove = [];
          
          // Собираем трупы в комнате
          for (const [entityId, entity] of room.entities) {
              if (entity.isCorpse && entity.isCorpse()) {
                  corpses.push(entity);
              }
          }
          
          // Уменьшаем счетчик и отмечаем для удаления
          for (const corpse of corpses) {
              if (corpse.corpseDecay > 0) {
                  corpse.corpseDecay--;
                  
                  if (corpse.corpseDecay <= 0) {
                      toRemove.push(corpse.id);
                  }
              }
          }
          
          // Удаляем истлевшие трупы
          for (const corpseId of toRemove) {
              this.removeEntity(corpseId);
              this.gameState.eventBus.emit('log:add', {
                  message: `🕊️ Труп истлел`,
                  type: 'system'
              });
          }
      }
  }
  /**
   * Обработать регенерацию всех живых сущностей в мире.
   * @param {number} currentTick - текущий тик
   */
  processRegeneration(currentTick) {
      for (const room of this.rooms.values()) {
          for (const entity of room.entities.values()) {
              // Регенерируем только живых
              if (entity.isAlive && entity.isAlive()) {
                  this._applyRegenToEntity(entity);
              }
          }
      }
  }

  /**
   * Применить регенерацию к одной сущности.
   * @private
   */
  _applyRegenToEntity(entity) {
      const stats = entity.getStats();
      const statManager = entity.getStatManager();
      if (!statManager) return;

      // Здоровье
      if (stats.healthRegen && stats.health < stats.maxHealth) {
          const newHealth = Math.min(stats.health + stats.healthRegen, stats.maxHealth);
          statManager.setResource('health', newHealth);
      }
      // Мана
      if (stats.manaRegen && stats.mana < stats.maxMana) {
          const newMana = Math.min(stats.mana + stats.manaRegen, stats.maxMana);
          statManager.setResource('mana', newMana);
      }
      // Выносливость
      if (stats.staminaRegen && stats.stamina < stats.maxStamina) {
          const newStamina = Math.min(stats.stamina + stats.staminaRegen, stats.maxStamina);
          statManager.setResource('stamina', newStamina);
      }
  }
  // ===== ВРЕМЕННЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ =====
  
  /**
   * @deprecated Используйте getCorpses(roomId)
   */
  getRoomCorpses(roomId) {
    return this.getCorpses(roomId);
  }
  
  /**
   * @deprecated Используйте getLivingEntities(roomId)
   */
  getRoomEnemies(roomId) {
    return this.getLivingEntities(roomId);
  }    
  // ===== СУЩЕСТВУЮЩИЕ МЕТОДЫ (обновленные) =====
  
  async loadZone(zoneId) {
    if (this.loadedZones.has(zoneId)) {
      return this.loadedZones.get(zoneId);
    }
    
    try {
      const zoneData = await this.loadJson(`data/rooms/${zoneId}.json`);
      this.loadedZones.set(zoneId, zoneData);
      console.log(`Зона ${zoneId} загружена`);
      return zoneData;
    } catch (error) {
      console.error(`Ошибка загрузки зоны ${zoneId}:`, error);
      return null;
    }
  }
  
  async loadJson(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText} для ${url}`);
      }
      return response.json();
    } catch (error) {
      console.error(`Ошибка загрузки JSON ${url}:`, error);
      throw error;
    }
  }
  
  getCurrentRoomInfo() {
    const position = this.gameState.getPosition();
    
    if (!position.zone || !position.room) {
      return null;
    }
    
    const zoneData = this.loadedZones.get(position.zone);
    if (!zoneData || !zoneData[position.room]) {
      return null;
    }
    
    const roomData = zoneData[position.room];
    
    return {
      ...roomData,
      zoneId: position.zone,
      roomId: position.room,
      fullId: `${position.zone}:${position.room}`,
      entities: this.getRoomEntitiesInfo(position.room)
    };
  }
  
  async move(direction) {
      const roomInfo = this.getCurrentRoomInfo();
      if (!roomInfo || !roomInfo.directions || !roomInfo.directions[direction]) {
          return {
              success: false,
              message: `Нельзя идти ${direction}`
          };
      }
      
      const target = roomInfo.directions[direction];
      
      if (target.includes(':')) {
          return await this.moveToOtherZone(target);
      } else {
          return this.moveInsideZone(target);
      }
  }
  
  /**
   * Переместиться внутри текущей зоны
   * @param {string} targetRoom - ID целевой комнаты
   * @returns {Object} результат перемещения
   */
  moveInsideZone(targetRoom) {
      const position = this.gameState.getPosition();
      const zoneData = this.loadedZones.get(position.zone);
      
      if (!zoneData || !zoneData[targetRoom]) {
          return {
              success: false,
              message: `Комната ${targetRoom} не найдена в зоне ${position.zone}`
          };
      }
      
      const oldRoom = position.room;
      const newRoomData = zoneData[targetRoom];
      
      // Удаляем игрока из старой комнаты
      this.removeEntity(window.game.player.id);  
      
      // Обновляем позицию в GameState
      this.gameState.updatePosition(position.zone, targetRoom);
      
      // Инициализируем новую комнату, если её нет
      this._initRoom(targetRoom);
      
      // Добавляем игрока в новую комнату
      this.addEntity(targetRoom, window.game.player); 
      
      // Загружаем врагов для новой комнаты
      this._loadEnemiesForRoom(targetRoom);
      
      // Обновляем миникарту
      this.minimapManager.onPlayerMoved();
      
      // Отправляем событие обновления комнаты
      this.gameState.eventBus.emit('room:updated', this.getCurrentRoomInfo());
      
      return {
          success: true,
          message: `Вы перешли в ${newRoomData.name}`,
          from: { zone: position.zone, room: oldRoom },
          to: { zone: position.zone, room: targetRoom }
      };
  }
  /**
   * Переместить игрока в другую зону
   * @param {string} target - строка вида "зона:комната"
   * @returns {Object} результат перемещения
   */
  async moveToOtherZone(target) {
      const [targetZone, targetRoom] = target.split(':');
      
      try {
          const zoneData = await this.loadZone(targetZone);
          
          if (!zoneData) {
              throw new Error(`Не удалось загрузить зону ${targetZone}`);
          }
          
          if (!zoneData[targetRoom]) {
              throw new Error(`Комната ${targetRoom} не найдена в зоне ${targetZone}`);
          }
          
          const oldZone = this.gameState.getPosition().zone;
          const oldRoom = this.gameState.getPosition().room;
          const player = window.game.player;  // ← получаем игрока глобально
          
          // Удаляем игрока из старой комнаты
          this.removeEntity(player.id);
          
          // Обновляем позицию в GameState
          this.gameState.updatePosition(targetZone, targetRoom);
          
          // Инициализируем новую комнату
          this._initRoom(targetRoom);
          
          // Добавляем игрока в новую комнату
          this.addEntity(targetRoom, player);
          
          // Загружаем врагов для новой комнаты
          this._loadEnemiesForRoom(targetRoom);
          
          // Обновляем миникарту
          this.minimapManager.switchZone(targetZone);
          
          // Отправляем событие обновления комнаты
          this.gameState.eventBus.emit('room:updated', this.getCurrentRoomInfo());
          
          return {
              success: true,
              message: `Вы перешли в ${zoneData[targetRoom].name}`,
              from: { zone: oldZone, room: oldRoom },
              to: { zone: targetZone, room: targetRoom }
          };
      } catch (error) {
          console.error('Ошибка перехода между зонами:', error);
          return {
              success: false,
              message: `Ошибка перехода: ${error.message}`
          };
      }
  }
  
  isCurrentRoomShop() {
    const roomInfo = this.getCurrentRoomInfo();
    return roomInfo ? roomInfo.isShop || false : false;
  }
  
  getCurrentPosition() {
    const position = this.gameState.getPosition();
    const zoneName = this.zonesData?.[position.zone]?.name || position.zone;
    const roomInfo = this.getCurrentRoomInfo();
    
    return {
      zone: position.zone,
      room: position.room,
      zoneName: zoneName,
      roomName: roomInfo?.name || position.room,
      depth: roomInfo?.depth || 0
    };
  }
  
  getZoneInfo(zoneId) {
    return this.zonesData?.[zoneId] || null;
  }
  
  getMinimapManager() {
    return this.minimapManager;
  }
  
  getMinimapData() {
    return this.minimapManager ? this.minimapManager.getMinimapData() : null;
  }
  
  getMinimapText() {
    return this.minimapManager ? this.minimapManager.getTextRepresentation() : 'Миникарта не доступна';
  }
  
  getCurrentRoomCoordinates() {
    const roomInfo = this.getCurrentRoomInfo();
    if (roomInfo && roomInfo.coordinates) {
      return roomInfo.coordinates;
    }
    return null;
  }
}

export { ZoneManager };
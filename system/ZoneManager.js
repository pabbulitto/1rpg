import { MinimapManager } from './MinimapManager.js';

class ZoneManager {
  constructor(gameState) {
    this.gameState = gameState;
    this.loadedZones = new Map();
    this.zonesData = null;
    
    // Инициализируем MinimapManager
    this.minimapManager = new MinimapManager(gameState, this);
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
      
      // Инициализируем миникарту для начальной зоны
      this.minimapManager.initForZone(position.zone);
      
      console.log('ZoneManager инициализирован');
      return true;
    } catch (error) {
      console.error('Ошибка инициализации ZoneManager:', error);
      return false;
    }
  }
  
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
      fullId: `${position.zone}:${position.room}`
    };
  }
  
  getRoomEnemies() {
    return this.getCurrentRoomInfo()?.enemies || []; // массив конфигов
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
    this.gameState.updatePosition(position.zone, targetRoom);
    
    // Обновляем миникарту при перемещении внутри зоны
    this.minimapManager.onPlayerMoved();
    
    return {
      success: true,
      message: `Вы перешли в ${zoneData[targetRoom].name}`,
      from: { zone: position.zone, room: oldRoom },
      to: { zone: position.zone, room: targetRoom }
    };
  }
  
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
      
      const position = this.gameState.getPosition();
      const oldZone = position.zone;
      const oldRoom = position.room;
      
      this.gameState.updatePosition(targetZone, targetRoom);
      
      this.minimapManager.switchZone(targetZone);
      
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
  
  // Добавляем геттер для MinimapManager
  getMinimapManager() {
    return this.minimapManager;
  }
  
  // Новый метод: получить данные миникарты для UI
  getMinimapData() {
    return this.minimapManager ? this.minimapManager.getMinimapData() : null;
  }
  
  // Новый метод: получить текстовое представление миникарты
  getMinimapText() {
    return this.minimapManager ? this.minimapManager.getTextRepresentation() : 'Миникарта не доступна';
  }
  
  // Новый метод: получить координаты текущей комнаты
  getCurrentRoomCoordinates() {
    const roomInfo = this.getCurrentRoomInfo();
    if (roomInfo && roomInfo.coordinates) {
      return roomInfo.coordinates;
    }
    return null;
  }
}

export { ZoneManager };
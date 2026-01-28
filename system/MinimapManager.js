/**
 * MinimapManager - система управления миникартой
 * Использует координаты из JSON файлов комнат для отображения карты
 */
class MinimapManager {
  constructor(gameState, zoneManager) {
    this.gameState = gameState;
    this.zoneManager = zoneManager;
    
    // Текущая зона данных
    this.currentZoneData = null;
    this.currentZoneId = null;
    
    // Размеры сетки миникарты (7x7)
    this.gridSize = 7;
    this.centerIndex = Math.floor(this.gridSize / 2); // 3
    
    // Кэш отрисованной сетки
    this.currentGrid = null;
  }
  
  /**
   * Инициализировать миникарту для зоны
   * @param {string} zoneId - ID зоны
   * @returns {boolean} успешно ли инициализировано
   */
  initForZone(zoneId) {
    // Получаем данные зоны из ZoneManager
    const zoneData = this.zoneManager.loadedZones.get(zoneId);
    if (!zoneData) {
      console.warn(`MinimapManager: данные зоны ${zoneId} не загружены`);
      return false;
    }
    
    this.currentZoneData = zoneData;
    this.currentZoneId = zoneId;
    
    // Создаем начальную сетку
    this.updateGrid();
    
    console.log(`MinimapManager: инициализирована для зоны ${zoneId}`);
    return true;
  }
  
  /**
   * Обновить сетку миникарты на основе текущей позиции игрока
   * @returns {Array|null} обновленная сетка 7x7
   */
  updateGrid() {
    const position = this.gameState.getPosition();
    const currentRoomId = position.room;
    
    if (!this.currentZoneData || !this.currentZoneData[currentRoomId]) {
      return null;
    }
    
    const currentRoom = this.currentZoneData[currentRoomId];
    if (!currentRoom.coordinates) {
      console.warn(`MinimapManager: комната ${currentRoomId} не имеет координат`);
      return null;
    }
    
    const playerX = currentRoom.coordinates.x;
    const playerY = currentRoom.coordinates.y;
    const playerLevel = currentRoom.coordinates.level || 0;
    
    const grid = Array(this.gridSize).fill().map(() => 
      Array(this.gridSize).fill().map(() => ({
        roomId: null,
        name: null,
        visited: false,
        isPlayer: false,
        hasExit: false,
        exitDirections: [],
        coordinates: null
      }))
    );
    
    Object.entries(this.currentZoneData).forEach(([roomId, roomData]) => {
      if (!roomData.coordinates) return;
      
      const roomX = roomData.coordinates.x;
      const roomY = roomData.coordinates.y;
      const roomLevel = roomData.coordinates.level || 0;
      
      if (playerLevel !== roomLevel) return;
      
      const gridX = roomX - playerX + this.centerIndex;
      const gridY = roomY - playerY + this.centerIndex;
      
      if (gridX >= 0 && gridX < this.gridSize && gridY >= 0 && gridY < this.gridSize) {
        const visited = position.visitedRooms.has(`${this.currentZoneId}:${roomId}`);
        const isPlayer = roomId === currentRoomId;
        const hasExit = roomData.directions && Object.keys(roomData.directions).length > 0;
        
        grid[gridY][gridX] = {
          roomId: roomId,
          name: roomData.name || roomId,
          visited: visited,
          isPlayer: isPlayer,
          hasExit: hasExit,
          exitDirections: roomData.directions ? Object.keys(roomData.directions) : [],
          directions: {
            north: roomData.directions ? roomData.directions.hasOwnProperty('north') : false,
            south: roomData.directions ? roomData.directions.hasOwnProperty('south') : false,
            east: roomData.directions ? roomData.directions.hasOwnProperty('east') : false,
            west: roomData.directions ? roomData.directions.hasOwnProperty('west') : false,
            up: roomData.directions ? roomData.directions.hasOwnProperty('up') : false,
            down: roomData.directions ? roomData.directions.hasOwnProperty('down') : false
          },
          coordinates: { x: roomX, y: roomY, level: roomLevel }
        };
      }
    });
    
    this.currentGrid = grid;
    return grid;
  } 
  /**
   * Получить данные для отрисовки миникарты
   * @returns {Object} данные миникарты
   */
  getMinimapData() {
    if (!this.currentGrid) {
      this.updateGrid();
    }
    
    const position = this.gameState.getPosition();
    const zoneInfo = this.zoneManager.getZoneInfo(this.currentZoneId);
    
    return {
      grid: this.currentGrid,
      zoneId: this.currentZoneId,
      zoneName: zoneInfo ? zoneInfo.name : this.currentZoneId,
      playerRoom: position.room,
      playerCoordinates: this.getPlayerCoordinates(),
      dimensions: {
        width: this.gridSize,
        height: this.gridSize
      }
    };
  }
  
  /**
   * Получить координаты игрока в текущей зоне
   * @returns {Object|null} координаты {x, y, level}
   */
  getPlayerCoordinates() {
    const position = this.gameState.getPosition();
    const roomData = this.currentZoneData ? this.currentZoneData[position.room] : null;
    
    if (roomData && roomData.coordinates) {
      return roomData.coordinates;
    }
    
    return null;
  }
  
  /**
   * Получить комнату по координатам
   * @param {number} x - координата X
   * @param {number} y - координата Y
   * @param {number} level - уровень (опционально)
   * @returns {Object|null} данные комнаты
   */
  getRoomByCoordinates(x, y, level = 0) {
    if (!this.currentZoneData) return null;
    
    for (const [roomId, roomData] of Object.entries(this.currentZoneData)) {
      if (roomData.coordinates && 
          roomData.coordinates.x === x && 
          roomData.coordinates.y === y &&
          (roomData.coordinates.level || 0) === level) {
        return { roomId, ...roomData };
      }
    }
    
    return null;
  }
  
  /**
   * Обновить миникарту при перемещении
   * @returns {Array} обновленная сетка
   */
  onPlayerMoved() {
    return this.updateGrid();
  }
  
  /**
   * Переключить зону
   * @param {string} zoneId - ID новой зоны
   * @returns {boolean} успешно ли переключено
   */
  switchZone(zoneId) {
    if (zoneId === this.currentZoneId) return true;
    
    const success = this.initForZone(zoneId);
    if (success) {
      console.log(`MinimapManager: переключено на зону ${zoneId}`);
    }
    
    return success;
  }
  
  /**
   * Получить видимые комнаты вокруг игрока
   * @returns {Array} массив видимых комнат
   */
  getVisibleRooms() {
    if (!this.currentGrid) return [];
    
    const visible = [];
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const cell = this.currentGrid[y][x];
        if (cell.roomId) {
          visible.push(cell);
        }
      }
    }
    
    return visible;
  }
  
  /**
   * Получить текстовое представление миникарты (для отладки)
   * @returns {string} текстовое представление
   */
  getTextRepresentation() {
    if (!this.currentGrid) return "Миникарта не инициализирована";
    
    let text = `Зона: ${this.currentZoneId}\n`;
    text += `Игрок: ${this.gameState.getPosition().room}\n\n`;
    
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const cell = this.currentGrid[y][x];
        
        if (cell.isPlayer) {
          text += "[P]";
        } else if (cell.roomId) {
          if (cell.visited) {
            text += "[#]";
          } else {
            text += "[?]";
          }
        } else {
          text += "[ ]";
        }
        
        text += " ";
      }
      text += "\n";
    }
    
    return text;
  }
}

export { MinimapManager };

// ui/GraphicsEngine.js
/**
 * GraphicsEngine - графический движок для отрисовки комнат и сущностей
 * 
 * Связи с существующим кодом:
 * - Использует EventBus для коммуникации (как и все UI компоненты)
 * - Получает данные о комнате через ZoneManager (как UIManager)
 * - Ожидает от сущностей поля: sprite, gridX, gridY, width, height
 * - Эмитит события для открытия модалок (BattleUI, InventoryUI)
 * - Не изменяет существующую логику боя/инвентаря
 */
class GraphicsEngine {
    /**
     * @param {string} canvasId - ID canvas элемента
     * @param {Object} game - глобальный объект игры
     */
    constructor(canvasId, game) {
        this.game = game;
        this.eventBus = game.gameState?.eventBus;
        this.zoneManager = game.zoneManager;
        
        // Создаем canvas если его нет
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = canvasId;
        }
        
        // Фиксированные размеры игрового поля
        this.canvas.width = 900;
        this.canvas.height = 507;
        this.ctx = this.canvas.getContext('2d');
        
        // Параметры сетки
        this.cellSize = 85;        // размер ячейки в пикселях
        this.cols = 10;            //  полных ячеек 
        this.rows = 5;             //  полных ячеек 
        
        // Кэш для загруженных изображений
        this.backgrounds = new Map();  // ключ: "zoneId/roomId"
        this.sprites = new Map();      // ключ: путь к спрайту
        
        // Состояние
        this.currentRoomId = null;
        this.currentZoneId = null;
        this.entities = [];
        this.isInitialized = false;
        this.currentRoomInfo = null; 
        this.buttonAreas = [];         
        
        // Привязка обработчиков
        this.handleRoomUpdate = this.handleRoomUpdate.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.render = this.render.bind(this);

        this._clickLocked = false;
    }
    show() {
        this.canvas.style.display = 'block';
        this.isVisible = true;
        this.render();
    }
    
    hide() {
        this.canvas.style.display = 'none';
        this.isVisible = false;
    }    
    /**
     * Инициализация движка
     */
    init() {
        // Подписываемся на обновление комнаты
        if (this.eventBus) {
            this.eventBus.on('room:updated', this.handleRoomUpdate);
            
            this.eventBus.on('room:entitiesUpdated', (data) => {
                if (data.roomId === this.currentRoomId) {
                    this.handleRoomUpdate(this.zoneManager?.getCurrentRoomInfo());
                }
            });
            this.eventBus.on('player:statsChanged', () => {
                this.render(); 
            });
        }
        
        // Вешаем обработчик клика
        this.canvas.addEventListener('click', this.handleClick);
        
        // Первичный рендер
        const roomInfo = this.zoneManager?.getCurrentRoomInfo();
        if (roomInfo) {
            this.handleRoomUpdate(roomInfo);
        }
        
        this.isInitialized = true;
        return this;
    }
        
    /**
     * Обработчик обновления комнаты
     * @param {Object} roomInfo - данные комнаты от ZoneManager
     */
    handleRoomUpdate(roomInfo) {
        if (!roomInfo) return;
        
        this.currentZoneId = roomInfo.zoneId;
        this.currentRoomId = roomInfo.roomId;
        this.currentRoomInfo = roomInfo;
        // Получаем все сущности в комнате
        const allEntities = this.zoneManager?.getRoomEntities(roomInfo.roomId) || [];
        
        // Фильтруем только живые и не удаленные, преобразуем в нужный формат
        this.entities = allEntities
            .filter(entity => entity && entity.state !== 'removed')
            .map(entity => ({
                id: entity.id,
                type: entity.type,
                sprite: entity.sprite,
                gridX: entity.gridX,        // придут из JSON через Entity
                gridY: entity.gridY,
                width: entity.width || 68,
                height: entity.height || 68,
                state: entity.state,
                data: entity.getInfo ? entity.getInfo() : entity
            }))
            .filter(entity => entity.gridX !== undefined && entity.gridY !== undefined);
        
        // Запускаем рендер
        this.render();
    }
    
    /**
     * Загрузить изображение с кэшированием
     * @param {string} src - путь к изображению
     * @returns {Promise<HTMLImageElement|null>}
     */
    async _loadImage(src) {
        if (!src) return null;
        if (this.sprites.has(src)) return this.sprites.get(src);
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.sprites.set(src, img);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`GraphicsEngine: не удалось загрузить ${src}`);
                resolve(null);
            };
            img.src = src;
        });
    }
    
    /**
     * Загрузить фон комнаты
     * @returns {Promise<HTMLImageElement|null>}
     */
    async _loadBackground() {
        if (!this.currentZoneId || !this.currentRoomId) return null;
        
        const key = `${this.currentZoneId}/${this.currentRoomId}`;
        if (this.backgrounds.has(key)) return this.backgrounds.get(key);
        
        // Определяем путь к фону
        let src = null;
        if (this.currentRoomInfo && this.currentRoomInfo.background) {
            src = this.currentRoomInfo.background; // путь из JSON (приоритет)
        } else {
            src = `assets/backgrounds/${this.currentZoneId}/${this.currentRoomId}.jpg`; // старый шаблон (fallback)
        }
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.backgrounds.set(key, img);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`GraphicsEngine: фон не найден ${src}`);
                resolve(null);
            };
            img.src = src;
        });
    }
    
    /**
     * Отрисовать все
     */
    async render() {
        // Очищаем canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 1. Рисуем фон
        const background = await this._loadBackground();
        if (background) {
            this.ctx.drawImage(background, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            // Заливка цветом если нет фона (временное, пока нет ассетов)
            this.ctx.fillStyle = '#1a1a2e';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // 2. Рисуем сущности
        for (const entity of this.entities) {
            await this._drawEntity(entity);
        }
        this.drawExpBar();
        this.drawDirectionButtons();
    }
    
    /**
     * Нарисовать сущность
     * @param {Object} entity - сущность с координатами
     */
    async _drawEntity(entity) {
        // Пропускаем мертвых (кроме трупов)
        if (entity.state === 'removed') return;
        
        // Получаем оригинальную сущность по ID для проверки эффектов
        const originalEntity = window.game?.zoneManager?.getEntityById(entity.id);
        
        // Проверяем, есть ли у оригинальной сущности эффект "спрятался"
        const hasHidden = originalEntity?.hasEffect && originalEntity.hasEffect('спрятался');
        
        if (hasHidden) {
            const player = window.game?.player;
            const hasLifeSense = player?.hasEffect && player.hasEffect('чувствовать_жизнь');
            
            // Если у игрока нет детекта - не рисуем вообще
            if (!hasLifeSense) {
                return;
            }
            
            // Если есть детект - рисуем с затемнением
            const x = entity.gridX * this.cellSize;
            const y = entity.gridY * this.cellSize;
            const offsetX = (this.cellSize - entity.width) / 2;
            const offsetY = (this.cellSize - entity.height) / 2;
            
            this.ctx.save();
            this.ctx.globalAlpha = 0.5;
            
            // Рисуем спрайт
            if (entity.sprite) {
                const img = await this._loadImage(entity.sprite);
                if (img) {
                    this.ctx.drawImage(img, x + offsetX, y + offsetY, entity.width, entity.height);
                } else {
                    this._drawPlaceholder(entity, x, y);
                }
            } else {
                this._drawPlaceholder(entity, x, y);
            }
            
            this.ctx.restore();
            
            // Рисуем желтый пунктирный контур
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 3]);
            this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
            this.ctx.setLineDash([]);
            
            return; // ВАЖНО: выходим, чтобы не рисовать нормально
        }
        
        // Вычисляем позицию на canvas для обычных существ
        const x = entity.gridX * this.cellSize;
        const y = entity.gridY * this.cellSize;
        
        // Центрирование спрайта в ячейке
        const offsetX = (this.cellSize - entity.width) / 2;
        const offsetY = (this.cellSize - entity.height) / 2;
        
        if (entity.sprite) {
            const img = await this._loadImage(entity.sprite);
            if (img) {
                this.ctx.drawImage(img, x + offsetX, y + offsetY, entity.width, entity.height);
            } else {
                // Заглушка если спрайт не загрузился
                this._drawPlaceholder(entity, x, y);
            }
        } else {
            // Заглушка если нет спрайта
            this._drawPlaceholder(entity, x, y);
        }
    }
        
    /**
     * Нарисовать заглушку для отладки
     * @private
     */
    _drawPlaceholder(entity, x, y) {
        this.ctx.fillStyle = entity.type === 'player' ? '#44ff44' : 
                            entity.type === 'enemy' ? '#ff4444' : '#ffaa44';
        this.ctx.fillRect(x + 10, y + 10, 48, 48);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.strokeRect(x + 10, y + 10, 48, 48);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px monospace';
        this.ctx.fillText(entity.type.substring(0, 3), x + 20, y + 40);
    }
    
    getRoomName(roomId, currentZoneId) {
        // Если roomId содержит ":", значит это переход в другую зону
        if (roomId.includes(':')) {
            const [zoneId, targetRoom] = roomId.split(':');
            const zoneData = this.zoneManager?.loadedZones.get(zoneId);
            return zoneData?.rooms?.[targetRoom]?.name || targetRoom;
        } 
        // Если roomId содержит ".", значит это внутренняя комната с префиксом зоны
        else if (roomId.includes('.')) {
            const [zoneId, targetRoom] = roomId.split('.');
            const zoneData = this.zoneManager?.loadedZones.get(zoneId);
            return zoneData?.rooms?.[roomId]?.name || targetRoom;
        }
        else {
            // Внутри текущей зоны (старый формат)
            const zoneData = this.zoneManager?.loadedZones.get(currentZoneId);
            return zoneData?.rooms?.[roomId]?.name || roomId;
        }
    }

    drawDirectionButtons() {
        const roomInfo = this.zoneManager?.getCurrentRoomInfo();
        if (!roomInfo) {
            return;
        }
        
        
        // directions теперь в roomInfo.directions
        const directions = roomInfo.directions || {};
        this.buttonAreas = [];
        const ctx = this.ctx;
        
        const getTextWidth = (text) => {
            ctx.font = '14px "Segoe UI", sans-serif';
            return ctx.measureText(text).width;
        };
        
        ctx.font = '14px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Север
        if (directions.north) {
            const targetName = this.getRoomName(directions.north, roomInfo.zoneId);
            const text = `⬆️ ${targetName}`;
            const width = getTextWidth(text) + 20;
            const height = 36;
            const x = 450;
            const y = 18;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.roundRect(x - width/2, y - height/2, width, height, 8);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, x, y);
            
            this.buttonAreas.push({ x: x - width/2, y: y - height/2, width, height, direction: 'north' });
        }
        
        // Юг
        if (directions.south) {
            const targetName = this.getRoomName(directions.south, roomInfo.zoneId);
            const text = `⬇️ ${targetName}`;
            const width = getTextWidth(text) + 20;
            const height = 36;
            const x = 450;
            const y = 507 - 18;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.roundRect(x - width/2, y - height/2, width, height, 8);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, x, y);
            
            this.buttonAreas.push({ x: x - width/2, y: y - height/2, width, height, direction: 'south' });
        }
        
        // Запад
        if (directions.west) {
            const targetName = this.getRoomName(directions.west, roomInfo.zoneId);
            const text = `⬆️ ${targetName}`;
            const textWidth = getTextWidth(text) + 20;
            const buttonWidth = 36;
            const buttonHeight = textWidth;
            const x = 18;
            const y = 253;
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(-Math.PI / 2);
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.roundRect(-buttonHeight/2, -buttonWidth/2, buttonHeight, buttonWidth, 8);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, 0, 0);
            
            ctx.restore();
            
            this.buttonAreas.push({
                x: 0,
                y: y - buttonHeight/2,
                width: buttonWidth,
                height: buttonHeight,
                direction: 'west'
            });
        }
        
        // Восток
        if (directions.east) {
            const targetName = this.getRoomName(directions.east, roomInfo.zoneId);
            const text = `⬆️ ${targetName}`;
            const textWidth = getTextWidth(text) + 20;
            const buttonWidth = 36;
            const buttonHeight = textWidth;
            const x = 900 - 18;
            const y = 253;
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.PI / 2);
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.roundRect(-buttonHeight/2, -buttonWidth/2, buttonHeight, buttonWidth, 8);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, 0, 0);
            
            ctx.restore();
            
            this.buttonAreas.push({
                x: 900 - buttonWidth,
                y: y - buttonHeight/2,
                width: buttonWidth,
                height: buttonHeight,
                direction: 'east'
            });
        }
        
        // Вверх
        if (directions.up) {
            const targetName = this.getRoomName(directions.up, roomInfo.zoneId);
            const text = `🪜 ${targetName}`;
            const width = getTextWidth(text) + 20;
            const height = 36;
            const x = 900 - width/2 - 10;
            const y = 18;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.roundRect(x - width/2, y - height/2, width, height, 8);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, x, y);
            
            this.buttonAreas.push({ x: x - width/2, y: y - height/2, width, height, direction: 'up' });
        }
        
        // Вниз
        if (directions.down) {
            const targetName = this.getRoomName(directions.down, roomInfo.zoneId);
            const text = `🪜 ${targetName}`;
            const width = getTextWidth(text) + 20;
            const height = 36;
            const x = 900 - width/2 - 10;
            const y = 507 - 18;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.roundRect(x - width/2, y - height/2, width, height, 8);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, x, y);
            
            this.buttonAreas.push({ x: x - width/2, y: y - height/2, width, height, direction: 'down' });
        }
        
        // Кнопка карты
        const mapText = '🗺️ Карта';
        const mapWidth = getTextWidth(mapText) + 20;
        const mapHeight = 36;
        const mapX = mapWidth/2 + 5;
        const mapY = 18;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.roundRect(mapX - mapWidth/2, mapY - mapHeight/2, mapWidth, mapHeight, 8);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(mapText, mapX, mapY);
        
        this.buttonAreas.push({ 
            x: mapX - mapWidth/2, 
            y: mapY - mapHeight/2, 
            width: mapWidth, 
            height: mapHeight, 
            action: 'map'
        });
        
    }
    /**
     * Обработчик клика по canvas
     * @param {MouseEvent} e
     */
    handleClick(e) {
            // Защита от двойных кликов
        if (this._clickLocked) return;
        this._clickLocked = true;
        setTimeout(() => { this._clickLocked = false; }, 300);

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;

        for (const btn of this.buttonAreas) {
            if (canvasX >= btn.x && canvasX <= btn.x + btn.width &&
                canvasY >= btn.y && canvasY <= btn.y + btn.height) {
                
                if (btn.action === 'map') {
                    this.eventBus?.emit('ui:showMap');
                    return;
                }
                
                this.eventBus?.emit('move:direction', { direction: btn.direction });
                return;
            }
        }       
        // Определяем ячейку сетки
        const col = Math.floor(canvasX / this.cellSize);
        const row = Math.floor(canvasY / this.cellSize);
        
        // Проверяем границы
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
        
        // Ищем сущность в этой ячейке
        const clickedEntity = this.entities.find(e => e.gridX === col && e.gridY === row);
        
        if (clickedEntity) {
            this._handleEntityClick(clickedEntity);
        } else {
            // Клик по пустой ячейке
            this.eventBus?.emit('cell:click', { col, row });
        }
        
    }
    
    /**
     * Обработать клик по сущности
     * @param {Object} entity
     */
    _handleEntityClick(entity) {
        console.log(`GraphicsEngine: клик по ${entity.type} (${entity.id})`);
        
        // Эмитим событие для UI компонентов
        this.eventBus?.emit('entity:click', {
            entityId: entity.id,
            entityType: entity.type,
            entityState: entity.state,
            data: entity.data
        });
        
        // Специфичная логика в зависимости от типа
        switch (entity.type) {
            case 'enemy':
            case 'creature':
                // Если враг жив — начинаем бой
                if (entity.state === 'alive') {
                    this.eventBus?.emit('battle:startFromClick', { enemyId: entity.id });
                }
                break;
                
            case 'item':
                // Если предмет на земле — открываем модалку поднятия
                this.eventBus?.emit('item:click', { 
                    itemId: entity.id,
                    gridX: entity.gridX,
                    gridY: entity.gridY
                });
                break;
                
            case 'player':
                // Клик по себе — открываем инвентарь или характеристики
                this.eventBus?.emit('player:click');
                break;
        }
    }
    
    /**
     * Принудительно перерисовать
     */
    refresh() {
        const roomInfo = this.zoneManager?.getCurrentRoomInfo();
        if (roomInfo) {
            this.handleRoomUpdate(roomInfo);
        }
    }
    drawExpBar() {
        const player = this.game.player;
        if (!player) return;
        
        const stats = player.getStats();
        const exp = stats.exp || 0;
        const expToNext = stats.expToNext || 100;
        
        // Полоса во всю ширину 
        const barWidth = 900; 
        const barHeight = 24;
        const x = 0; 
        const y = this.canvas.height - barHeight; 
        
        // Фон
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(x, y, barWidth, barHeight);
        
        // Заливка опыта
        const percent = Math.min(100, (exp / expToNext) * 100);
        const fillWidth = (barWidth * percent) / 100;
        this.ctx.fillStyle = '#ffaa44';
        this.ctx.fillRect(x, y, fillWidth, barHeight);
        
        // Рамка (тонкая)
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, barWidth, barHeight);
        
        // Текст 
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 14px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`${exp}/${expToNext}`, x + 20, y + barHeight/2);
    }
    /**
     * Очистить ресурсы
     */
    destroy() {
        if (this.eventBus) {
            // Отписываемся от событий
        }
        this.canvas.removeEventListener('click', this.handleClick);
        this.backgrounds.clear();
        this.sprites.clear();
    }
}

export { GraphicsEngine };
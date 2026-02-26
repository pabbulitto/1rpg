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
        this.cellSize = 68;        // размер ячейки в пикселях
        this.cols = 13;            // 13 полных ячеек (0-12)
        this.rows = 7;             // 7 полных ячеек (0-6)
        
        // Кэш для загруженных изображений
        this.backgrounds = new Map();  // ключ: "zoneId/roomId"
        this.sprites = new Map();      // ключ: путь к спрайту
        
        // Состояние
        this.currentRoomId = null;
        this.currentZoneId = null;
        this.entities = [];
        this.isInitialized = false;
        this.currentRoomInfo = null;            // сущности с координатами из ZoneManager
        
        // Привязка обработчиков
        this.handleRoomUpdate = this.handleRoomUpdate.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.render = this.render.bind(this);
    }
    
    /**
     * Инициализация движка
     */
    init() {
        // Подписываемся на обновление комнаты
        if (this.eventBus) {
            this.eventBus.on('room:updated', this.handleRoomUpdate);
        }
        
        // Вешаем обработчик клика
        this.canvas.addEventListener('click', this.handleClick);
        
        // Первичный рендер
        const roomInfo = this.zoneManager?.getCurrentRoomInfo();
        if (roomInfo) {
            this.handleRoomUpdate(roomInfo);
        }
        
        console.log('GraphicsEngine: инициализирован');
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
            src = `/assets/backgrounds/${this.currentZoneId}/${this.currentRoomId}.jpg`; // старый шаблон (fallback)
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
    }
    
    /**
     * Нарисовать сущность
     * @param {Object} entity - сущность с координатами
     */
    async _drawEntity(entity) {
        // Пропускаем мертвых (кроме трупов)
        if (entity.state === 'removed') return;
        
        // Вычисляем позицию на canvas
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
    
    /**
     * Обработчик клика по canvas
     * @param {MouseEvent} e
     */
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;
        
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
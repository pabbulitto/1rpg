// ui/components/MapUI.js
class MapUI {
    constructor(container, eventBus, game) {
        this.game = game;
        this.cellSize = 50;
    }
    
    show() {
        const zoneId = this.game.gameState.getPosition().zone;
        const zoneData = this.game.zoneManager?.loadedZones.get(zoneId);
        
        if (!zoneData || !zoneData.rooms) {
            alert('Нет данных для этой зоны');
            return;
        }
        
        const currentRoomId = this.game.gameState.getPosition().room;
        const currentZ = parseInt(currentRoomId.split('z')[1]) || 0;
        
        // Собираем комнаты текущего уровня, парсим координаты из ID
        const rooms = [];
        Object.entries(zoneData.rooms).forEach(([roomId, roomData]) => {
            const roomZ = parseInt(roomId.split('z')[1]) || 0;
            if (roomZ === currentZ) {
                // Парсим x и y из формата "х3у2z-1"
                const matches = roomId.match(/х(\-?\d+)у(\-?\d+)/);
                if (matches) {
                    rooms.push({
                        id: roomId,
                        x: parseInt(matches[1]),
                        y: parseInt(matches[2]),
                        data: roomData,
                        name: roomData.name || roomId
                    });
                }
            }
        });
        
        if (rooms.length === 0) {
            alert('Нет комнат на этом уровне');
            return;
        }
        
        // Находим границы сетки
        let minX = 999, maxX = -999, minY = 999, maxY = -999;
        rooms.forEach(room => {
            minX = Math.min(minX, room.x);
            maxX = Math.max(maxX, room.x);
            minY = Math.min(minY, room.y);
            maxY = Math.max(maxY, room.y);
        });
        
        // Создаем модалку
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(20, 20, 30, 0.95);
            border: 2px solid #4a4a6a;
            border-radius: 12px;
            padding: 15px;
            z-index: 10000;
            max-width: 700px;
            max-height: 480px;
            overflow: auto;
            box-shadow: 0 8px 24px rgba(0,0,0,0.8);
        `;
        
        // Заголовок
        const title = document.createElement('div');
        title.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #4a4a6a;
            color: #ffaa44;
            font-size: 15px;
            font-weight: bold;
        `;
        title.innerHTML = `
            <span>🗺️ ${zoneData.name || 'Карта'} (уровень ${currentZ})</span>
            <button class="close-map-btn" style="background:none; border:none; color:#aaa; font-size:28px; cursor:pointer;">×</button>
        `;
        modal.appendChild(title);
        
        // Контейнер для карты
        const mapContainer = document.createElement('div');
        mapContainer.style.cssText = `
            position: relative;
            width: ${(maxX - minX + 1) * this.cellSize + 20}px;
            height: ${(maxY - minY + 1) * this.cellSize + 20}px;
            margin: 0 auto;
        `;
        
        // Рисуем комнаты
        rooms.forEach(room => {
            const x = (room.x - minX) * this.cellSize + 10;
            const y = (room.y - minY) * this.cellSize + 10;
            const isCurrent = room.id === currentRoomId;
            
            const directions = room.data.directions || {};
            
            // Проверяем наличие переходов в другие зоны
            const hasZoneTransition = Object.values(directions).some(dir => 
                typeof dir === 'string' && dir.includes(':')
            );
            
            // Определяем цвет
            let bgColor = '#333';
            if (isCurrent) bgColor = '#ffaa44';
            else if (hasZoneTransition) bgColor = '#477cf7';
            
            // Определяем, какие стороны рисовать
            const borderColor = isCurrent ? '#fff' : '#666';
            const borderWidth = '2px';
            const borderStyle = `${borderWidth} solid ${borderColor}`;
            
            let borderTop = directions.north ? 'none' : borderStyle;
            let borderRight = directions.east ? 'none' : borderStyle;
            let borderBottom = directions.south ? 'none' : borderStyle;
            let borderLeft = directions.west ? 'none' : borderStyle;
            
            // Создаем клетку
            const cell = document.createElement('div');
            cell.style.cssText = `
                position: absolute;
                left: ${x}px;
                top: ${y}px;
                width: ${this.cellSize-4}px;
                height: ${this.cellSize-4}px;
                background: ${bgColor};
                border-top: ${borderTop};
                border-right: ${borderRight};
                border-bottom: ${borderBottom};
                border-left: ${borderLeft};
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 16px;
                cursor: pointer;
                transition: 0.2s;
            `;
            cell.setAttribute('data-room-id', room.id);
            cell.setAttribute('data-room-name', room.name);
            
            // Добавляем иконки переходов по глубине
            let icons = '';
            if (directions.up) icons += '🔼';
            if (directions.down) icons += '🔽';
            cell.textContent = icons;
            
            cell.addEventListener('mouseenter', () => {
                cell.style.background = isCurrent ? '#ffbb55' : (hasZoneTransition ? '#5a8cf7' : '#444');
            });
            cell.addEventListener('mouseleave', () => {
                cell.style.background = bgColor;
            });
            
            cell.addEventListener('click', (e) => {
                const name = e.currentTarget.dataset.roomName;
                
                // Создаем всплывашку
                const tooltip = document.createElement('div');
                tooltip.textContent = name;
                tooltip.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0, 0, 0, 0.9);
                    color: #ffaa44;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 15px;
                    font-weight: bold;
                    border: 2px solid #4a4a6a;
                    z-index: 10001;
                    pointer-events: none;
                    animation: fadeOut 2.5s ease forwards;
                `;
                
                // Добавляем анимацию
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes fadeOut {
                        0% { opacity: 1; }
                        70% { opacity: 1; }
                        100% { opacity: 0; }
                    }
                `;
                document.head.appendChild(style);
                
                document.body.appendChild(tooltip);
                
                // Удаляем через 2 секунды
                setTimeout(() => {
                    tooltip.remove();
                    style.remove();
                }, 2000);
            });
            
            mapContainer.appendChild(cell);
        });
        
        modal.appendChild(mapContainer);
        document.body.appendChild(modal);
        
        // Закрытие по крестику
        modal.querySelector('.close-map-btn').addEventListener('click', () => {
            modal.remove();
        });
        
        // Закрытие по клику вне
        setTimeout(() => {
            document.addEventListener('click', function closeHandler(e) {
                if (!modal.contains(e.target)) {
                    modal.remove();
                    document.removeEventListener('click', closeHandler);
                }
            });
        }, 10);
    }
}

export { MapUI };
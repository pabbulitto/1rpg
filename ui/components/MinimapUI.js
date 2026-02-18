// ui/components/MinimapUI.js
/**
 * Упрощенный компонент миникарты (как в старом UIManager)
 * Только сетка 7x7 без кнопок и статистики
 */
class MinimapUI {
    constructor(container, eventBus, getMinimapData) {
        this.container = container;
        this.eventBus = eventBus;
        this.getMinimapData = getMinimapData;
        this.unsubscribeFunctions = [];
    }
    
    init() {
        this.render();
        this.subscribeToEvents();
        return this;
    }
    attachCellClickHandlers() {
        const cells = this.container.querySelectorAll('.minimap-cell');
        
        cells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                // Удаляем предыдущий пиптуп если есть
                const existingPopup = this.container.querySelector('.minimap-popup');
                if (existingPopup) {
                    existingPopup.remove();
                }
                
                const title = cell.getAttribute('title');
                if (!title || title === 'Неизвестно') return;
                
                // Создаем пиптуп
                const popup = document.createElement('div');
                popup.className = 'minimap-popup';
                popup.textContent = title;
                
                // Позиционируем над клеткой
                const rect = cell.getBoundingClientRect();
                const containerRect = this.container.getBoundingClientRect();
                
                popup.style.position = 'absolute';
                popup.style.left = `${rect.left - containerRect.left + rect.width/2}px`;
                popup.style.top = `${rect.top - containerRect.top - 35}px`;
                popup.style.transform = 'translateX(-50%)';
                popup.style.zIndex = '1000';
                
                // Стили пиптупа
                popup.style.background = 'rgba(0, 0, 0, 0.8)';
                popup.style.color = 'white';
                popup.style.padding = '5px 10px';
                popup.style.borderRadius = '4px';
                popup.style.fontSize = '12px';
                popup.style.whiteSpace = 'nowrap';
                popup.style.pointerEvents = 'none';
                popup.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
                
                // Добавляем стрелочку
                popup.style.position = 'relative';
                popup.style.marginTop = '10px';
                
                const arrow = document.createElement('div');
                arrow.style.position = 'absolute';
                arrow.style.bottom = '-8px';
                arrow.style.left = '50%';
                arrow.style.transform = 'translateX(-50%)';
                arrow.style.width = '0';
                arrow.style.height = '0';
                arrow.style.borderLeft = '6px solid transparent';
                arrow.style.borderRight = '6px solid transparent';
                arrow.style.borderTop = '8px solid rgba(0, 0, 0, 0.8)';
                
                popup.appendChild(arrow);
                this.container.appendChild(popup);
                
                // Автоудаление через 1.5 секунды
                setTimeout(() => {
                    if (popup.parentNode) {
                        popup.remove();
                    }
                }, 1500);
            });
        });
    }
    subscribeToEvents() {
        const refresh = this.eventBus.on('minimap:refresh', () => this.refreshMinimap());
        this.unsubscribeFunctions.push(refresh);
    }
    
    refreshMinimap() {
        if (typeof this.getMinimapData === 'function') {
            const data = this.getMinimapData();
            if (data) this.update(data);
        }
    }
    
    update(minimapData) {
        if (!minimapData || !minimapData.grid) return;
        
        const { grid, dimensions } = minimapData;
        
        let html = `<div class="minimap-header">${minimapData.zoneName || ''}</div>`;
        html += '<div class="minimap-grid">';
        
        for (let y = 0; y < dimensions.height; y++) {
            for (let x = 0; x < dimensions.width; x++) {
                const cell = grid[y][x];
                const cellClasses = this.getCellClasses(cell);
                const cellContent = this.getCellContent(cell);
                
                html += `<div class="minimap-cell ${cellClasses}" 
               title="${cell.roomId ? (cell.name || 'Комната') : 'Неизвестно'}">${cellContent}</div>`;
            }
        }
        
        html += '</div>';
        
        if (this.container) {
            this.container.innerHTML = html;
            this.attachCellClickHandlers();
        }
    }
    
    getCellClasses(cell) {
        const classes = [];
        
        if (!cell.roomId) {
            classes.push('empty');
            return classes.join(' ');
        }
        
        if (cell.visited) classes.push('visited');
        else classes.push('unvisited');
        
        if (cell.isPlayer) classes.push('player');
        
        if (cell.directions) {
            if (!cell.directions.north) classes.push('no-north');
            if (!cell.directions.south) classes.push('no-south');
            if (!cell.directions.east) classes.push('no-east');
            if (!cell.directions.west) classes.push('no-west');
        }
        
        classes.push('cell-default');
        
        return classes.join(' ');
    }
    
    getCellContent(cell) {
        if (!cell.roomId) return '';
        
        if (cell.directions && (cell.directions.up || cell.directions.down)) {
            return '<i class="fas fa-stairs"></i>';
        }
        
        if (cell.isPlayer) return '<i class="fas fa-user"></i>';
        if (cell.visited) return '<i class="fas fa-map-marker-alt"></i>';
        return '<i class="fas fa-question"></i>';
    }
    
    render() {
        if (!this.container) return;
        this.container.innerHTML = '<div class="loading-minimap">Загрузка миникарты...</div>';
        this.refreshMinimap();
    }

    destroy() {
        this.unsubscribeFunctions.forEach(fn => fn && fn());
        const popups = document.querySelectorAll('.minimap-popup');
        popups.forEach(popup => popup.remove());
        if (this.container) this.container.innerHTML = '';
    }
}

export { MinimapUI };
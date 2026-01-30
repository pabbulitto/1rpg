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
        if (this.container) this.container.innerHTML = '';
    }
}

export { MinimapUI };
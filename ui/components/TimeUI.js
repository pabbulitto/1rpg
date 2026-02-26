// ui/components/TimeUI.js
/**
 * TimeUI - простой виджет игрового времени
 */
class TimeUI {
    constructor(container, eventBus) {
        this.container = container;
        this.eventBus = eventBus;
        this.unsubscribeFunctions = [];
        this.currentTime = null;
    }
    
    init() {
        this.render();
        this.subscribeToEvents();
        return this;
    }
    
    subscribeToEvents() {
        const hourChange = this.eventBus.on('time:hourChange', (data) => {
            this.currentTime = data.gameTime;
            this.updateDisplay();
        });
        
        const seasonChange = this.eventBus.on('time:seasonChange', (data) => {
            this.currentTime = data.gameTime;
            this.updateDisplay();
        });
        
        const timeTick = this.eventBus.on('time:tick', (data) => {
            this.currentTime = data.gameTime;
            this.updateDisplay();
        });
        
        this.unsubscribeFunctions.push(hourChange, seasonChange, timeTick);
    }
    
    getSeasonName(season) {
        const seasons = {
            'spring': '🌱 Весна',
            'summer': '☀️ Лето',
            'autumn': '🍂 Осень',
            'winter': '❄️ Зима'
        };
        return seasons[season] || season;
    }
    
    formatTime(time) {
        if (!time) return '--:--';
        const hour = time.hour.toString().padStart(2, '0');
        const minute = time.minute.toString().padStart(2, '0');
        const season = this.getSeasonName(time.season);
        return `${hour}:${minute} | День ${time.day} | ${season}`;
    }
    
    updateDisplay() {
        if (!this.container || !this.currentTime) return;
        const timeElement = this.container.querySelector('.time-display') || this.container;
        timeElement.textContent = this.formatTime(this.currentTime);
    }
    
    render() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="time-ui">
                <div class="time-header">
                    <h4>Игровое время</h4>
                </div>
                <div class="time-display">
                    ${this.currentTime ? this.formatTime(this.currentTime) : 'Загрузка...'}
                </div>
            </div>
        `;
    }
    
    destroy() {
        this.unsubscribeFunctions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') unsubscribe();
        });
        this.unsubscribeFunctions = [];
        if (this.container) this.container.innerHTML = '';
    }
}

export { TimeUI };
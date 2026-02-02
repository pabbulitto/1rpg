// ui/components/StatsUI.js
/**
 * StatsUI - компонент для отображения характеристик
 * Совместим с UIManager из проекта
 */
class StatsUI {
    /**
     * @param {HTMLElement|string} container - Контейнер или его ID
     */
    constructor(container) {
        if (typeof container === 'string') {
            this.container = document.getElementById(container);
        } else {
            this.container = container;
        }
        
        if (!this.container) {
            console.error('StatsUI: контейнер не найден');
        }
        
        this.currentStats = null;
    }
    
    /**
     * Инициализация (совместима с UIManager)
     * @param {Object} game - Экземпляр игры
     * @returns {boolean} Успешность инициализации
     */
    init(game) {
        if (!this.container) return false;
        
        // Подписываемся на обновление характеристик через eventBus
        if (game && game.gameState && game.gameState.eventBus) {
            game.gameState.eventBus.on('player:statsChanged', (stats) => {
                this.update(stats);
            });
        }
        
        // Первоначальный рендер
        this.render();
        return true;
    }
    
    /**
     * Обновление характеристик
     * @param {Object} stats - Характеристики игрока
     */
    update(stats) {
        if (!stats || !this.container) return;
        
        this.currentStats = stats;
        
        // Генерируем тот же HTML, что и в старом UIManager
        const html = this.generateStatsHTML(stats);
        this.container.innerHTML = html;
    }
    
    /**
     * Генерация HTML (точная копия из старого UIManager)
     */
    generateStatsHTML(stats) {
        return `
            <div class="stats-grid">
                <div class="stats-block">
                    <h3><i class="fas fa-dumbbell"></i> Атрибуты</h3>
                    <div class="stat-row"><span class="stat-label">Сила:</span><span class="stat-value">${stats.strength || 10}</span></div>
                    <div class="stat-row"><span class="stat-label">Ловкость:</span><span class="stat-value">${stats.agility || 10}</span></div>
                    <div class="stat-row"><span class="stat-label">Телосложение:</span><span class="stat-value">${stats.constitution || 10}</span></div>
                    <div class="stat-row"><span class="stat-label">Мудрость:</span><span class="stat-value">${stats.wisdom || 10}</span></div>
                    <div class="stat-row"><span class="stat-label">Интеллект:</span><span class="stat-value">${stats.intelligence || 10}</span></div>
                    <div class="stat-row"><span class="stat-label">Обаяние:</span><span class="stat-value">${stats.charisma || 10}</span></div>
                </div>
                
                <div class="stats-block">
                    <h3><i class="fas fa-fist-raised"></i> Боевые</h3>
                    <div class="stat-row"><span class="stat-label">Атака:</span><span class="stat-value">${stats.attack || 15}</span></div>
                    <div class="stat-row"><span class="stat-label">Защита:</span><span class="stat-value">${stats.defense || 5}</span></div>
                    <div class="stat-row"><span class="stat-label">Попадание:</span><span class="stat-value">${stats.hitChance || 75}%</span></div>
                    <div class="stat-row"><span class="stat-label">Крит шанс:</span><span class="stat-value">${stats.critChance || 5}%</span></div>
                    <div class="stat-row"><span class="stat-label">Сила крита:</span><span class="stat-value">${stats.critPower || 150}%</span></div>
                    <div class="stat-row"><span class="stat-label">Уворот:</span><span class="stat-value">${stats.dodge || 0}%</span></div>
                    <div class="stat-row"><span class="stat-label">Инициатива:</span><span class="stat-value">${stats.initiative || 10}</span></div>
                    <div class="stat-row"><span class="stat-label">Блок:</span><span class="stat-value">${stats.blockChance || 0}%</span></div>
                </div>
                
                <div class="stats-block">
                    <h3><i class="fas fa-heartbeat"></i> Ресурсы</h3>
                    <div class="stat-row"><span class="stat-label">Здоровье:</span><span class="stat-value">${stats.health || 100}/${stats.maxHealth || 100}</span></div>
                    <div class="stat-row"><span class="stat-label">Восст. здоровья:</span><span class="stat-value">+${stats.healthRegen || 0}/ход</span></div>
                    <div class="stat-row"><span class="stat-label">Мана:</span><span class="stat-value">${stats.mana || 50}/${stats.maxMana || 50}</span></div>
                    <div class="stat-row"><span class="stat-label">Восст. маны:</span><span class="stat-value">+${stats.manaRegen || 0}/ход</span></div>
                    <div class="stat-row"><span class="stat-label">Выносливость:</span><span class="stat-value">${stats.stamina || 100}/${stats.maxStamina || 100}</span></div>
                    <div class="stat-row"><span class="stat-label">Восст. вынос.:</span><span class="stat-value">+${stats.staminaRegen || 0}/ход</span></div>
                </div>
                
                <div class="stats-block">
                    <h3><i class="fas fa-shield-alt"></i> Сопротивления</h3>
                    <div class="stat-row"><span class="stat-label">Огонь:</span><span class="stat-value">${stats.fireResistance || 0}%</span></div>
                    <div class="stat-row"><span class="stat-label">Вода:</span><span class="stat-value">${stats.waterResistance || 0}%</span></div>
                    <div class="stat-row"><span class="stat-label">Земля:</span><span class="stat-value">${stats.earthResistance || 0}%</span></div>
                    <div class="stat-row"><span class="stat-label">Воздух:</span><span class="stat-value">${stats.airResistance || 0}%</span></div>
                    <div class="stat-row"><span class="stat-label">Тьма:</span><span class="stat-value">${stats.darkResistance || 0}%</span></div>
                    <div class="stat-row"><span class="stat-label">Яды:</span><span class="stat-value">${stats.poisonResistance || 0}%</span></div>
                    <div class="stat-row"><span class="stat-label">Физ. приёмы:</span><span class="stat-value">${stats.physicalResistance || 0}%</span></div>
                </div>
            </div>
                        
            </div>
        `;
    }
    
    /**
     * Рендер заглушки
     */
    render() {
        if (!this.container) return;
        this.container.innerHTML = '<p class="loading-stats">Загрузка характеристик...</p>';
    }
    
    /**
     * Очистка
     */
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

export { StatsUI };
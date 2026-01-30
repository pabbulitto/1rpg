// ui/components/BattleUI.js
/**
 * BattleUI - только обновляет данные в существующем фрейме боя
 * Не создаёт свой HTML, не управляет видимостью
 */
class BattleUI {
    /**
     * @param {HTMLElement} container - Контейнер (#battle-ui)
     * @param {EventBus} eventBus
     * @param {Function} onAttack
     * @param {Function} onDefense
     * @param {Function} onEscape
     */
    constructor(container, eventBus, onAttack, onDefense, onEscape) {
        this.container = container;
        this.eventBus = eventBus;
        this.onAttack = onAttack;
        this.onDefense = onDefense;
        this.onEscape = onEscape;
        
        this.unsubscribeFunctions = [];
        this.enemyHealthBar = null;
    }
    
    init() {
        this.cacheElements();
        this.subscribeToEvents();
        this.resetUI();
        return this;
    }
    
    cacheElements() {
        // Используем существующие ID из index.html
        this.elements = {
            enemyName: this.container.querySelector('#enemy-name'),
            enemyHealthText: this.container.querySelector('#enemy-health'),
            enemyHealthBar: this.container.querySelector('.enemy-health-bar'), // Если есть
            attackBtn: this.container.querySelector('#attack-btn'),
            potionBtn: this.container.querySelector('#potion-btn'),
            escapeBtn: this.container.querySelector('#escape-btn')
        };
    }
    
    subscribeToEvents() {
        const battleStart = this.eventBus.on('battle:start', (data) => this.onBattleStart(data));
        const battleUpdate = this.eventBus.on('battle:update', (data) => this.onBattleUpdate(data));
        const battleEnd = this.eventBus.on('battle:end', () => this.onBattleEnd());
        
        this.unsubscribeFunctions.push(battleStart, battleUpdate, battleEnd);
    }
    
    onBattleStart(battleData) {
        if (!battleData || !battleData.enemy) return;
        
        // Обновляем имя врага
        if (this.elements.enemyName) {
            this.elements.enemyName.textContent = battleData.enemy.name;
        }
        
        // Обновляем здоровье врага
        this.updateEnemyHealth(battleData.enemy.health, battleData.enemy.maxHealth);
        
        // Включаем кнопки
        this.setButtonsEnabled(true);
        
        // Логи начала боя уже делает BattleService через log:batch
    }
    
    onBattleUpdate(battleData) {
        if (!battleData || !battleData.enemy) return;
        
        // Обновляем здоровье врага
        this.updateEnemyHealth(battleData.enemy.health, battleData.enemy.maxHealth);
        
        // Если есть данные игрока, можно обновить прогресс-бар игрока
        // (но он в другом месте, UIManager обновит через player:statsChanged)
    }
    
    onBattleEnd() {
        // Сбрасываем UI к состоянию "нет боя"
        this.resetUI();
    }
    
    updateEnemyHealth(current, max) {
        if (!this.elements.enemyHealthText) return;
        
        // Текстовое отображение
        this.elements.enemyHealthText.textContent = `${current}/${max}`;
        
        // Прогресс-бар если есть
        if (this.elements.enemyHealthBar) {
            const percent = Math.max(0, (current / max) * 100);
            this.elements.enemyHealthBar.style.width = `${percent}%`;
            
            // Цвет по проценту
            if (percent < 30) {
                this.elements.enemyHealthBar.style.background = '#ff4444';
            } else if (percent < 60) {
                this.elements.enemyHealthBar.style.background = '#ffaa44';
            } else {
                this.elements.enemyHealthBar.style.background = '#44ff44';
            }
        }
    }
    
    setButtonsEnabled(enabled) {
        const btns = [this.elements.attackBtn, this.elements.potionBtn, this.elements.escapeBtn];
        btns.forEach(btn => {
            if (btn) btn.disabled = !enabled;
        });
    }
    
    resetUI() {
        if (this.elements.enemyName) {
            this.elements.enemyName.textContent = '-';
        }
        if (this.elements.enemyHealthText) {
            this.elements.enemyHealthText.textContent = '-/-';
        }
        if (this.elements.enemyHealthBar) {
            this.elements.enemyHealthBar.style.width = '0%';
        }
        
        this.setButtonsEnabled(false);
    }
    
    destroy() {
        this.unsubscribeFunctions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') unsubscribe();
        });
        this.unsubscribeFunctions = [];
    }
}

export { BattleUI };
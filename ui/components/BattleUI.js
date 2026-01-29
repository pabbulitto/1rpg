// ui/components/BattleUI.js
/**
 * BattleUI - компонент интерфейса боя
 */
class BattleUI {
    /**
     * @param {HTMLElement} container - Контейнер для рендеринга
     * @param {EventBus} eventBus - Шина событий
     * @param {Function} onAttack - Callback атаки
     * @param {Function} onDefense - Callback защиты
     * @param {Function} onEscape - Callback побега
     */
    constructor(container, eventBus, onAttack, onDefense, onEscape) {
        this.container = container;
        this.eventBus = eventBus;
        this.onAttack = onAttack;
        this.onDefense = onDefense;
        this.onEscape = onEscape;
        
        this.currentBattle = null;
        this.unsubscribeFunctions = [];
    }
    
    /**
     * Инициализация компонента
     */
    init() {
        this.render();
        this.subscribeToEvents();
        this.bindEvents();
        return this;
    }
    
    /**
     * Подписка на события EventBus
     */
    subscribeToEvents() {
        const battleStart = this.eventBus.on('battle:start', (battleData) => {
            this.onBattleStart(battleData);
        });
        
        const battleUpdate = this.eventBus.on('battle:update', (battleData) => {
            this.onBattleUpdate(battleData);
        });
        
        const battleEnd = this.eventBus.on('battle:end', (result) => {
            this.onBattleEnd(result);
        });
        
        const enemyUpdate = this.eventBus.on('enemy:update', (enemyData) => {
            this.updateEnemyInfo(enemyData);
        });
        
        this.unsubscribeFunctions.push(battleStart, battleUpdate, battleEnd, enemyUpdate);
    }
    
    /**
     * Обработчик начала боя
     */
    onBattleStart(battleData) {
        this.currentBattle = battleData;
        this.show();
        this.updateBattleInfo(battleData);
    }
    
    /**
     * Обработчик обновления боя
     */
    onBattleUpdate(battleData) {
        this.currentBattle = battleData;
        this.updateBattleInfo(battleData);
    }
    
    /**
     * Обработчик окончания боя
     */
    onBattleEnd(result) {
        this.currentBattle = null;
        
        // Показываем результат боя
        this.showBattleResult(result);
        
        // Скрываем интерфейс боя через 3 секунды
        setTimeout(() => {
            this.hide();
        }, 3000);
    }
    
    /**
     * Обновление информации о бое
     */
    updateBattleInfo(battleData) {
        if (!this.container || !battleData) return;
        
        // Обновление информации о враге
        if (battleData.enemy) {
            this.updateEnemyInfo(battleData.enemy);
        }
        
        // Обновление здоровья игрока
        if (battleData.player) {
            this.updatePlayerHealth(battleData.player.health, battleData.player.maxHealth);
        }
    }
    
    /**
     * Обновление информации о враге
     */
    updateEnemyInfo(enemy) {
        if (!this.container) return;
        
        const enemyName = this.container.querySelector('#enemy-name');
        const enemyHealth = this.container.querySelector('#enemy-health');
        const healthBar = this.container.querySelector('.enemy-health-bar');
        
        if (enemyName) enemyName.textContent = enemy.name || 'Враг';
        if (enemyHealth) enemyHealth.textContent = `${enemy.health || 0}/${enemy.maxHealth || 0}`;
        
        if (healthBar && enemy.maxHealth) {
            const healthPercent = Math.max(0, (enemy.health / enemy.maxHealth) * 100);
            healthBar.style.width = `${healthPercent}%`;
            
            // Цвет полоски здоровья
            if (healthPercent < 30) {
                healthBar.style.background = '#ff4444';
            } else if (healthPercent < 60) {
                healthBar.style.background = '#ffaa44';
            } else {
                healthBar.style.background = '#44ff44';
            }
        }
    }
    
    /**
     * Обновление здоровья игрока
     */
    updatePlayerHealth(current, max) {
        if (!this.container) return;
        
        const playerHealth = this.container.querySelector('#player-health-battle');
        if (playerHealth) {
            playerHealth.textContent = `${current}/${max}`;
        }
    }
    
    /**
     * Показать результат боя
     */
    showBattleResult(result) {
        if (!this.container) return;
        
        const resultElement = document.createElement('div');
        resultElement.className = `battle-result ${result.victory ? 'victory' : 'defeat'}`;
        
        if (result.victory) {
            resultElement.innerHTML = `
                <h3><i class="fas fa-trophy"></i> ПОБЕДА!</h3>
                <p>Получено: ${result.exp || 0} опыта, ${result.gold || 0} золота</p>
                ${result.dropName ? `<p>Добыча: ${result.dropName}</p>` : ''}
            `;
        } else {
            resultElement.innerHTML = `
                <h3><i class="fas fa-skull-crossbones"></i> ПОРАЖЕНИЕ</h3>
                <p>Вы потерпели поражение...</p>
            `;
        }
        
        this.container.appendChild(resultElement);
        
        // Удалить через 3 секунды
        setTimeout(() => {
            if (resultElement.parentNode) {
                resultElement.parentNode.removeChild(resultElement);
            }
        }, 3000);
    }
    
    /**
     * Привязка обработчиков событий
     */
    bindEvents() {
        if (!this.container) return;
        
        this.container.addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.id === 'attack-btn' || target.closest('#attack-btn')) {
                if (typeof this.onAttack === 'function') {
                    this.onAttack();
                }
                return;
            }
            
            if (target.id === 'potion-btn' || target.closest('#potion-btn')) {
                if (typeof this.onDefense === 'function') {
                    this.onDefense();
                }
                return;
            }
            
            if (target.id === 'escape-btn' || target.closest('#escape-btn')) {
                if (typeof this.onEscape === 'function') {
                    this.onEscape();
                }
                return;
            }
        });
    }
    
    /**
     * Полный рендеринг компонента
     */
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="battle-ui">
                <div class="battle-header">
                    <h2><i class="fas fa-fist-raised"></i> Бой</h2>
                    <div class="battle-status" id="battle-status">Ожидание боя...</div>
                </div>
                
                <div class="enemy-info">
                    <h3 id="enemy-name">-</h3>
                    <div class="enemy-health-container">
                        <div class="enemy-health-bar"></div>
                        <span class="enemy-health-text" id="enemy-health">-/-</span>
                    </div>
                </div>
                
                <div class="player-info">
                    <div class="player-health">
                        <span>Ваше здоровье:</span>
                        <span id="player-health-battle">-/-</span>
                    </div>
                </div>
                
                <div class="battle-actions">
                    <button id="attack-btn" class="btn btn-danger">
                        <i class="fas fa-swords"></i> Атаковать
                    </button>
                    <button id="potion-btn" class="btn btn-secondary">
                        <i class="fas fa-shield-alt"></i> Защита
                    </button>
                    <button id="escape-btn" class="btn btn-warning">
                        <i class="fas fa-running"></i> Бежать
                    </button>
                </div>
                
                <div class="battle-tips">
                    <p><i class="fas fa-info-circle"></i> Используйте защиту, чтобы снизить урон</p>
                </div>
            </div>
        `;
    }
    
    /**
     * Показать компонент
     */
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.container.classList.add('active');
        }
    }
    
    /**
     * Скрыть компонент
     */
    hide() {
        if (this.container) {
            this.container.classList.remove('active');
            setTimeout(() => {
                if (this.container) {
                    this.container.style.display = 'none';
                }
            }, 300);
        }
    }
    
    /**
     * Очистка компонента
     */
    destroy() {
        this.unsubscribeFunctions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') unsubscribe();
        });
        this.unsubscribeFunctions = [];
        
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

export { BattleUI };

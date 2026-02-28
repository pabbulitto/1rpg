// ui/components/CharacterCreationUI.js

class CharacterCreationUI {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container - контейнер для модалки
     * @param {Object} options.dataService - экземпляр DataService
     * @param {Function} options.onComplete - колбэк при завершении (получает {name, raceId, classId, finalStats})
     */
    constructor({ container, dataService, onComplete }) {
        this.container = container;
        this.dataService = dataService;
        this.onComplete = onComplete;
        
        // Состояние
        this.selectedRace = ''; 
        this.selectedClass = '';  
        this.spentPoints = {
            strength: 0,
            dexterity: 0,
            constitution: 0,
            intelligence: 0,
            wisdom: 0,
            charisma: 0
        };
        this.freePoints = 13;
        this.playerName = 'Герой';
        
        // Данные (будут загружены)
        this.races = {};
        this.classes = {};
        this.currentRaceData = null;
        this.currentClassData = null;
    }
    
    init() {
        // Загружаем данные
        this.races = this.dataService.getAllRaces();
        this.classes = this.dataService.getAllProfessions();
        
        // Устанавливаем начальные данные
        this.currentRaceData = this.dataService.getRaceData(this.selectedRace);
        this.currentClassData = this.dataService.getProfessionData(this.selectedClass);
        
        // Рендерим
        this.render();
        this.attachEvents();
    }
    
    // Вычисление текущего значения характеристики
    getCurrentStatValue(statName) {
        const baseValue = this.currentClassData?.baseStats?.[statName] || 0;
        const raceBonus = this.currentRaceData?.bonuses?.[statName] || 0;
        const spent = this.spentPoints[statName] || 0;
        return baseValue + spent + raceBonus;
    }
    
    // Получение максимума для характеристики
    getStatMax(statName) {
        const classMax = this.currentClassData?.statRanges?.[statName]?.max || 30;
        const raceBonus = this.currentRaceData?.bonuses?.[statName] || 0;
        
        // Максимум для отображения = классовый максимум + бонус расы
        return classMax + raceBonus;
    }
    
    // Проверка можно ли добавить очко
    canAddPoint(statName) {
        if (this.freePoints <= 0) return false;
        
        const baseValue = this.currentClassData?.baseStats?.[statName] || 0;
        const spent = this.spentPoints[statName] || 0;
        const currentWithoutRace = baseValue + spent; // значение без учёта расы
        const max = this.currentClassData?.statRanges?.[statName]?.max || 30;
        
        // Проверяем только базовое + распределённые, бонус расы НЕ учитывается
        return currentWithoutRace < max;
    }

    canRemovePoint(statName) {
        return (this.spentPoints[statName] || 0) > 0;
    }
    
    // Добавить очко
    addPoint(statName) {
        if (!this.canAddPoint(statName)) return;
        
        this.spentPoints[statName] = (this.spentPoints[statName] || 0) + 1;
        this.freePoints--;
        this.updateStatsDisplay();
    }
    
    // Убрать очко
    removePoint(statName) {
        if (!this.canRemovePoint(statName)) return;
        
        this.spentPoints[statName]--;
        this.freePoints++;
        this.updateStatsDisplay();
    }
    
    // Собрать итоговые статы
    getFinalStats() {
        const finalStats = {};
        const statNames = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
        
        statNames.forEach(statName => {
            finalStats[statName] = this.getCurrentStatValue(statName);
        });
        
        return finalStats;
    }
    
    // Завершить создание
    complete() {
        if (this.freePoints !== 0) return; // Нельзя завершить если не все очки потрачены
        
        const finalStats = this.getFinalStats();
        this.onComplete({
            name: this.playerName,
            raceId: this.selectedRace,
            classId: this.selectedClass,
            finalStats
        });
        
        this.hide();
    }
    
    // Показать модалку
    show() {
        this.container.style.display = 'flex';
    }
    
    // Скрыть модалку
    hide() {
        this.container.style.display = 'none';
    }
    
    // Обновить отображение характеристик
    updateStatsDisplay() {
        const statElements = this.container.querySelectorAll('.stat-row');
        const freePointsEl = this.container.querySelector('.free-points');
        
        if (freePointsEl) {
            freePointsEl.textContent = this.freePoints;
        }
        
        statElements.forEach(row => {
            const statName = row.dataset.stat;
            const currentValue = this.getCurrentStatValue(statName);
            const maxValue = this.getStatMax(statName);
            const valueEl = row.querySelector('.stat-current');
            const maxEl = row.querySelector('.stat-max');
            const minusBtn = row.querySelector('.stat-minus');
            const plusBtn = row.querySelector('.stat-plus');
            
            if (valueEl) valueEl.textContent = currentValue;
            if (maxEl) maxEl.textContent = maxValue;
            if (minusBtn) minusBtn.disabled = !this.canRemovePoint(statName);
            if (plusBtn) plusBtn.disabled = !this.canAddPoint(statName);
        });
        
        // Кнопка "Начать игру"
        const startBtn = this.container.querySelector('#start-game-btn');
        if (startBtn) {
            startBtn.disabled = this.freePoints !== 0;
        }
    }
    
    // Обновить при смене расы/класса
    updateFromSelection() {
        this.currentRaceData = this.dataService.getRaceData(this.selectedRace);
        this.currentClassData = this.dataService.getProfessionData(this.selectedClass);
        
        // Сбрасываем распределение очков
        this.spentPoints = {
            strength: 0,
            dexterity: 0,
            constitution: 0,
            intelligence: 0,
            wisdom: 0,
            charisma: 0
        };
        this.freePoints = this.currentClassData?.freePoints || 13;
        
        // Обновляем описания
        const raceDescEl = this.container.querySelector('#race-description');
        const classDescEl = this.container.querySelector('#class-description');
        
        if (raceDescEl && this.currentRaceData) {
            raceDescEl.textContent = this.currentRaceData.description || '';
        }
        
        if (classDescEl && this.currentClassData) {
            classDescEl.textContent = this.currentClassData.description || '';
        }
        
        this.updateStatsDisplay();
    }
    
    // Привязать события
    attachEvents() {
        // Выбор расы
        const raceSelect = this.container.querySelector('#race-select');
        if (raceSelect) {
            raceSelect.addEventListener('change', (e) => {
                this.selectedRace = e.target.value;
                this.updateFromSelection();
            });
        }
        
        // Выбор класса
        const classSelect = this.container.querySelector('#class-select');
        if (classSelect) {
            classSelect.addEventListener('change', (e) => {
                this.selectedClass = e.target.value;
                this.updateFromSelection();
            });
        }
        
        // Имя
        const nameInput = this.container.querySelector('#player-name-input');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.playerName = e.target.value || 'Герой';
            });
        }
        
        // Кнопки + и - (делегирование)
        this.container.addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.classList.contains('stat-plus')) {
                const statRow = target.closest('.stat-row');
                if (statRow) {
                    const statName = statRow.dataset.stat;
                    this.addPoint(statName);
                }
            }
            
            if (target.classList.contains('stat-minus')) {
                const statRow = target.closest('.stat-row');
                if (statRow) {
                    const statName = statRow.dataset.stat;
                    this.removePoint(statName);
                }
            }
            
            if (target.id === 'start-game-btn') {
                this.complete();
            }
            
            if (target.classList.contains('close-modal')) {
                this.hide();
            }
        });
    }
    
    // Рендер HTML
    render() {
        const raceOptions = '<option value="" disabled selected>— Раса —</option>' + 
            Object.entries(this.races).map(([id, race]) => 
                `<option value="${id}" ${id === this.selectedRace ? 'selected' : ''}>${race.name}</option>`
        ).join('');
        
        const classOptions = '<option value="" disabled selected>— Профессия —</option>' + 
            Object.entries(this.classes).map(([id, cls]) => 
                `<option value="${id}" ${id === this.selectedClass ? 'selected' : ''}>${cls.name}</option>`
        ).join('');
        
        this.container.innerHTML = `
            <div class="modal-overlay">
                <div class="creation-modal">
                    <div class="modal-header">
                        <h2>СОЗДАНИЕ ПЕРСОНАЖА</h2>
                        <button class="close-modal">&times;</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="input-row">
                            <label>Имя:</label>
                            <input type="text" id="player-name-input" value="${this.playerName}">
                        </div>
                        
                        <div class="selection-row">
                            <div class="selection-box">
                                <select id="race-select" class="selection-select">
                                    ${raceOptions}
                                </select>
                                <div id="race-description" class="selection-description">
                                    ${this.currentRaceData?.description || ''}
                                </div>
                            </div>
                            
                            <div class="selection-box">
                                <select id="class-select" class="selection-select">
                                    ${classOptions}
                                </select>
                                <div id="class-description" class="selection-description">
                                    ${this.currentClassData?.description || ''}
                                </div>
                            </div>
                        </div>
                        
                        <div class="stats-header">
                            <h3>ХАРАКТЕРИСТИКИ</h3>
                            <span class="free-points">${this.freePoints}</span>
                        </div>
                        
                        <div class="stats-grid">
                            <div class="stat-row" data-stat="strength">
                                <span class="stat-name">Сила:</span>
                                <button class="stat-minus" ${!this.canRemovePoint('strength') ? 'disabled' : ''}>−</button>
                                <span class="stat-current">${this.getCurrentStatValue('strength')}</span>
                                <span class="stat-separator">/</span>
                                <span class="stat-max">${this.getStatMax('strength')}</span>
                                <button class="stat-plus" ${!this.canAddPoint('strength') ? 'disabled' : ''}>+</button>
                            </div>
                            
                            <div class="stat-row" data-stat="dexterity">
                                <span class="stat-name">Ловкость:</span>
                                <button class="stat-minus" ${!this.canRemovePoint('dexterity') ? 'disabled' : ''}>−</button>
                                <span class="stat-current">${this.getCurrentStatValue('dexterity')}</span>
                                <span class="stat-separator">/</span>
                                <span class="stat-max">${this.getStatMax('dexterity')}</span>
                                <button class="stat-plus" ${!this.canAddPoint('dexterity') ? 'disabled' : ''}>+</button>
                            </div>
                            
                            <div class="stat-row" data-stat="constitution">
                                <span class="stat-name">Телосложение:</span>
                                <button class="stat-minus" ${!this.canRemovePoint('constitution') ? 'disabled' : ''}>−</button>
                                <span class="stat-current">${this.getCurrentStatValue('constitution')}</span>
                                <span class="stat-separator">/</span>
                                <span class="stat-max">${this.getStatMax('constitution')}</span>
                                <button class="stat-plus" ${!this.canAddPoint('constitution') ? 'disabled' : ''}>+</button>
                            </div>
                            
                            <div class="stat-row" data-stat="intelligence">
                                <span class="stat-name">Интеллект:</span>
                                <button class="stat-minus" ${!this.canRemovePoint('intelligence') ? 'disabled' : ''}>−</button>
                                <span class="stat-current">${this.getCurrentStatValue('intelligence')}</span>
                                <span class="stat-separator">/</span>
                                <span class="stat-max">${this.getStatMax('intelligence')}</span>
                                <button class="stat-plus" ${!this.canAddPoint('intelligence') ? 'disabled' : ''}>+</button>
                            </div>
                            
                            <div class="stat-row" data-stat="wisdom">
                                <span class="stat-name">Мудрость:</span>
                                <button class="stat-minus" ${!this.canRemovePoint('wisdom') ? 'disabled' : ''}>−</button>
                                <span class="stat-current">${this.getCurrentStatValue('wisdom')}</span>
                                <span class="stat-separator">/</span>
                                <span class="stat-max">${this.getStatMax('wisdom')}</span>
                                <button class="stat-plus" ${!this.canAddPoint('wisdom') ? 'disabled' : ''}>+</button>
                            </div>
                            
                            <div class="stat-row" data-stat="charisma">
                                <span class="stat-name">Харизма:</span>
                                <button class="stat-minus" ${!this.canRemovePoint('charisma') ? 'disabled' : ''}>−</button>
                                <span class="stat-current">${this.getCurrentStatValue('charisma')}</span>
                                <span class="stat-separator">/</span>
                                <span class="stat-max">${this.getStatMax('charisma')}</span>
                                <button class="stat-plus" ${!this.canAddPoint('charisma') ? 'disabled' : ''}>+</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button id="start-game-btn" class="btn-start" ${this.freePoints !== 0 ? 'disabled' : ''}>
                            НАЧАТЬ ИГРУ
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

export { CharacterCreationUI };
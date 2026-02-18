class TimeSystem {
    constructor(gameState) {
        this.gameState = gameState;
        
        this.currentTick = 0;
        this.tickInterval = 7000; // 7 секунд = 1 игровой тик
        this.isRunning = false;
        this.tickTimer = null;
        
        // Регистры подписчиков
        this.effectSubscribers = new Set();     // Эффекты с длительностью
        this.zoneSubscribers = new Set();       // Зоны для респавна
        this.conditionSubscribers = new Set();  // Условия (голод, жажда)
        this.customSubscribers = new Map();     // Кастомные подписчики {id: callback}
        
        // Игровое время (24-часовой цикл)
        this.gameTime = {
            hour: 8,      // 8:00 утра
            minute: 0,
            day: 1,
            season: 'spring'
        };
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log('TimeSystem: запущено');
        
        // Запускаем тикер (можно заменить на requestAnimationFrame для паузы)
        this.tickTimer = setInterval(() => this.processTick(), this.tickInterval);
        
        // Регистрируем системы, которые уже существуют
        this.registerExistingSystems();
    }
    
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        clearInterval(this.tickTimer);
        this.tickTimer = null; 
        
        this.effectSubscribers.clear();
        this.zoneSubscribers.clear();
        this.conditionSubscribers.clear();
        this.customSubscribers.clear();
        
        console.log('TimeSystem: остановлено');
    }    
    
    processTick() {
        this.currentTick++;
        
        // Обновляем игровое время 
        this.updateGameTime();
        
        // Обрабатываем подписчиков в порядке приоритета
        const results = {
            effectsExpired: 0,
            monstersRespawned: 0,
            conditionsUpdated: 0
        };
        
        // 1. Эффекты (самый высокий приоритет)
        for (const effect of this.effectSubscribers) {
            if (effect.onTimeTick) {
                const result = effect.onTimeTick();
                if (result === 'expired') {
                    results.effectsExpired++;
                }
            }
        }
        
        // 2. Условия (голод, жажда, отравление)
        for (const conditionHandler of this.conditionSubscribers) {
            if (typeof conditionHandler === 'function') {
                conditionHandler(this.gameTime);
            }
        }
        
        // 3. Зоны и респавн
        for (const zoneHandler of this.zoneSubscribers) {
            if (typeof zoneHandler === 'function') {
                const respawns = zoneHandler(this.currentTick);
                if (respawns) results.monstersRespawned += respawns;
            }
        }
        
        // 4. Кастомные подписчики
        for (const [id, callback] of this.customSubscribers) {
            if (typeof callback === 'function') {
                callback(this.currentTick, this.gameTime);
            }
        }
        
        // Отправляем событие о тике
        this.emitTimeEvent('tick', {
            tick: this.currentTick,
            gameTime: {...this.gameTime},
            results
        });
        
        // Сохраняем состояние каждые 10 тиков
        if (this.currentTick % 10 === 0) {
            this.saveTimeState();
        }
        
        return results;
    }
    
    updateGameTime() {
        // 1 тик = 1 минут игрового времени
        this.gameTime.minute += 1;
        
        if (this.gameTime.minute >= 60) {
            this.gameTime.minute = 0;
            this.gameTime.hour++;
            
            if (this.gameTime.hour >= 24) {
                this.gameTime.hour = 0;
                this.gameTime.day++;
                
                // Смена сезона каждые 30 дней
                if (this.gameTime.day % 30 === 0) {
                    this.cycleSeason();
                }
            }
            
            // Событие смены часа
            this.emitTimeEvent('hourChange', {
                hour: this.gameTime.hour,
                day: this.gameTime.day
            });
        }
    }
    
    cycleSeason() {
        const seasons = ['spring', 'summer', 'autumn', 'winter'];
        const currentIndex = seasons.indexOf(this.gameTime.season);
        this.gameTime.season = seasons[(currentIndex + 1) % seasons.length];
        
        this.emitTimeEvent('seasonChange', {
            season: this.gameTime.season,
            day: this.gameTime.day
        });
    }
    
    // Регистрация подписчиков
    registerEffect(effect) {
        this.effectSubscribers.add(effect);
        return () => this.unregisterEffect(effect);
    }
    
    unregisterEffect(effect) {
        this.effectSubscribers.delete(effect);
    }
    
    registerZone(zoneId, respawnHandler) {
        this.zoneSubscribers.add(respawnHandler);
        return () => this.zoneSubscribers.delete(respawnHandler);
    }
    
    registerCondition(conditionHandler) {
        this.conditionSubscribers.add(conditionHandler);
        return () => this.conditionSubscribers.delete(conditionHandler);
    }
    
    registerCustom(id, callback) {
        this.customSubscribers.set(id, callback);
        return () => this.customSubscribers.delete(id);
    }
    
    // Регистрация существующих систем из GameState
    registerExistingSystems() {
        // Регистрируем условия из GameState
        const gameState = window.game?.gameState;
        if (gameState && gameState.conditions) {
            this.registerCondition(() => {
            });
        }
    }
    
    // События времени
    emitTimeEvent(eventType, data) {
        // ВСЕ уведомления через EventBus
        if (window.EventBus) {
            window.EventBus.emit(`time:${eventType}`, data);
        }
        
        // Логирование ТОЛЬКО смены часа (опционально, можно убрать совсем)
        if ((eventType === 'hourChange' || eventType === 'seasonChange') && console.debug) {
            console.debug(`[TimeSystem] ${eventType}:`, data);
        }
    }
    
    // Форматирование времени для UI
    formatTime() {
        const hour = this.gameTime.hour.toString().padStart(2, '0');
        const minute = this.gameTime.minute.toString().padStart(2, '0');
        return `${hour}:${minute}, День ${this.gameTime.day}, ${this.getSeasonName()}`;
    }
    
    getSeasonName() {
        const seasons = {
            spring: 'Весна',
            summer: 'Лето', 
            autumn: 'Осень',
            winter: 'Зима'
        };
        return seasons[this.gameTime.season] || this.gameTime.season;
    }
    
    // Сохранение/загрузка
    saveTimeState() {
        const state = {
            currentTick: this.currentTick,
            gameTime: {...this.gameTime},
            isRunning: this.isRunning
        };
        
        // Сохраняем в GameState для сериализации
        if (this.gameState) {
            this.gameState.timeState = state;
        }
        
        return state;
    }
    
    loadTimeState(state) {
        if (!state) return;
        
        this.currentTick = state.currentTick || 0;
        this.gameTime = {...state.gameTime} || this.gameTime;
        this.isRunning = state.isRunning || false;
        
        if (this.isRunning && !this.tickTimer) {
            this.start();
        }
    }
    
    // Утилиты
    getCurrentTick() {
        return this.currentTick;
    }
    
    getGameTime() {
        return {...this.gameTime};
    }
    
    setTickInterval(ms) {
        this.tickInterval = ms;
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }
    
    // Быстрое перемещение времени (для тестов)
    fastForward(ticks) {
        for (let i = 0; i < ticks; i++) {
            this.processTick();
        }
    }
}


export { TimeSystem };


// core/Lifetime.js

/**
 * Lifetime - единая система учёта времени для всех временных объектов
 * 
 * Где используется:
 * - Трупы (Corpse) — время до распада
 * - Предметы (Item) — срок жизни
 * - Эффекты (BaseEffect) — длительность
 * - Зоны (Zone) — время до респавна
 * - Баффы/дебаффы — длительность действия
 * 
 * Принцип:
 * - Время измеряется в ТИКАХ (1 тик = 7 секунд в TimeSystem)
 * - Объект сам не тикает, его тикает владелец
 * - Поддерживает паузу (например, предмет в инвентаре не стареет)
 */
class Lifetime {
    /**
     * @param {number} initialTicks - начальное количество тиков
     * @param {Function} onExpire - callback при истечении
     * @param {Object} options - опции
     * @param {boolean} options.startPaused - начать с паузой
     * @param {number} options.elapsedTicks - уже прошедшие тики (для загрузки)
     */
    constructor(initialTicks, onExpire, options = {}) {
        this.maxTicks = initialTicks;
        this.remainingTicks = options.elapsedTicks !== undefined 
            ? Math.max(0, initialTicks - options.elapsedTicks)
            : initialTicks;
        
        this.onExpire = onExpire;
        this.isPaused = options.startPaused || false;
        this.isExpired = false;
        
        // Метаданные
        this.createdAt = Date.now();
        this.id = `lifetime_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
    
    /**
     * Тик времени — уменьшает оставшееся время
     * @returns {boolean} true если истёк
     */
    tick() {
        if (this.isExpired) return true;
        if (this.isPaused) return false;
        
        this.remainingTicks--;
        
        if (this.remainingTicks <= 0) {
            this.expire();
            return true;
        }
        
        return false;
    }
    
    /**
     * Принудительно истечь
     */
    expire() {
        if (this.isExpired) return;
        
        this.isExpired = true;
        this.remainingTicks = 0;
        
        if (this.onExpire) {
            this.onExpire();
        }
    }
    
    /**
     * Поставить на паузу (время не тикает)
     */
    pause() {
        this.isPaused = true;
    }
    
    /**
     * Снять с паузы
     */
    resume() {
        this.isPaused = false;
    }
    
    /**
     * Добавить время
     * @param {number} ticks 
     */
    addTime(ticks) {
        this.remainingTicks += ticks;
        this.isExpired = false;
    }
    
    /**
     * Установить новое время
     * @param {number} ticks 
     */
    setTime(ticks) {
        this.remainingTicks = ticks;
        this.isExpired = false;
    }
    
    /**
     * Получить прогресс в процентах (0-100)
     * @returns {number}
     */
    getProgress() {
        if (this.maxTicks === 0) return 0;
        const elapsed = this.maxTicks - this.remainingTicks;
        return Math.min(100, Math.max(0, (elapsed / this.maxTicks) * 100));
    }
    
    /**
     * Получить оставшееся время в секундах (для UI)
     * @param {number} secondsPerTick - секунд на тик (по умолч. 7)
     * @returns {number}
     */
    getRemainingSeconds(secondsPerTick = 7) {
        return Math.ceil(this.remainingTicks * secondsPerTick);
    }
    
    /**
     * Сериализация для сохранений
     */
    toJSON() {
        return {
            maxTicks: this.maxTicks,
            remainingTicks: this.remainingTicks,
            isPaused: this.isPaused,
            isExpired: this.isExpired
        };
    }
    
    /**
     * Загрузка из сохранения
     * @param {Object} data 
     * @param {Function} onExpire 
     * @returns {Lifetime}
     */
    static fromJSON(data, onExpire) {
        if (!data) return null;
        
        const elapsed = data.maxTicks - data.remainingTicks;
        
        return new Lifetime(data.maxTicks, onExpire, {
            elapsedTicks: elapsed,
            startPaused: data.isPaused || false
        });
    }
}

export { Lifetime };
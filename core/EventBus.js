// core/EventBus.js
/**
 * Простая система событий для коммуникации между модулями.
 * Паттерн Publisher-Subscriber.
 */
class EventBus {
    constructor() {
        this.events = new Map(); // eventName -> Set<callbacks>
    }

    /**
     * Подписаться на событие
     * @param {string} eventName - Имя события
     * @param {Function} callback - Функция-обработчик
     * @returns {Function} Функция для отписки
     */
    on(eventName, callback) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, new Set());
        }
        this.events.get(eventName).add(callback);
        
        // Возвращаем функцию для отписки
        return () => this.off(eventName, callback);
    }

    /**
     * Отписаться от события
     * @param {string} eventName - Имя события
     * @param {Function} callback - Функция-обработчик
     */
    off(eventName, callback) {
        if (this.events.has(eventName)) {
            this.events.get(eventName).delete(callback);
        }
    }

    /**
     * Отправить событие
     * @param {string} eventName - Имя события
     * @param {any} data - Данные события
     */
    emit(eventName, data = null) {
        if (this.events.has(eventName)) {
            const callbacks = this.events.get(eventName);
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`EventBus: ошибка в обработчике ${eventName}:`, error);
                }
            });
        }
    }

    /**
     * Подписаться на событие один раз
     * @param {string} eventName - Имя события
     * @param {Function} callback - Функция-обработчик
     * @returns {Function} Функция для отписки
     */
    once(eventName, callback) {
        const onceCallback = (data) => {
            this.off(eventName, onceCallback);
            callback(data);
        };
        return this.on(eventName, onceCallback);
    }

    /**
     * Очистить все подписки на событие
     * @param {string} eventName - Имя события
     */
    clear(eventName) {
        if (eventName) {
            this.events.delete(eventName);
        } else {
            this.events.clear();
        }
    }

    /**
     * Проверить, есть ли подписчики на событие
     * @param {string} eventName - Имя события
     * @returns {boolean}
     */
    hasSubscribers(eventName) {
        return this.events.has(eventName) && this.events.get(eventName).size > 0;
    }
}

export { EventBus };
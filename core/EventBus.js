// core/EventBus.js
import EventTypes from './EventTypes.js';

/**
 * Простая система событий для коммуникации между модулями.
 * Паттерн Publisher-Subscriber.
 * Поддерживает как строки, так и EventTypes.
 */
class EventBus {
    constructor() {
        this.events = new Map(); // eventName -> Set<callbacks>
    }

    /**
     * Подписаться на событие
     * @param {string|symbol} eventName - Имя события (можно использовать EventTypes)
     * @param {Function} callback - Функция-обработчик
     * @returns {Function} Функция для отписки
     */
    on(eventName, callback) {
        const key = eventName.toString();
        if (!this.events.has(key)) {
            this.events.set(key, new Set());
        }
        this.events.get(key).add(callback);
        
        return () => this.off(eventName, callback);
    }

    /**
     * Отписаться от события
     * @param {string|symbol} eventName - Имя события
     * @param {Function} callback - Функция-обработчик
     */
    off(eventName, callback) {
        const key = eventName.toString();
        if (this.events.has(key)) {
            this.events.get(key).delete(callback);
        }
    }

    /**
     * Отправить событие
     * @param {string|symbol} eventName - Имя события
     * @param {any} data - Данные события
     */
    emit(eventName, data = null) {
        const key = eventName.toString();
        if (this.events.has(key)) {
            const callbacks = this.events.get(key);
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`EventBus: ошибка в обработчике ${key}:`, error);
                }
            });
        }
    }

    /**
     * Подписаться на событие один раз
     * @param {string|symbol} eventName - Имя события
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
     * @param {string|symbol} eventName - Имя события
     */
    clear(eventName) {
        const key = eventName?.toString();
        if (key) {
            this.events.delete(key);
        } else {
            this.events.clear();
        }
    }

    /**
     * Проверить, есть ли подписчики на событие
     * @param {string|symbol} eventName - Имя события
     * @returns {boolean}
     */
    hasSubscribers(eventName) {
        const key = eventName.toString();
        return this.events.has(key) && this.events.get(key).size > 0;
    }
    
    /**
     * Получить список всех зарегистрированных событий
     * @returns {string[]}
     */
    getRegisteredEvents() {
        return Array.from(this.events.keys());
    }
}

export { EventBus };
export default EventBus;
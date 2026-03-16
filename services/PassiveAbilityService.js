// services/PassiveAbilityService.js
import { PassiveAbility } from '../core/PassiveAbility.js';

/**
 * PassiveAbilityService - глобальный сервис для работы с шаблонами пассивных способностей
 * 
 * Отвечает только за:
 * - Загрузку шаблонов из JSON
 * - Предоставление доступа к шаблонам
 * 
 * НЕ хранит состояние персонажей!
 * НЕ применяет способности!
 */
class PassiveAbilityService {
    constructor(eventBus, formulaParser) {
        this.eventBus = eventBus;
        this.formulaParser = formulaParser;
        this.passives = new Map(); // id -> PassiveAbility
        this.initialized = false;
    }

    /**
     * Загрузить пассивные способности из JSON
     * @param {Object} data - данные из passive-abilities.json
     */
    loadPassives(data) {
        this.passives.clear();

        for (const [id, passiveData] of Object.entries(data)) {
            const passive = new PassiveAbility(id, passiveData);
            this.passives.set(id, passive);
        }

        this.initialized = true;
        console.log(`PassiveAbilityService: загружено ${this.passives.size} шаблонов пассивных способностей`);
    }

    /**
     * Получить шаблон пассивной способности по ID
     * @param {string} passiveId
     * @returns {PassiveAbility|null}
     */
    getPassive(passiveId) {
        return this.passives.get(passiveId) || null;
    }

    /**
     * Получить все шаблоны пассивных способностей
     * @returns {Array<PassiveAbility>}
     */
    getAllPassives() {
        return Array.from(this.passives.values());
    }

    /**
     * Получить шаблоны, доступные для изучения персонажем определенного класса
     * @param {string} characterClass - класс персонажа
     * @returns {Array<PassiveAbility>}
     */
    getPassivesForClass(characterClass) {
        const result = [];
        for (const passive of this.passives.values()) {
            // Если classes не указаны - доступно всем
            if (passive.classes.length === 0 || passive.classes.includes(characterClass)) {
                result.push(passive);
            }
        }
        return result;
    }

    /**
     * Проверить, инициализирован ли сервис
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Получить статистику для отладки
     * @returns {Object}
     */
    getStats() {
        return {
            totalPassives: this.passives.size,
            initialized: this.initialized
        };
    }
}

export { PassiveAbilityService };
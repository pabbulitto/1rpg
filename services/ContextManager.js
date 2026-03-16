// services/ContextManager.js

/**
 * ContextManager - сервис для отслеживания контекста персонажа
 * 
 * Собирает и хранит информацию о:
 * - местности (terrain)
 * - типе оружия (weaponType)
 * - времени суток (timeOfDay)
 * - сезоне (season)
 * - здоровье (healthPercent)
 * - состоянии в бою (inCombat)
 * 
 * Уведомляет об изменениях через EventBus
 */
class ContextManager {
    /**
     * @param {Object} game - глобальный объект игры
     * @param {EventBus} eventBus - шина событий
     */
    constructor(game, eventBus) {
        this.game = game;
        this.eventBus = eventBus;
        
        // Текущий контекст
        this.context = {
            // Террейн
            terrain: null,
            
            // Оружие
            weaponType: 'unarmed',  // ИЗМЕНЕНО: null -> 'unarmed'
            weaponMaterial: null,
            
            // Ресурсы
            healthPercent: 100,
            staminaPercent: 100,
            manaPercent: 100,
            
            // Время
            hour: 8,
            day: 1,
            season: 'spring',
            
            // Бой
            inCombat: false,
            enemyCount: 0,
            
            // Позиция
            zoneId: null,
            roomId: null,
            
            // Дополнительно
            isMoving: false,
            isResting: false
        };
        
        this.initialized = false;
    }

    /**
     * Инициализация менеджера
     */
    init() {
        if (this.initialized) return;
        
        this.setupListeners();
        this.updateContext(); // первоначальное заполнение
        
        this.initialized = true;
        console.log('ContextManager: инициализирован');
    }

    /**
     * Настройка подписок на события
     */
    setupListeners() {
        this.eventBus.on('player:equipmentChanged', (data) => {
            this.updateWeaponContext();
        });

    }

    /**
     * Обновить информацию о типе оружия
     */
    updateWeaponContext() {
        const player = this.game.player;
        if (!player) return;

        const equipment = player.getEquipment();
        const rightHand = equipment?.right_hand;
        const leftHand = equipment?.left_hand;
        
        let weaponType = 'unarmed';
        let weaponMaterial = null;

        // Проверяем обе руки
        const isWeapon = (item) => item && (item.type === 'weapon' || item.weaponType !== undefined);

        if (rightHand && isWeapon(rightHand)) {
            weaponType = rightHand.weaponType || 'unknown';
            weaponMaterial = rightHand.material || null;
        }
        else if (leftHand && isWeapon(leftHand)) {
            weaponType = leftHand.weaponType || 'unknown';
            weaponMaterial = leftHand.material || null;
        }

        this.updateContext({
            weaponType,
            weaponMaterial
        });
    }

    /**
     * Обновить информацию о ресурсах
     * @param {Object} stats - характеристики игрока
     */
    updateResourceContext(stats) {
        if (!stats) return;

        const healthPercent = stats.maxHealth > 0 
            ? Math.floor((stats.health / stats.maxHealth) * 100)
            : 0;

        const staminaPercent = stats.maxStamina > 0
            ? Math.floor((stats.stamina / stats.maxStamina) * 100)
            : 0;

        const manaPercent = stats.maxMana > 0
            ? Math.floor((stats.mana / stats.maxMana) * 100)
            : 0;

        this.updateContext({
            healthPercent,
            staminaPercent,
            manaPercent
        });
    }

    /**
     * Обновить контекст
     * @param {Object} changes - частичные изменения
     */
    updateContext(changes = {}) {
        const oldContext = { ...this.context };
        Object.assign(this.context, changes);
        
        // Определяем, что именно изменилось
        const changedKeys = Object.keys(changes);
        
        // Эмитим событие об изменении
        this.eventBus.emit('context:changed', {
            old: oldContext,
            new: this.context,
            changes: changedKeys,
            context: this.context // для удобства
        });
    }

    /**
     * Получить весь контекст
     * @returns {Object}
     */
    getContext() {
        return { ...this.context };
    }

    /**
     * Получить конкретное значение из контекста
     * @param {string} key 
     * @returns {any}
     */
    get(key) {
        return this.context[key];
    }

    /**
     * НОВЫЙ МЕТОД: проверить условие (формулу) на текущем контексте
     * @param {string} condition - формула условия
     * @param {FormulaParser} formulaParser - парсер формул
     * @returns {boolean}
     */
    checkCondition(condition, formulaParser) {
        if (!condition || condition === 'true') return true;
        if (!formulaParser) return false;

        try {
            const result = formulaParser.evaluateCondition(condition, this.context);
            return Boolean(result);
        } catch (error) {
            console.error(`ContextManager: ошибка проверки условия "${condition}"`, error);
            return false;
        }
    }

    /**
     * Принудительно обновить контекст
     */
    refresh() {
        const player = this.game.player;
        if (!player) return;

        // Обновляем оружие
        this.updateWeaponContext();

        // Обновляем ресурсы
        this.updateResourceContext(player.getStats());

        // Обновляем террейн из комнаты
        const roomInfo = this.game.zoneManager?.getCurrentRoomInfo();
        if (roomInfo) {
            this.updateContext({
                terrain: roomInfo.terrain,
                zoneId: roomInfo.zoneId,
                roomId: roomInfo.roomId
            });
        }

        // Время из TimeSystem
        const timeSystem = this.game.gameState?.getTimeSystem();
        if (timeSystem) {
            const gameTime = timeSystem.getGameTime();
            this.updateContext({
                hour: gameTime.hour,
                day: gameTime.day,
                season: gameTime.season
            });
        }
    }

    /**
     * Сбросить контекст (при перерождении и т.п.)
     */
    reset() {
        this.context = {
            terrain: null,
            weaponType: 'unarmed',  // ИЗМЕНЕНО: null -> 'unarmed'
            weaponMaterial: null,
            healthPercent: 100,
            staminaPercent: 100,
            manaPercent: 100,
            hour: 8,
            day: 1,
            season: 'spring',
            inCombat: false,
            enemyCount: 0,
            zoneId: null,
            roomId: null,
            isMoving: false,
            isResting: false
        };
        
        this.refresh(); // перезаполнить актуальными данными
    }

    /**
     * Получить информацию для отладки
     * @returns {Object}
     */
    getDebugInfo() {
        return {
            context: { ...this.context },
            initialized: this.initialized
        };
    }
}

export { ContextManager };
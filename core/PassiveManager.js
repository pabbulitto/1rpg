// core/PassiveManager.js

/**
 * PassiveManager - управление пассивными способностями конкретного персонажа
 * 
 * Отвечает за:
 * - Хранение изученных пассивок (врожденные + изученные)
 * - Применение модификаторов при изучении
 * - Хранение флагов (булевых значений)
 * - Удаление при забывании/перерождении
 * - Проверку лимитов слотов
 * 
 * Создается для каждого персонажа отдельно.
 */
class PassiveManager {
    /**
     * @param {string} characterId - ID персонажа
     * @param {string} characterClass - класс персонажа
     * @param {Object} gameState - ссылка на GameState
     * @param {PassiveAbilityService} passiveService - сервис с шаблонами
     * @param {FormulaParser} formulaParser - для вычисления формул
     * @param {ContextManager} contextManager - для контекста (флаги)
     */
    constructor(characterId, characterClass, gameState, passiveService, formulaParser, contextManager) {
        this.characterId = characterId;
        this.characterClass = characterClass;
        this.gameState = gameState;
        this.passiveService = passiveService;
        this.formulaParser = formulaParser;
        this.contextManager = contextManager;

        // Два отдельных списка пассивок
        this.innatePassives = new Set(); // врожденные (никогда не теряются)
        this.learnedPassives = new Map(); // изученные: id -> уровень, на котором изучили

        // Флаги (булевые значения от пассивок)
        this.flags = new Map(); // flagName -> true

        // Использованные слоты
        this.usedSlots = new Set(); // уровни, на которых уже изучали

        // Подписка на изменения контекста (для будущих условных пассивок)
        this._setupContextListeners();
    }

    /**
     * Подписка на изменения контекста
     * @private
     */
    _setupContextListeners() {
        if (!this.contextManager?.eventBus) return;

        // Подписываемся на изменения контекста
        this.contextManager.eventBus.on('context:changed', (data) => {
            // Вызываем переоценку условных пассивок
            this._reevaluateConditionalPassives();
        });
    }

    // ========== РАСЧЕТ СЛОТОВ ==========

    /**
     * Получить текущее количество реинкарнаций
     * @private
     */
    _getReincarnations() {
        return this.gameState?.player?.reincarnations || 0;
    }

    /**
     * Получить шаг между уровнями в зависимости от реинкарнаций
     * @returns {number}
     */
    getStep() {
        const reinc = this._getReincarnations();

        if (reinc >= 11) return 2;
        if (reinc >= 6) return 3;
        if (reinc >= 2) return 4;
        return 5; // 0-1
    }

    /**
     * Получить первый доступный уровень для изучения
     * @returns {number}
     */
    getFirstLevel() {
        return 1;
    }

    /**
     * Проверить, является ли уровень доступным для изучения
     * @param {number} level
     * @returns {boolean}
     */
    isLevelAvailable(level) {
        if (level < 1) return false;
        
        const step = this.getStep();
        if (level === 1) return true;
        return (level - 1) % step === 0;
    }

    /**
     * Получить максимальное количество слотов на текущем уровне
     * @param {number} level
     * @returns {number}
     */
    getMaxSlotsAtLevel(level) {
        if (level < 1) return 0;
        const step = this.getStep();
        return Math.floor((level - 1) / step) + 1;
    }

    /**
     * Получить уже использованные слоты на уровне
     * @param {number} level
     * @returns {number}
     */
    getUsedSlotsAtLevel(level) {
        let count = 0;
        const step = this.getStep();

        for (let l = 1; l <= level; l += step) {
            if (this.usedSlots.has(l)) count++;
        }
        return count;
    }

    /**
     * Можно ли изучить новую способность на этом уровне
     * @param {number} level
     * @returns {boolean}
     */
    canLearnAtLevel(level) {
        if (!this.isLevelAvailable(level)) return false;
        if (this.usedSlots.has(level)) return false;

        const maxSlots = this.getMaxSlotsAtLevel(level);
        const usedSlots = this.getUsedSlotsAtLevel(level);
        
        return usedSlots < maxSlots;
    }

    /**
     * Получить все слот-уровни до указанного
     * @param {number} upToLevel 
     * @returns {Array<number>}
     */
    getSlotLevels(upToLevel) {
        const step = this.getStep();
        const levels = [];
        for (let l = 1; l <= upToLevel; l += step) {
            levels.push(l);
        }
        return levels;
    }

    // ========== ИНИЦИАЛИЗАЦИЯ ==========

    /**
     * Инициализировать врожденными способностями из класса
     * @param {Array<string>} innateAbilityIds - массив ID врожденных способностей
     */
    initInnate(innateAbilityIds) {
        if (!innateAbilityIds || !Array.isArray(innateAbilityIds)) return;

        innateAbilityIds.forEach(id => {
            const passive = this.passiveService.getPassive(id);
            if (passive) {
                this.innatePassives.add(id);
                // Проверяем, есть ли условие
                if (passive.conditionFormula) {
                    // Если условие есть - проверяем его
                    const isMet = this.contextManager?.checkCondition(
                        passive.conditionFormula, 
                        this.formulaParser
                    );
                    if (isMet) {
                        this._applyPassive(passive);
                    }
                } else {
                    // Если условия нет - применяем всегда
                    this._applyPassive(passive);
                }
            }
        });

        if (this.passiveService.eventBus) {
            this.passiveService.eventBus.emit('passive:innateApplied', {
                characterId: this.characterId,
                passives: Array.from(this.innatePassives)
            });
        }
    }

    /**
     * Применить пассивку (внутренний метод)
     * @private
     */
    _applyPassive(passive) {
        console.log('APPLY PASSIVE CALLED FOR:', passive.id);
        if (!passive) return false;

        // Определяем тип пассивки по наличию полей
        const type = this._determinePassiveType(passive);
        
        switch(type) {
            case 'stat':
                this._applyStatModifiers(passive);
                break;
                
            case 'flag':
                this._applyFlag(passive);
                break;
                
            case 'effect':
                this._applyEffect(passive);
                break;

            case 'multiplier':  
                this._applyMultiplier(passive);  
                break;
                
            case 'conditional':
                this._applyStatModifiers(passive);
                break;
                
            default:
                console.warn(`PassiveManager: неизвестный тип пассивки ${passive.id}`);
                return false;
        }

        if (this.passiveService.eventBus) {
            this.passiveService.eventBus.emit('passive:applied', {
                characterId: this.characterId,
                passiveId: passive.id,
                type: type
            });
        }

        return true;
    }

    /**
     * Определить тип пассивной способности по её содержимому
     * @private
     * @param {PassiveAbility} passive - объект пассивной способности
     * @returns {string} 'stat' | 'flag' | 'effect' | 'conditional' | 'multiplier'
     */
    _determinePassiveType(passive) {
        // 1. Если есть grantsEffect - это эффект (приоритет 1)
        if (passive.grantsEffect) {
            return 'effect';
        }
        
        // 2. Если есть conditionFormula и она не 'true' - это условная пассивка
        if (passive.conditionFormula && passive.conditionFormula !== 'true') {
            return 'conditional';
        }
        
        // 3. Проверяем модификаторы
        const modifierValues = Object.values(passive.modifiers);
        if (modifierValues.length === 0) {
            // Если нет модификаторов, но есть grantsEffect - уже обработано выше
            // Если нет ничего - считаем флагом (может быть просто флаг-включатель)
            return 'flag';
        }
        
        // 4. Анализируем каждый модификатор
        let hasNumericModifier = false;
        let hasBooleanModifier = false;
        let hasMultiplierModifier = false;
        
        for (const [key, value] of Object.entries(passive.modifiers)) {
            // Проверяем ключ - если в названии есть Multiplier, multiplier, множитель
            if (key.toLowerCase().includes('multiplier') || 
                key.toLowerCase().includes('factor') ||
                key.toLowerCase().includes('coefficient')) {
                hasMultiplierModifier = true;
                continue;
            }
            
            // Проверяем значение
            if (typeof value === 'number') {
                hasNumericModifier = true;
            }
            else if (typeof value === 'boolean') {
                hasBooleanModifier = true;
            }
            else if (typeof value === 'string') {
                // Строка может быть формулой или булевым выражением
                const lowerValue = value.toLowerCase();
                
                // Проверка на булевы значения
                if (lowerValue === 'true' || lowerValue === 'false') {
                    hasBooleanModifier = true;
                }
                // Проверка на булевы выражения (сравнения)
                else if (value.includes('==') || value.includes('!=') || 
                        value.includes('>') || value.includes('<') ||
                        value.includes('>=') || value.includes('<=')) {
                    hasBooleanModifier = true;
                }
                // Проверка на множители (значения около 1.0)
                else if (value.match(/^[0-9\.]+$/) && parseFloat(value) > 0.5 && parseFloat(value) < 2.0) {
                    hasMultiplierModifier = true;
                }
                // Иначе считаем числовой формулой
                else {
                    hasNumericModifier = true;
                }
            }
        }
        
        // 5. Определяем тип по приоритету
        if (hasMultiplierModifier) {
            return 'multiplier';
        }
        
        if (hasBooleanModifier && !hasNumericModifier) {
            return 'flag';
        }
        
        if (hasNumericModifier) {
            return 'stat';
        }
        
        // По умолчанию - флаг
        return 'flag';
    }

    /**
     * Применить числовые модификаторы
     * @private
     */
    _applyStatModifiers(passive) {
        const character = this._getCharacter();
        if (!character) return;

        const statManager = character.getStatManager();
        if (!statManager) return;

        const sourceId = `passive_${passive.id}`;
        const finalModifiers = {};

        const stats = character.getStats();

        for (const [key, value] of Object.entries(passive.modifiers)) {
            if (typeof value === 'string') {
                // Это формула
                try {
                    const formulaResult = this.formulaParser.evaluate(value, stats);
                    finalModifiers[key] = formulaResult;
                } catch (error) {
                    console.error(`PassiveManager: ошибка формулы для ${key}`, error);
                    finalModifiers[key] = 0;
                }
            } else if (typeof value === 'number') {
                finalModifiers[key] = value;
            }
        }

        statManager.addModifier(sourceId, finalModifiers);

    }

    /**
     * Применить флаг
     * @private
     */
    _applyFlag(passive) {
        // Каждый модификатор становится отдельным флагом
        for (const [flagName, flagValue] of Object.entries(passive.modifiers)) {
            if (flagValue === true) {
                this.flags.set(flagName, true);
                
                // Уведомляем системы об изменении флага
                if (this.passiveService.eventBus) {
                    this.passiveService.eventBus.emit('passive:flagChanged', {
                        characterId: this.characterId,
                        flag: flagName,
                        value: true
                    });
                }
            }
        }
    }

    /**
     * Применить эффект
     * @private
     */
    _applyEffect(passive) {
        if (!passive.grantsEffect) return;
        if (!window.game?.effectService) return;

        const character = this._getCharacter();
        if (!character) return;

        window.game.effectService.applyEffect(
            character,
            passive.grantsEffect,
            `passive_${passive.id}`,
            { durationOverride: 0 }
        );
    }
    /**
     * Применить пассивку-множитель
     * @private
     * @param {PassiveAbility} passive - объект пассивной способности
     */
    _applyMultiplier(passive) {
        const character = this._getCharacter();
        if (!character) return;

        const statManager = character.getStatManager();
        if (!statManager) return;

        const sourceId = `passive_${passive.id}`;
        const finalModifiers = {};

        // Множители применяются как обычные числовые модификаторы
        for (const [key, value] of Object.entries(passive.modifiers)) {
            if (typeof value === 'number') {
                finalModifiers[key] = value;
            } else if (typeof value === 'string') {
                // Если значение задано формулой - вычисляем
                try {
                    const stats = character.getStats();
                    const result = this.formulaParser.evaluate(value, stats);
                    finalModifiers[key] = result;
                } catch (error) {
                    console.error(`PassiveManager: ошибка вычисления множителя для ${key}`, error);
                }
            }
        }

        if (Object.keys(finalModifiers).length > 0) {
            statManager.addModifier(sourceId, finalModifiers);
            
            // Логируем для отладки
            console.log(`Пассивка-множитель ${passive.id} применена:`, finalModifiers);
        }
    }
    /**
     * Удалить пассивку (внутренний метод)
     * @private
     */
    _removePassive(passive) {
        if (!passive) return false;

        const type = this._determinePassiveType(passive);

        switch(type) {
            case 'stat':
                this._removeStatModifiers(passive);
                break;
                
            case 'flag':
                this._removeFlag(passive);
                break;
                
            case 'effect':
                this._removeEffect(passive);
                break;

            case 'conditional':
                this._removeStatModifiers(passive);
                break;
        }

        return true;
    }

    /**
     * Удалить числовые модификаторы
     * @private
     */
    _removeStatModifiers(passive) {
        const character = this._getCharacter();
        if (!character) return;

        const statManager = character.getStatManager();
        if (!statManager) return;

        const sourceId = `passive_${passive.id}`;
        statManager.removeModifier(sourceId);
    }

    /**
     * Удалить флаг
     * @private
     */
    _removeFlag(passive) {
        for (const flagName of Object.keys(passive.modifiers)) {
            this.flags.delete(flagName);
            
            if (this.passiveService.eventBus) {
                this.passiveService.eventBus.emit('passive:flagChanged', {
                    characterId: this.characterId,
                    flag: flagName,
                    value: false
                });
            }
        }
    }

    /**
     * Удалить эффект
     * @private
     */
    _removeEffect(passive) {
        if (!passive.grantsEffect) return;
        if (!window.game?.effectService) return;
        if (!this.characterId) return;

        window.game.effectService.removeEffectsBySource(
            this.characterId,
            `passive_${passive.id}`
        );
    }
    /**
     * Переоценить все условные пассивки
     * @private
     * @returns {boolean} - были ли изменения
     */
    _reevaluateConditionalPassives() {
        if (!this.contextManager) return false;
        
        const context = this.contextManager.getContext() || {};
        let changed = false;
        
        // Получаем персонажа один раз для всех проверок
        const character = this._getCharacter();
        if (!character) return false;
        
        const statManager = character.getStatManager();
        if (!statManager) return false;
        
        // Проверяем изученные пассивки
        for (const [id, level] of this.learnedPassives.entries()) {
            const passive = this.passiveService.getPassive(id);
            if (!passive || !passive.conditionFormula) continue;
            
            const isConditionMet = this.contextManager.checkCondition(
                passive.conditionFormula, 
                this.formulaParser
            );
            
            const hasModifier = statManager.hasModifier(`passive_${passive.id}`);
            
            if (isConditionMet && !hasModifier) {
                this._applyPassive(passive);
                changed = true;
            } else if (!isConditionMet && hasModifier) {
                this._removePassive(passive);
                changed = true;
            }
        }
        
        // Проверяем врожденные пассивки
        for (const id of this.innatePassives) {
            const passive = this.passiveService.getPassive(id);
            if (!passive || !passive.conditionFormula) continue;
            
            const isConditionMet = this.contextManager.checkCondition(
                passive.conditionFormula, 
                this.formulaParser
            );
            
            const hasModifier = statManager.hasModifier(`passive_${passive.id}`);
            
            if (isConditionMet && !hasModifier) {
                this._applyPassive(passive);
                changed = true;
            } else if (!isConditionMet && hasModifier) {
                this._removePassive(passive);
                changed = true;
            }
        }
        
        return changed;
    }
    /**
     * Получить персонажа по ID
     * @private
     */
    _getCharacter() {
        if (window.game?.player?.id === this.characterId) {
            return window.game.player;
        }
        if (window.game?.zoneManager) {
            return window.game.zoneManager.getEntityById(this.characterId);
        }
        return null;
    }

    /**
     * Проверить наличие флага
     * @param {string} flagName 
     * @returns {boolean}
     */
    hasFlag(flagName) {
        return this.flags.has(flagName);
    }

    /**
     * Получить все флаги
     * @returns {Object}
     */
    getFlags() {
        const result = {};
        for (const flag of this.flags.keys()) {
            result[flag] = true;
        }
        return result;
    }

    // ========== ИЗУЧЕНИЕ ==========

    /**
     * Попытка изучить новую пассивную способность
     * @param {string} passiveId
     * @returns {Object} результат { success, reason }
     */
    tryLearnPassive(passiveId) {
        const character = this._getCharacter();
        if (!character) {
            return { success: false, reason: 'character_not_found' };
        }

        const currentLevel = character.getStats().level;
        const reincarnations = this._getReincarnations();

        const passive = this.passiveService.getPassive(passiveId);
        if (!passive) {
            return { success: false, reason: 'passive_not_found' };
        }

        // 1. Проверка, не изучена ли уже
        if (this.innatePassives.has(passiveId) || this.learnedPassives.has(passiveId)) {
            return { success: false, reason: 'already_learned' };
        }

        // 2. Проверка, может ли класс изучить эту пассивку
        if (passive.classes?.length > 0 && !passive.classes.includes(this.characterClass)) {
            return { success: false, reason: 'wrong_class' };
        }

        // 3. Проверка требований (уровень, реинкарнации)
        if (!passive.canLearn(character, reincarnations)) {
            return { success: false, reason: 'requirements_not_met' };
        }

        // 4. Проверка на exclusive
        if (passive.exclusive) {
            for (const id of this.innatePassives) {
                const p = this.passiveService.getPassive(id);
                if (p?.exclusive) {
                    return { success: false, reason: 'exclusive_conflict_innate' };
                }
            }
            for (const id of this.learnedPassives.keys()) {
                const p = this.passiveService.getPassive(id);
                if (p?.exclusive) {
                    return { success: false, reason: 'exclusive_conflict' };
                }
            }
        }

        // 5. Проверка наличия свободного слота
        if (!this.canLearnAtLevel(currentLevel)) {
            return { success: false, reason: 'no_slots' };
        }

        // 6. Изучаем
        this.learnedPassives.set(passiveId, currentLevel);
        this.usedSlots.add(currentLevel);

        // Проверяем, есть ли условие
        if (passive.conditionFormula) {
            // Для conditional пассивок проверяем условие
            const isMet = this.contextManager?.checkCondition(
                passive.conditionFormula, 
                this.formulaParser
            );
            if (isMet) {
                const applied = this._applyPassive(passive);
                if (!applied) {
                    // Откат если не удалось применить
                    this.learnedPassives.delete(passiveId);
                    this.usedSlots.delete(currentLevel);
                    return { success: false, reason: 'application_failed' };
                }
            }
            // Если условие не выполнено - пассивка изучена, но не активна
        } else {
            // Для обычных пассивок применяем сразу
            const applied = this._applyPassive(passive);
            if (!applied) {
                // Откат
                this.learnedPassives.delete(passiveId);
                this.usedSlots.delete(currentLevel);
                return { success: false, reason: 'application_failed' };
            }
        }

        if (this.passiveService.eventBus) {
            this.passiveService.eventBus.emit('passive:learned', {
                characterId: this.characterId,
                passiveId,
                level: currentLevel,
                passive: passive.getInfo()
            });
        }

        return { success: true, level: currentLevel };
    } 

    // ========== ПЕРЕРОЖДЕНИЕ ==========

    /**
     * Обработка перерождения
     * @param {number} newReincarnations - новое количество реинкарнаций
     */
    onReincarnation(newReincarnations) {
        // Удаляем все изученные (не врожденные)
        for (const [passiveId, level] of this.learnedPassives.entries()) {
            const passive = this.passiveService.getPassive(passiveId);
            if (passive) {
                this._removePassive(passive);
            }
        }

        // Очищаем списки
        this.learnedPassives.clear();
        this.usedSlots.clear();
        this.flags.clear();

        // Применяем заново врожденные (они остаются)
        for (const passiveId of this.innatePassives) {
            const passive = this.passiveService.getPassive(passiveId);
            if (passive) {
                this._applyPassive(passive);
            }
        }

        if (this.passiveService.eventBus) {
            this.passiveService.eventBus.emit('passive:reincarnation', {
                characterId: this.characterId,
                reincarnations: newReincarnations,
                innatePassives: Array.from(this.innatePassives)
            });
        }
    }

    // ========== ПОЛУЧЕНИЕ ИНФОРМАЦИИ ==========

    /**
     * Получить все изученные пассивки (врожденные + изученные)
     * @returns {Object} { innate: Array, learned: Array }
     */
    getAllPassives() {
        return {
            innate: Array.from(this.innatePassives),
            learned: Array.from(this.learnedPassives.entries()).map(([id, level]) => ({ id, level }))
        };
    }

    /**
     * Получить информацию о слотах для UI
     * @returns {Object}
     */
    getSlotInfo() {
        const character = this._getCharacter();
        const currentLevel = character ? character.getStats().level : 1;
        const step = this.getStep();
        const reinc = this._getReincarnations();

        return {
            step,
            reincarnations: reinc,
            firstLevel: this.getFirstLevel(),
            maxAtCurrentLevel: this.getMaxSlotsAtLevel(currentLevel),
            usedAtCurrentLevel: this.getUsedSlotsAtLevel(currentLevel),
            canLearnNow: this.canLearnAtLevel(currentLevel),
            usedSlots: Array.from(this.usedSlots),
            allSlotLevels: this.getSlotLevels(currentLevel)
        };
    }

    /**
     * Получить список доступных для изучения пассивок на текущем уровне
     * @returns {Array<Object>} массив объектов { passive, canLearn, reason }
     */
    getAvailableToLearn() {
        const character = this._getCharacter();
        if (!character) return [];

        const currentLevel = character.getStats().level;
        const reincarnations = this._getReincarnations();
        const hasSlot = this.canLearnAtLevel(currentLevel);

        const classPassives = this.passiveService.getPassivesForClass(this.characterClass);
        
        const result = [];

        for (const passive of classPassives) {
            if (this.innatePassives.has(passive.id) || this.learnedPassives.has(passive.id)) {
                continue;
            }

            let exclusiveConflict = false;
            if (passive.exclusive) {
                for (const id of this.innatePassives) {
                    const p = this.passiveService.getPassive(id);
                    if (p?.exclusive) {
                        exclusiveConflict = true;
                        break;
                    }
                }
                for (const id of this.learnedPassives.keys()) {
                    const p = this.passiveService.getPassive(id);
                    if (p?.exclusive) {
                        exclusiveConflict = true;
                        break;
                    }
                }
            }

            const meetsRequirements = passive.canLearn(character, reincarnations);

            result.push({
                passive: passive.getInfo(),
                canLearn: meetsRequirements && !exclusiveConflict && hasSlot,
                reasons: {
                    levelTooLow: character.getStats().level < passive.requiredLevel,
                    reincTooLow: reincarnations < passive.requiredReincarnations,
                    exclusiveConflict,
                    noSlot: !hasSlot
                }
            });
        }

        return result;
    }

    /**
     * Получить информацию о всех флагах для отладки
     * @returns {Object}
     */
    getDebugInfo() {
        return {
            flags: Array.from(this.flags.keys()),
            innateCount: this.innatePassives.size,
            learnedCount: this.learnedPassives.size
        };
    }

    // ========== СЕРИАЛИЗАЦИЯ ==========

    /**
     * Сохранить состояние
     * @returns {Object}
     */
    toJSON() {
        return {
            innatePassives: Array.from(this.innatePassives),
            learnedPassives: Array.from(this.learnedPassives.entries()),
            usedSlots: Array.from(this.usedSlots),
            flags: Array.from(this.flags.keys()) // сохраняем только названия флагов
        };
    }

    /**
     * Загрузить состояние
     * @param {Object} data
     */
    fromJSON(data) {
        if (data.innatePassives) {
            this.innatePassives = new Set(data.innatePassives);
        }
        if (data.learnedPassives) {
            this.learnedPassives = new Map(data.learnedPassives);
        }
        if (data.usedSlots) {
            this.usedSlots = new Set(data.usedSlots);
        }
        if (data.flags) {
            // Восстанавливаем флаги (они будут переприменены в _reapplyAll)
            this.flags.clear();
        }

        this._reapplyAll();
    }

    /**
     * Переприменить все пассивки после загрузки
     * @private
     */
    _reapplyAll() {
        const character = this._getCharacter();
        if (!character) return;

        // Очищаем старые модификаторы
        const statManager = character.getStatManager();
        if (statManager) {
            const modifiers = statManager.modifiers || [];
            const toRemove = modifiers
                .filter(m => m.source && m.source.startsWith('passive_'))
                .map(m => m.source);
            toRemove.forEach(source => statManager.removeModifier(source));
        }

        // Очищаем флаги
        this.flags.clear();

        // Удаляем эффекты
        if (window.game?.effectService) {
            window.game.effectService.removeEffectsBySource(this.characterId, 'passive_');
        }

        // Применяем врожденные с проверкой условия
        for (const id of this.innatePassives) {
            const passive = this.passiveService.getPassive(id);
            if (!passive) continue;
            
            if (passive.conditionFormula) {
                const isMet = this.contextManager?.checkCondition(
                    passive.conditionFormula, 
                    this.formulaParser
                );
                if (isMet) {
                    this._applyPassive(passive);
                }
            } else {
                this._applyPassive(passive);
            }
        }

        // Применяем изученные с проверкой условия
        for (const [id, level] of this.learnedPassives.entries()) {
            const passive = this.passiveService.getPassive(id);
            if (!passive) continue;
            
            if (passive.conditionFormula) {
                const isMet = this.contextManager?.checkCondition(
                    passive.conditionFormula, 
                    this.formulaParser
                );
                if (isMet) {
                    this._applyPassive(passive);
                }
            } else {
                this._applyPassive(passive);
            }
        }
    }
}

export { PassiveManager };
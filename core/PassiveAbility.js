// core/PassiveAbility.js
/**
 * PassiveAbility - класс для пассивных способностей
 * 
 * Пассивные способности:
 * - Дают постоянные бонусы к характеристикам
 * - Изучаются раз и навсегда
 * - Не зависят от контекста
 * - Не имеют длительности
 */
class PassiveAbility {
    /**
     * @param {string} id - уникальный идентификатор
     * @param {Object} data - данные из passive-abilities.json
     */
    constructor(id, data) {
        this.id = id;
        this.name = data.name || 'Пассивная способность';
        this.description = data.description || '';
        this.modifiers = data.modifiers || {}; // могут быть числами или формулами
        this.requiredLevel = data.requiredLevel || 1;
        this.requiredReincarnations = data.requiredReincarnations || 0;
        this.exclusive = data.exclusive || false;
        this.icon = data.icon || null;
        this.grantsEffect = data.grantsEffect || null; // постоянный эффект
        this.classes = data.classes || []; // какие классы могут изучить
        this.conditionFormula = data.conditionFormula || null;
    }

    /**
     * Применить способность к персонажу
     * @param {Character} character - персонаж
     * @param {FormulaParser} formulaParser - для вычисления формул
     * @returns {boolean} успех применения
     */
    apply(character, formulaParser) {
        const statManager = character.getStatManager();
        if (!statManager) return false;

        const sourceId = `passive_${this.id}`;
        const finalModifiers = {};

        // Получаем текущие статы персонажа для использования в формулах
        const stats = character.getStats();

        // Обрабатываем каждый модификатор
        for (const [key, value] of Object.entries(this.modifiers)) {
            if (typeof value === 'string') {
                // Это формула
                if (!formulaParser) {
                    console.error(`PassiveAbility: formulaParser не передан для вычисления ${key}=${value}`);
                    continue;
                }
                try {
                    const formulaResult = formulaParser.evaluate(value, stats);
                    finalModifiers[key] = formulaResult;
                } catch (error) {
                    console.error(`PassiveAbility: ошибка вычисления формулы для ${key}="${value}"`, error);
                    finalModifiers[key] = 0;
                }
            } else if (typeof value === 'number') {
                // Просто число
                finalModifiers[key] = value;
            }
        }

        // Добавляем модификатор в StatManager
        statManager.addModifier(sourceId, finalModifiers);

        // Если способность дает постоянный эффект
        if (this.grantsEffect && window.game?.effectService) {
            window.game.effectService.applyEffect(
                character, 
                this.grantsEffect, 
                `passive_${this.id}`,
                { durationOverride: 0 } // бессрочно
            );
        }

        return true;
    }

    /**
     * Удалить способность у персонажа
     * @param {Character} character
     * @returns {boolean}
     */
    remove(character) {
        const statManager = character.getStatManager();
        if (!statManager) return false;

        const sourceId = `passive_${this.id}`;
        statManager.removeModifier(sourceId);

        // Удаляем эффект, если был
        if (this.grantsEffect && window.game?.effectService && character) {
            window.game.effectService.removeEffectsBySource(character.id, `passive_${this.id}`);
        }

        return true;
    }

    /**
     * Проверить, может ли персонаж изучить способность
     * @param {Character} character
     * @param {number} reincarnations
     * @returns {boolean}
     */
    canLearn(character, reincarnations) {
        const stats = character.getStats();
        
        // Проверка уровня
        if (stats.level < this.requiredLevel) return false;
        
        // Проверка реинкарнаций
        if (reincarnations < this.requiredReincarnations) return false;
        
        // Проверка класса (если указано)
        if (this.classes.length > 0) {
            const characterClass = character.class;
            if (!this.classes.includes(characterClass)) return false;
        }

        return true;
    }

    /**
     * Получить информацию для UI
     * @returns {Object}
     */
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            requiredLevel: this.requiredLevel,
            requiredReincarnations: this.requiredReincarnations,
            exclusive: this.exclusive,
            modifiers: { ...this.modifiers },
            icon: this.icon,
            grantsEffect: this.grantsEffect,
            conditionFormula: this.conditionFormula
        };
    }
}

export { PassiveAbility };
// system/FormulaParser.js
/**
 * FormulaParser - парсер математических формул для характеристик
 * Поддерживает переменные, базовые операторы, функции
 * Пример: "floor((strength-10)/2) + dex_mod * 2"
 */
class FormulaParser {
    constructor() {
        // Поддерживаемые функции
        this.functions = {
            'floor': Math.floor,
            'ceil': Math.ceil,
            'round': Math.round,
            'min': Math.min,
            'max': Math.max,
            'abs': Math.abs,
            'sqrt': Math.sqrt
        };
        
        // Сопоставление сокращений с полными именами
        this.variableAliases = {
            'str': 'strength', 'strength': 'strength',
            'dex': 'dexterity', 'dexterity': 'dexterity',
            'con': 'constitution', 'constitution': 'constitution',
            'int': 'intelligence', 'intelligence': 'intelligence',
            'wis': 'wisdom', 'wisdom': 'wisdom',
            'cha': 'charisma', 'charisma': 'charisma',
            'str_mod': 'strengthMod', 'strengthMod': 'strengthMod',
            'dex_mod': 'dexterityMod', 'dexterityMod': 'dexterityMod',
            'con_mod': 'constitutionMod', 'constitutionMod': 'constitutionMod',
            'int_mod': 'intelligenceMod', 'intelligenceMod': 'intelligenceMod',
            'wis_mod': 'wisdomMod', 'wisdomMod': 'wisdomMod',
            'cha_mod': 'charismaMod', 'charismaMod': 'charismaMod'
        };
    }
    
    /**
     * Вычислить формулу с контекстом переменных
     * @param {string} formula - строка формулы
     * @param {Object} context - объект с переменными
     * @returns {number} результат вычисления
     */
    evaluate(formula, context = {}) {
        if (!formula || typeof formula !== 'string') {
            console.warn('FormulaParser: пустая формула');
            return 0;
        }
        
        try {
            // Нормализуем формулу
            const normalized = this._normalizeFormula(formula);
            
            // Заменяем переменные на значения
            const withValues = this._replaceVariables(normalized, context);
            
            // Безопасное вычисление
            const result = this._safeEval(withValues);
            
            return typeof result === 'number' ? result : 0;
        } catch (error) {
            console.error(`FormulaParser: ошибка вычисления формулы "${formula}":`, error);
            return 0;
        }
    }
    
    /**
     * Нормализовать формулу: удалить пробелы, привести к нижнему регистру
     */
    _normalizeFormula(formula) {
        return formula
            .replace(/\s+/g, '');
    }
    
    /**
     * Заменить переменные на значения из контекста
     */
    _replaceVariables(formula, context) {
        let result = formula;
        
        // Сначала заменяем алиасы на полные имена
        for (const [alias, fullName] of Object.entries(this.variableAliases)) {
            const regex = new RegExp(`\\b${alias}\\b`, 'g');
            result = result.replace(regex, fullName);
        }
        
        // Затем заменяем переменные на значения
        for (const [varName, value] of Object.entries(context)) {
            if (typeof value === 'number') {
                const regex = new RegExp(`\\b${varName}\\b`, 'g');
                result = result.replace(regex, value.toString());
            }
        }
        
        return result;
    }
    
    /**
     * Безопасное вычисление выражения
     */
    _safeEval(expression) {
        // Проверяем на наличие опасных конструкций
        if (this._isExpressionSafe(expression)) {
            // Заменяем функции на их вызовы
            const withFunctions = this._replaceFunctions(expression);
            
            // Используем Function constructor как более безопасную альтернативу eval
            try {
                // eslint-disable-next-line no-new-func
                return new Function(`return ${withFunctions}`)();
            } catch (error) {
                console.warn(`FormulaParser: ошибка вычисления выражения "${expression}"`);
                return 0;
            }
        }
        
        console.warn(`FormulaParser: небезопасное выражение "${expression}"`);
        return 0;
    }
    
    /**
     * Проверить безопасность выражения
     */
    _isExpressionSafe(expression) {
        const dangerousPatterns = [
            /window\./i,
            /document\./i,
            /localStorage\./i,
            /eval\(/i,
            /Function\(/i,
            /setTimeout\(/i,
            /setInterval\(/i,
            /\.constructor/i,
            /\[object\s+\w+\]/i
        ];
        
        return !dangerousPatterns.some(pattern => pattern.test(expression));
    }
    
    /**
     * Заменить вызовы функций
     */
    _replaceFunctions(expression) {
        let result = expression;
        
        for (const [funcName, func] of Object.entries(this.functions)) {
            const regex = new RegExp(`\\b${funcName}\\(([^)]+)\\)`, 'g');
            result = result.replace(regex, `Math.${funcName}($1)`);
        }
        
        return result;
    }
    
    /**
     * Валидировать формулу (без вычисления)
     * @returns {boolean} true если формула корректна
     */
    validate(formula) {
        try {
            const normalized = this._normalizeFormula(formula);
            return this._isExpressionSafe(normalized);
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Извлечь переменные из формулы
     * @returns {Array} список имен переменных
     */
    extractVariables(formula) {
        const normalized = this._normalizeFormula(formula);
        const variables = new Set();
        
        // Ищем слова, которые не являются числами и не функциями
        const words = normalized.match(/\b[a-z_][a-z0-9_]*\b/g) || [];
        
        for (const word of words) {
            // Пропускаем функции и числа
            if (!this.functions[word] && !/^\d/.test(word)) {
                // Возвращаем оригинальное имя перемены (не алиас)
                const originalName = this.variableAliases[word] || word;
                variables.add(originalName);
            }
        }
        
        return Array.from(variables);
    }
    
    /**
     * Создать шаблон формулы с описанием
     */
    createTemplate(name, formula, description = '') {
        return {
            name,
            formula,
            description,
            variables: this.extractVariables(formula)
        };
    }
}

export { FormulaParser };
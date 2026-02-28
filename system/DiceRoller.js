import { FormulaParser } from './FormulaParser.js';

class DiceRoller {
    constructor() {
        this.rng = Math.random;
        this.formulaParser = new FormulaParser(); 
    }

    setRandomFunction(rng) {
        this.rng = rng;
    }

    roll(formula, context = {}) {
        if (!formula || typeof formula !== 'string') {
            throw new Error('DiceRoller: formula должна быть строкой');
        }

        formula = formula.replace(/\s+/g, '');
        
        try {
            // ЕСЛИ формула содержит скобки, функции (floor, ceil и т.д.)
            if (this._hasComplexExpression(formula)) {
                return this._rollComplexFormula(formula, context);
            }
            
            // ИНАЧЕ используем старую логику для простых формул
            return this._rollInternal(formula, context);
            
        } catch (error) {
            console.error(`DiceRoller: ошибка броска ${formula}:`, error);
            return {
                total: 0,
                rolls: [],
                formula: formula,
                details: 'Ошибка броска',
                error: error.message
            };
        }
    }
   /**
     * Проверить, содержит ли формула сложные выражения (скобки, функции)
     * @private
     */
    _hasComplexExpression(formula) {
        const cleanFormula = formula.replace(/\s+/g, '');
        return /[()]|floor|ceil|round|min|max|sqrt/.test(cleanFormula);
    }    
        /**
     * Обработка сложных формул со скобками и функциями
     * Пример: "(strengthMod+floor(bootWeight/2))d4+strengthMod"
     * @private
     */
    _rollComplexFormula(formula, context) {
        console.log('DiceRoller: обработка сложной формулы:', formula);
        
        const diceMatch = formula.match(/^(.*)d(\d+)([+-].*)?$/);

        if (diceMatch) {
            // Случай 1: Есть d в формуле - это бросок костей
            const [, diceExpr, sidesStr, modifierExpr] = diceMatch;
            const sides = parseInt(sidesStr, 10);
            // ВАЖНО: FormulaParser должен получить ТОЛЬКО выражение в скобках
            // Вычисляем количество костей через FormulaParser
            const diceCount = Math.max(1, Math.floor(
                this.formulaParser.evaluate(diceExpr, context)
            ));
            
            // Бросаем кости
            const rolls = [];
            let diceTotal = 0;
            for (let i = 0; i < diceCount; i++) {
                const roll = this._rollDie(sides);
                rolls.push(roll);
                diceTotal += roll;
            }
            
            // Вычисляем модификатор если есть (например, "+strengthmod")
            let total = diceTotal;
            let modifier = 0;
            if (modifierExpr && modifierExpr.trim() !== '') {
                // Убираем возможный + в начале для FormulaParser
                const cleanModifier = modifierExpr.replace(/^\+/, '');
                modifier = this.formulaParser.evaluate(cleanModifier, context);
                total += modifier;
            }
            
            return {
                total: total,
                rolls: rolls,
                formula: formula,
                details: `${diceCount}d${sides}(${rolls.join(',')})${modifierExpr || ''}=${total}`,
                parsed: {
                    diceCount: diceCount,
                    sides: sides,
                    modifier: modifier
                }
            };
            
        } else {
            // Случай 2: Просто выражение без броска костей
            const result = this.formulaParser.evaluate(formula, context);
            return {
                total: result,
                rolls: [],
                formula: formula,
                details: `${formula}=${result}`,
                parsed: { isExpression: true }
            };
        }
    }

    _rollInternal(formula, context) {
        const parts = this._parseFormula(formula);
        let total = 0;
        let details = [];
        let allRolls = [];

        for (const part of parts) {
            if (part.type === 'dice') {
                const { count, sides } = part;
                const rolls = [];
                let diceTotal = 0;

                for (let i = 0; i < count; i++) {
                    const roll = this._rollDie(sides);
                    rolls.push(roll);
                    diceTotal += roll;
                }

                total += diceTotal;
                allRolls.push(...rolls);
                details.push(`${count}d${sides}(${rolls.join(',')})=${diceTotal}`);
            } 
            else if (part.type === 'constant') {
                total += part.value;
                details.push(`${part.value}`);
            }
            else if (part.type === 'variable') {
                const value = this._resolveVariable(part.name, context);
                total += value;
                details.push(`${part.name}(${value})`);
            }
            else if (part.type === 'operator') {
                // Для сложных формул, пока просто пропускаем
                continue;
            }
        }

        return {
            total: total,
            rolls: allRolls,
            formula: formula,
            details: details.join('+'),
            parts: parts
        };
    }

    _parseFormula(formula) {
        const parts = [];
        let current = '';
        let i = 0;

        while (i < formula.length) {
            const char = formula[i];

            if (char === 'd' && /^\d+$/.test(current)) {
                const count = parseInt(current, 10) || 1;
                i++;
                let sidesStr = '';
                
                while (i < formula.length && /[\d]/.test(formula[i])) {
                    sidesStr += formula[i];
                    i++;
                }
                
                const sides = parseInt(sidesStr, 10);
                if (!sides) throw new Error(`Некорректное число граней: d${sidesStr}`);
                
                parts.push({ type: 'dice', count, sides });
                current = '';
            }
            else if (/[\+\-]/.test(char)) {
                if (current) {
                    parts.push(this._parseToken(current));
                    current = '';
                }
                parts.push({ type: 'operator', value: char });
                i++;
            }
            else if (/[\d]/.test(char)) {
                current += char;
                i++;
            }
            else if (/[a-zA-Z_]/.test(char)) {
                current += char;
                i++;
            }
            else {
                throw new Error(`Некорректный символ в формуле: ${char}`);
            }
        }

        if (current) {
            parts.push(this._parseToken(current));
        }

        return parts;
    }

    _parseToken(token) {
        if (/^\d+$/.test(token)) {
            return { type: 'constant', value: parseInt(token, 10) };
        }
        else if (/^[a-z_][a-z0-9_]*$/i.test(token)) {
            return { type: 'variable', name: token };
        }
        else {
            throw new Error(`Некорректный токен: ${token}`);
        }
    }

    _rollDie(sides) {
        return Math.floor(this.rng() * sides) + 1;
    }

    _resolveVariable(name, context) {
        if (context[name] !== undefined) {
            return context[name];
        }

        const normalized = name;
        const mapping= {
            'str': 'strength', 'strength': 'strength',
            'dex': 'dexterity', 'dexterity': 'dexterity',
            'con': 'constitution', 'constitution': 'constitution',
            'int': 'intelligence', 'intelligence': 'intelligence',
            'wis': 'wisdom', 'wisdom': 'wisdom',
            'cha': 'charisma', 'charisma': 'charisma'
        };

        const mappedName = mapping[normalized];
        if (mappedName && context[mappedName] !== undefined) {
            return context[mappedName];
        }

        return 0;
    }

    rollWithAdvantage(formula, context = {}) {
        const roll1 = this.roll(formula, context);
        const roll2 = this.roll(formula, context);
        
        const best = Math.max(roll1.total, roll2.total);
        const worst = Math.min(roll1.total, roll2.total);
        
        return {
            total: best,
            rolls: [...roll1.rolls, ...roll2.rolls],
            formula: formula,
            details: `Преимущество: ${roll1.total}, ${roll2.total} (выбрано ${best})`,
            advantage: {
                roll1,
                roll2,
                chosen: best,
                discarded: worst
            }
        };
    }

    rollWithDisadvantage(formula, context = {}) {
        const roll1 = this.roll(formula, context);
        const roll2 = this.roll(formula, context);
        
        const best = Math.max(roll1.total, roll2.total);
        const worst = Math.min(roll1.total, roll2.total);
        
        return {
            total: worst,
            rolls: [...roll1.rolls, ...roll2.rolls],
            formula: formula,
            details: `Помеха: ${roll1.total}, ${roll2.total} (выбрано ${worst})`,
            disadvantage: {
                roll1,
                roll2,
                chosen: worst,
                discarded: best
            }
        };
    }

    static calculateModifier(statValue) {
        return Math.floor((statValue - 10) / 2);
    }

    test(formula, context = {}, iterations = 1000) {
        const results = [];
        let sum = 0;
        
        for (let i = 0; i < iterations; i++) {
            const result = this.roll(formula, context);
            results.push(result.total);
            sum += result.total;
        }
        
        const average = sum / iterations;
        const min = Math.min(...results);
        const max = Math.max(...results);
        
        return {
            formula,
            iterations,
            average,
            min,
            max,
            distribution: this._createDistribution(results, min, max)
        };
    }

    _createDistribution(results, min, max) {
        const distribution = {};
        for (let i = min; i <= max; i++) {
            distribution[i] = 0;
        }
        
        for (const result of results) {
            distribution[result]++;
        }
        
        return distribution;
    }
}

export { DiceRoller };

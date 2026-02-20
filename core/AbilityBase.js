// core/AbilityBase.js
/**
 * Базовый класс для способностей (заклинаний/умений)
 * Интегрируется с CharacterBase и StatManager
 */
import { FormulaParser } from '../system/FormulaParser.js';
import { FormulaCalculator } from '../system/FormulaCalculator.js';

class AbilityBase {
    constructor(id, data) {
        this.id = id;
        this.name = data.name;
        this.type = data.type; // 'spell' или 'skill'
        this.description = data.description || '';
        
        // Ресурсы
        this.manaCost = data.manaCost || 0;
        this.staminaCost = data.staminaCost || 0;
        
        // Механика
        this.damageFormula = data.damageFormula || '0';
        this.requirements = data.requirements || {};
        this.target = data.target || 'enemy'; // 'enemy', 'self', 'area'
        this.cooldown = data.cooldown || 0;
        this.currentCooldown = 0;
        this.animation = data.animation || null;
        
        // Вспомогательные объекты
        this.formulaParser = new FormulaParser();
        this.formulaCalculator = new FormulaCalculator();
        
        // Для модификаторов эффектов (расширение в будущем)
        this.effects = data.effects || [];
    }
    
    /**
     * Проверить, может ли персонаж использовать способность
     * @param {CharacterBase} character - персонаж (игрок или враг)
     * @returns {Object} результат проверки
     */
    canUse(character) {
        const stats = character.getStats ? character.getStats() : character.stats;
        const resources = this._getCharacterResources(character);
        
        // Проверка ресурсов
        if (this.manaCost > 0 && resources.mana < this.manaCost) {
            return { success: false, reason: 'Недостаточно маны' };
        }
        if (this.staminaCost > 0 && resources.stamina < this.staminaCost) {
            return { success: false, reason: 'Недостаточно выносливости' };
        }
        
        // Проверка требований (характеристики, уровень)
        for (const [reqStat, reqValue] of Object.entries(this.requirements)) {
            const charValue = stats[reqStat] || 0;
            if (charValue < reqValue) {
                return { 
                    success: false, 
                    reason: `Требуется ${reqStat}: ${reqValue} (имеется: ${charValue})` 
                };
            }
        }
        
        // Проверка КД
        if (this.currentCooldown > 0) {
            return { success: false, reason: `Способность на перезарядке (${this.currentCooldown} ход)` };
        }
        
        return { success: true };
    }
    
    /**
     * Использовать способность
     * @param {CharacterBase} caster - тот, кто использует
     * @param {CharacterBase} target - цель (опционально)
     * @returns {Object} результат использования
     */
    use(caster, target = null) {
        const canUseResult = this.canUse(caster);
        if (!canUseResult.success) {
            return { 
                success: false, 
                message: canUseResult.reason,
                damage: 0 
            };
        }
        
        // Потратить ресурсы
        this._spendResources(caster);
        
        // Рассчитать урон
        let damage = 0;
        if (this.damageFormula && this.damageFormula !== '0') {
            damage = this.calculateDamage(caster, target);
        }
        
        // Применить эффекты (если есть)
        this.applyEffects(caster, target);
        
        // Установить перезарядку
        if (this.cooldown > 0) {
            this.currentCooldown = this.cooldown;
        }
        
        return {
            success: true,
            message: `${caster.name || 'Вы'} используете ${this.name}!`,
            damage: damage,
            ability: this,
            caster: caster,
            target: target
        };
    }
        /**
     * Отметить способность как использованную (для кулдаунов и ресурсов)
     * В отличие от use(), не рассчитывает урон - это делает BattleSystem
     */
    markAsUsed(caster) {
        console.log('markAsUsed вызван для', this.id);
        // Потратить ресурсы
        this._spendResources(caster);
        
        // Установить кулдаун
        if (this.cooldown > 0) {
            this.currentCooldown = this.cooldown;
        }
        console.log('Установлен currentCooldown:', this.currentCooldown);
        return {
            success: true,
            resourcesSpent: {
                mana: this.manaCost,
                stamina: this.staminaCost
            },
            cooldownSet: this.cooldown
        };
    }
    /**
     * Рассчитать урон способности
     */
    calculateDamage(caster, target = null) {
        // ... получение extendedStats ...
        
        const formula = this.damageFormula;
        if (!formula || formula === '0') return 0;
        
        try {
            // Проверяем есть ли DiceRoller (через window.game или передать в конструктор)
            let diceRoller = null;
            if (window.game?.battleSystem?.diceRoller) {
                diceRoller = window.game.battleSystem.diceRoller;
            } else if (caster.battleSystem?.diceRoller) {
                diceRoller = caster.battleSystem.diceRoller;
            }
            
            // Если есть DiceRoller И формула содержит броски (dX) - использовать его
            if (diceRoller && formula.toLowerCase().includes('d')) {
                const result = diceRoller.roll(formula, extendedStats);
                return result.total;
            }
            
            // Иначе использовать FormulaParser (для чистых математических формул)
            return this.formulaParser.evaluate(formula, extendedStats);
            
        } catch (error) {
            console.error(`AbilityBase: ошибка расчета формулы "${formula}":`, error);
            return 0;
        }
    }
    
    /**
     * Применить эффекты способности (заглушка для расширения)
     */
    applyEffects(caster, target = null) {
        // Для будущего расширения (эффекты, баффы, дебаффы)
        if (this.effects.length > 0) {
            // Интеграция с BaseEffect.js будет в Фазе 2
        }
        return [];
    }
    
    /**
     * Обновить перезарядку (вызывается каждый ход)
     */
    updateCooldown() {
        if (this.currentCooldown > 0) {
            this.currentCooldown--;
        }
    }
    
    /**
     * Получить информацию о способности
     */
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            description: this.description,
            manaCost: this.manaCost,
            staminaCost: this.staminaCost,
            damageFormula: this.damageFormula,
            requirements: { ...this.requirements },
            cooldown: this.cooldown,
            currentCooldown: this.currentCooldown,
            target: this.target
        };
    }
    
    // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===
    
    _getCharacterResources(character) {
        if (character.gameState && character.gameState.getStatManager) {
            const statManager = character.gameState.getStatManager();
            return {
                mana: statManager.getResource('mana'),
                stamina: statManager.getResource('stamina')
            };
        }
        // Для врагов без gameState
        const stats = character.stats || {};
        return {
            mana: stats.mana || 0,
            stamina: stats.stamina || 0
        };
    }
    
    _spendResources(character) {
        if (character.gameState && character.gameState.getStatManager) {
            const statManager = character.gameState.getStatManager();
            if (this.manaCost > 0) {
                statManager.modifyResource('mana', -this.manaCost);
            }
            if (this.staminaCost > 0) {
                statManager.modifyResource('stamina', -this.staminaCost);
            }
        } else {
            // Для врагов (упрощенно)
            const stats = character.stats || {};
            if (this.manaCost > 0 && stats.mana !== undefined) {
                stats.mana = Math.max(0, stats.mana - this.manaCost);
            }
            if (this.staminaCost > 0 && stats.stamina !== undefined) {
                stats.stamina = Math.max(0, stats.stamina - this.staminaCost);
            }
        }
    }
}

export { AbilityBase };
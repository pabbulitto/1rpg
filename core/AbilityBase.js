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
        this.type = data.type;
        this.icon = data.icon || null; 
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
        this.isBattle = data.isBattle || false;
        this.school = data.school || null;
        this.mechanic = data.mechanic || null;
        this.mechanicParams = data.mechanicParams || null;

        // Вспомогательные объекты
        this.formulaParser = new FormulaParser();
        this.formulaCalculator = new FormulaCalculator();
        
        // Для модификаторов эффектов (расширение в будущем)
        this.effects = data.effects || [];
        // Масштабирование от мастерства
        this.scaling = data.scaling || {};
        this.baseProjectiles = data.baseProjectiles || 1; // для магической стрелы
        this.baseDuration = data.baseDuration || 0; // для эффектов
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
        
        // ===== ПОЛУЧАЕМ БОНУСЫ ОТ ШКОЛЫ МАГИИ =====
        let schoolDurationBonus = 0;
        let schoolDamageMultiplier = 1.0;
        
        // Только для заклинаний и если есть школа
        if (this.type === 'spell' && this.school && window.game?.abilityService) {
            // Получаем ID умения школы 
            const schoolSkillId = this._getSchoolSkillId(this.school);
            if (schoolSkillId) {
                // Получаем мастерство школы
                const schoolMastery = window.game.abilityService.getMastery(caster.id, schoolSkillId) || 0;
                
                // +1 час длительности за каждые 25% мастерства школы
                schoolDurationBonus = Math.floor(schoolMastery / 25);
                
                // +5% урона за каждые 20% мастерства школы
                const damageBonusPercent = Math.floor(schoolMastery / 20) * 5;
                schoolDamageMultiplier = 1 + (damageBonusPercent / 100);
            }
        }
        
        // ===== ПОЛУЧАЕМ МАСТЕРСТВО САМОГО ЗАКЛИНАНИЯ =====
        let spellMastery = 0;
        if (window.game?.abilityService) {
            spellMastery = window.game.abilityService.getMastery(caster.id, this.id) || 0;
        }
        
        // ===== ПРИМЕНЯЕМ МАСШТАБИРОВАНИЕ КОЛИЧЕСТВА СНАРЯДОВ =====
        let projectiles = this.baseProjectiles || 1;
        if (this.scaling && this.scaling.projectiles) {
            projectiles = this.getScaledValue('projectiles', this.baseProjectiles, spellMastery);
        }
        
        // ===== РАССЧИТЫВАЕМ УРОН =====
        let damage = 0;
        if (this.damageFormula && this.damageFormula !== '0') {
            // Урон одного снаряда
            const baseDamage = this.calculateDamage(caster, target);
            // Умножаем на количество снарядов
            damage = baseDamage * projectiles;
            // Применяем множитель урона от школы
            damage = Math.floor(damage * schoolDamageMultiplier);
            // Применяем множитель от пассивок (spellDamageMultiplier)
            const stats = caster.getStats();
            const passiveMultiplier = stats.spellDamageMultiplier || 1.0;
            
            // Проверяем: множитель активен И цель существует И цель НЕ игрок
            if (passiveMultiplier !== 1.0 && target && target.type !== 'player') {
                damage = Math.floor(damage * passiveMultiplier);
            }
        }
        
        // ===== ПРИМЕНЯЕМ ЭФФЕКТЫ С УЧЕТОМ БОНУСА ДЛИТЕЛЬНОСТИ =====
        this.applyEffects(caster, target, schoolDurationBonus);
        
        // ===== УСТАНАВЛИВАЕМ ПЕРЕЗАРЯДКУ =====
        if (this.cooldown > 0) {
            this.currentCooldown = this.cooldown;
        }
        
        return {
            success: true,
            message: `${caster.name || 'Вы'} использует ${this.name}!`,
            damage: damage,
            damageType: this.type === 'spell' ? 'magical' : 'physical',
            ability: this,
            caster: caster,
            target: target
        };
    }

    _getSchoolSkillId(school) {
        const mapping = {
            'fire': 'магия_огня',
            'water': 'магия_воды',
            'air': 'магия_воздуха',
            'earth': 'магия_земли',
            'life': 'магия_жизни',
            'mind': 'магия_разума',
            'dark': 'магия_тьмы'
        };
        return mapping[school] || null;
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
        const stats = caster.getStats ? caster.getStats() : caster.stats || {};
        const equipment = caster.getEquipment ? caster.getEquipment() : {};
        const feetItem = equipment.feet;
        const extendedStats = {
            strength: stats.strength || 10,
            dexterity: stats.dexterity || 10,
            constitution: stats.constitution || 10,
            intelligence: stats.intelligence || 10,
            wisdom: stats.wisdom || 10,
            charisma: stats.charisma || 10,
            strengthMod: Math.floor(((stats.strength || 10) - 10) / 2),
            dexterityMod: Math.floor(((stats.dexterity || 10) - 10) / 2),
            constitutionMod: Math.floor(((stats.constitution || 10) - 10) / 2),
            intelligenceMod: Math.floor(((stats.intelligence || 10) - 10) / 2),
            wisdomMod: Math.floor(((stats.wisdom || 10) - 10) / 2),
            charismaMod: Math.floor(((stats.charisma || 10) - 10) / 2),
            bootWeight: feetItem?.weight || 0,
            level: stats.level || 1
        };
        
        const formula = this.damageFormula;
        if (!formula || formula === '0') return 0;
        
        try {
            let diceRoller = null;
            if (window.game?.battleSystem?.diceRoller) {
                diceRoller = window.game.battleSystem.diceRoller;
            } else if (caster.battleSystem?.diceRoller) {
                diceRoller = caster.battleSystem.diceRoller;
            }
            
            if (diceRoller && formula.toLowerCase().includes('d')) {
                const result = diceRoller.roll(formula, extendedStats);
                return result.total;
            }
            
            return this.formulaParser.evaluate(formula, extendedStats);
        } catch (error) {
            console.error(`AbilityBase: ошибка расчета формулы "${formula}":`, error);
            return 0;
        }
    }
    /**
     * Получить масштабированное значение параметра
     * @param {string} paramName - имя параметра ('projectiles', 'damage', и т.д.)
     * @param {number} baseValue - базовое значение
     * @param {number} mastery - текущее мастерство (0-100)
     * @returns {number}
     */
    getScaledValue(paramName, baseValue, mastery) {
        if (!this.scaling || !this.scaling[paramName]) return baseValue;
        
        const formula = this.scaling[paramName];
        // Заменяем "mastery" на реальное значение
        let formulaStr = formula.replace(/mastery/g, mastery);
        
        // Заменяем математические функции на Math.*
        formulaStr = formulaStr.replace(/floor/g, 'Math.floor');
        formulaStr = formulaStr.replace(/ceil/g, 'Math.ceil');
        formulaStr = formulaStr.replace(/round/g, 'Math.round');
        formulaStr = formulaStr.replace(/min/g, 'Math.min');
        formulaStr = formulaStr.replace(/max/g, 'Math.max');
        
        try {
            // Вычисляем формулу
            const result = eval(formulaStr);
            return baseValue + result;
        } catch (e) {
            console.error(`Ошибка вычисления scaling для ${paramName}:`, e);
            return baseValue;
        }
    }
    /**
     * Применить эффекты заклинания/умения
     * @param {Character} caster - кто применяет
     * @param {Character} target - цель
     * @param {number} durationBonus - бонус к длительности (от школы магии)
     * @returns {Array} - примененные эффекты
     */
    applyEffects(caster, target = null, durationBonus = 0) {
        const appliedEffects = [];
        
        // Если нет эффектов - выходим
        if (!this.effects || this.effects.length === 0) {
            return appliedEffects;
        }
        
        // Определяем цель для эффекта
        const effectTarget = target || caster;
        if (!effectTarget) return appliedEffects;
        
        // Получаем сервис эффектов
        const effectService = window.game?.effectService;
        if (!effectService) {
            console.warn('EffectService не найден');
            return appliedEffects;
        }
        
        // Применяем каждый эффект из списка
        this.effects.forEach(effectId => {
            // Базовая длительность (из заклинания или 0)
            let duration = this.effectDuration || 0;
            
            // Если есть базовая длительность в заклинании
            if (this.baseDuration) {
                duration = this.baseDuration;
            }
            
            // Добавляем бонус от школы магии
            duration += durationBonus;
            
            // ПОЛУЧАЕМ ШАНС СРАБАТЫВАНИЯ ЭФФЕКТА
            let chance = this.baseEffectChance !== undefined ? this.baseEffectChance : 100;
            
            // Если есть масштабирование шанса от мастерства
            if (this.scaling && this.scaling.effectChance) {
                const mastery = window.game.abilityService.getMastery(caster.id, this.id) || 0;
                const bonus = this.getScaledValue('effectChance', 0, mastery);
                chance += bonus;
            }
            
            // Проверяем шанс
            if (Math.random() * 100 > chance) {
                return; // эффект не сработал
            }
            
            // Применяем эффект через EffectService
            const effect = effectService.applyEffect(
                effectTarget,
                effectId,
                `${this.type}_${this.id}`,
                {
                    durationOverride: duration,
                    stacksOverride: this.effectStacks || 1
                }
            );
            
            if (effect) {
                appliedEffects.push(effect);
                
                // ЛОГИРОВАНИЕ
                const targetName = effectTarget.name || effectTarget.id;
                const effectName = effect.name || effectId;
                
                let message = '';
                if (effectTarget === target && target !== caster) {
                    message = `✨ ${effectName} наложен на ${targetName}!`;
                } else if (effectTarget === caster) {
                    message = `✨ Вы получили эффект ${effectName}!`;
                }
                
                if (message && window.game?.gameState?.eventBus) {
                    window.game.gameState.eventBus.emit('log:add', {
                        message: message,
                        type: effect.isDebuff ? 'warning' : 'success'
                    });
                }
            }
        });
        
        return appliedEffects;
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
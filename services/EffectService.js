// services/EffectService.js
/**
 * EffectService - сервис управления эффектами/аффектами
 * 
 * Отвечает за:
 * - Загрузку шаблонов эффектов из effects.json
 * - Создание экземпляров эффектов
 * - Применение эффектов к персонажам
 * - Обновление длительности (тики)
 * - Удаление эффектов
 * - Сохранение/загрузку состояния
 */
import { BaseEffect } from '../core/BaseEffect.js';
import { FormulaParser } from '../system/FormulaParser.js';

class EffectService {
    constructor(eventBus, formulaParser = null) {
        this.eventBus = eventBus;
        this.formulaParser = formulaParser || new FormulaParser();
        
        /** @type {Map<string, Object>} Шаблоны эффектов из JSON */
        this.templates = new Map();
        
        /** @type {Map<string, BaseEffect>} Все активные эффекты по sourceId */
        this.activeEffects = new Map();
        
        /** @type {Map<string, Set<string>>} Индекс эффектов по цели (targetId -> Set(sourceId)) */
        this.effectsByTarget = new Map();
        
        this.initialized = false;
    }
    
    /**
     * Загрузить шаблоны эффектов из JSON
     * @param {Object} data - данные из effects.json
     */
    loadEffects(data) {
        this.templates.clear();
        
        for (const [effectId, effectData] of Object.entries(data)) {
            this.templates.set(effectId, effectData);
        }
        
        this.initialized = true;
        console.log(`EffectService: загружено ${this.templates.size} шаблонов эффектов`);
    }
    
    /**
     * Получить шаблон эффекта по ID
     * @param {string} effectId
     * @returns {Object|null}
     */
    getTemplate(effectId) {
        return this.templates.get(effectId) || null;
    }
    
    /**
     * Создать экземпляр эффекта из шаблона
     * @param {string} effectId - ID эффекта
     * @param {string} source - источник (spell, item, passive)
     * @param {Object} options - дополнительные параметры
     * @param {number} options.durationOverride - переопределение длительности
     * @param {number} options.stacksOverride - переопределение стаков
     * @param {Object} options.statsOverride - переопределение модификаторов
     * @returns {BaseEffect|null}
     */
    createEffect(effectId, source, options = {}) {
        const template = this.getTemplate(effectId);
        if (!template) {
            console.error(`EffectService: шаблон эффекта ${effectId} не найден`);
            return null;
        }
        // генерируем уникальный sourceId 
        const sourceId = options.sourceId || `${source}_${effectId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        // Определяем длительность с учетом всех опций
        let duration = template.duration;
        if (options.durationOverride !== undefined) {
            duration = options.durationOverride;
        } else if (options.addDuration !== undefined) {
            // Для новых эффектов addDuration работает как базовое значение
            duration = options.addDuration;
        }
        
        // Создаём конфиг на основе шаблона с возможностью переопределения
        const config = {
            description: template.description,
            duration: duration,
            maxStacks: template.maxStacks,
            initialStacks: options.stacksOverride !== undefined ? options.stacksOverride : (template.initialStacks || 1),
            stats: options.statsOverride || template.stats || {},
            source: source,
            sourceId: sourceId,  
            isDebuff: template.isDebuff || false,
            conditions: template.conditions || [],
            onApply: template.onApply,
            onTick: template.onTick,
            onRemove: template.onRemove
        };
        
        return new BaseEffect(effectId, template.name || effectId, config);
    }
    
    /**
     * Применить эффект к цели
     * @param {Character} target - целевой персонаж
     * @param {string} effectId - ID эффекта
     * @param {string} source - источник (spell, item, passive)
     * @param {Object} options - дополнительные параметры
     * @param {number} options.durationOverride - переопределение длительности
     * @param {boolean} options.refreshOnReapply - обновлять длительность при повторном наложении
     * @returns {BaseEffect|null} - применённый эффект или null
     */
    applyEffect(target, effectId, source, options = {}) {
        if (!target || !target.id) {
            console.error('EffectService: цель не найдена');
            return null;
        }
        
        const targetId = target.id;
        
        // Сначала ищем по точному источнику (как раньше)
        let existingEffect = this.findEffect(targetId, effectId, source);
        
        // Если не нашли, ищем любой эффект с таким же ID на цели
        if (!existingEffect) {
            const effectsOnTarget = this.getEffectsOnTarget(targetId);
            existingEffect = effectsOnTarget.find(e => e.id === effectId);
        }
        
        if (existingEffect) {
            // Эффект уже есть - обновляем длительность
            if (options.refreshOnReapply !== false) {

                let newDuration;
                if (options.durationOverride !== undefined) {
                    newDuration = options.durationOverride;
                } else if (options.addDuration !== undefined) {
                    newDuration = existingEffect.remainingTicks + options.addDuration;
                } else {
                    newDuration = existingEffect.remainingTicks + existingEffect.duration;
                }
                
                existingEffect.refresh(newDuration);
                
                this.eventBus?.emit('effect:updated', {
                    targetId,
                    effect: existingEffect.getInfo()
                });
                
                return existingEffect;
            }
            return null;
        }
        
        // Создаём новый эффект
        const effect = this.createEffect(effectId, source, options);
        if (!effect) return null;
        
        // Применяем к цели
        const success = effect.apply(target, source, this.formulaParser);
        if (!success) return null;
        
        // Сохраняем в реестры
        this.activeEffects.set(effect.sourceId, effect);
        
        if (!this.effectsByTarget.has(targetId)) {
            this.effectsByTarget.set(targetId, new Set());
        }
        this.effectsByTarget.get(targetId).add(effect.sourceId);
        
        // Подписываем на TimeSystem если есть длительность
        if (effect.duration > 0 && window.game?.timeSystem) {
            window.game.timeSystem.registerEffect(effect);
        }
        
        this.eventBus?.emit('effect:applied', {
            targetId,
            effect: effect.getInfo()
        });
        
        return effect;
    }
    /**
     * Найти эффект на цели по ID и источнику
     * @param {string} targetId
     * @param {string} effectId
     * @param {string} source
     * @returns {BaseEffect|null}
     */
    findEffect(targetId, effectId, source) {
        const effectSourceIds = this.effectsByTarget.get(targetId);
        if (!effectSourceIds) return null;
        
        for (const sourceId of effectSourceIds) {
            const effect = this.activeEffects.get(sourceId);
            if (effect && effect.id === effectId && effect.source === source) {
                return effect;
            }
        }
        
        return null;
    }
    
    /**
     * Удалить эффект по sourceId
     * @param {string} sourceId
     * @returns {boolean}
     */
    removeEffect(sourceId) {
        const effect = this.activeEffects.get(sourceId);
        if (!effect) return false;
        
        const targetId = effect.target?.id;
        const effectTarget = effect.target;  // ← сохраняем ДО удаления
        
        // Удаляем из реестра целей
        if (targetId && this.effectsByTarget.has(targetId)) {
            this.effectsByTarget.get(targetId).delete(sourceId);
            if (this.effectsByTarget.get(targetId).size === 0) {
                this.effectsByTarget.delete(targetId);
            }
        }
        
        // Удаляем сам эффект
        effect.remove();
        this.activeEffects.delete(sourceId);
        
        if (effectTarget && typeof effectTarget.removeEffect === 'function') {
            effectTarget.removeEffect(effect.id);
        }     
        
        this.eventBus?.emit('effect:removed', {
            targetId,
            sourceId,
            effectId: effect.id
        });
        
        return true;
    }
    
    /**
     * Удалить все эффекты от конкретного источника на цели
     * @param {string} targetId
     * @param {string} source - источник (например 'item_fackel')
     */
    removeEffectsBySource(targetId, source) {
        const effectSourceIds = this.effectsByTarget.get(targetId);
        if (!effectSourceIds) return;
        
        const toRemove = [];
        for (const sourceId of effectSourceIds) {
            const effect = this.activeEffects.get(sourceId);
            if (effect && effect.source.startsWith(source)) {
            toRemove.push(sourceId);
        }
        }
        
        toRemove.forEach(sourceId => this.removeEffect(sourceId));
    }
    
    /**
     * Удалить все эффекты конкретного типа с цели
     * @param {string} targetId
     * @param {string} effectId
     */
    removeEffectsByType(targetId, effectId) {
        const effectSourceIds = this.effectsByTarget.get(targetId);
        if (!effectSourceIds) return;
        
        const toRemove = [];
        for (const sourceId of effectSourceIds) {
            const effect = this.activeEffects.get(sourceId);
            if (effect && effect.id === effectId) {
                toRemove.push(sourceId);
            }
        }
        
        toRemove.forEach(sourceId => this.removeEffect(sourceId));
    }
    
    /**
     * Получить все эффекты на цели
     * @param {string} targetId
     * @returns {Array<BaseEffect>}
     */
    getEffectsOnTarget(targetId) {
        const effectSourceIds = this.effectsByTarget.get(targetId);
        if (!effectSourceIds) return [];
        
        const result = [];
        for (const sourceId of effectSourceIds) {
            const effect = this.activeEffects.get(sourceId);
            if (effect) {
                result.push(effect);
            }
        }
        
        return result;
    }
    
    /**
     * Проверить наличие эффекта на цели
     * @param {string} targetId
     * @param {string} effectId
     * @returns {boolean}
     */
    hasEffect(targetId, effectId) {
        const effects = this.getEffectsOnTarget(targetId);
        return effects.some(e => e.id === effectId);
    }
    
    /**
     * Получить эффект по sourceId
     * @param {string} sourceId
     * @returns {BaseEffect|null}
     */
    getEffectBySourceId(sourceId) {
        return this.activeEffects.get(sourceId) || null;
    }
    
    /**
     * Обновить все эффекты (вызывается TimeSystem)
     * @param {number} currentTick - текущий тик
     */
    updateAllEffects(currentTick) {
        const expired = [];
        
        for (const [sourceId, effect] of this.activeEffects.entries()) {
            const status = effect.onTimeTick();
            if (status === 'expired') {
                expired.push(sourceId);
            }
        }
        
        // Удаляем истёкшие
        expired.forEach(sourceId => this.removeEffect(sourceId));
    }
    
    /**
     * Получить данные для сохранения
     * @returns {Object}
     */
    getSaveData() {
        const saveData = {};
        
        for (const [sourceId, effect] of this.activeEffects.entries()) {
            if (!effect.target) continue;
            
            saveData[sourceId] = {
                effectId: effect.id,
                targetId: effect.target.id,
                source: effect.source,
                remainingTicks: effect.remainingTicks,
                currentStacks: effect.currentStacks,
                duration: effect.duration,
                // Не сохраняем модификаторы - они пересчитаются при загрузке
            };
        }
        
        return saveData;
    }
    
    /**
     * Загрузить данные из сохранения
     * @param {Object} saveData
     */
    loadSaveData(saveData) {
        if (!saveData) return;
        
        // Очищаем текущие эффекты
        this.activeEffects.clear();
        this.effectsByTarget.clear();
        
        // Восстанавливаем из сохранения
        for (const [sourceId, data] of Object.entries(saveData)) {
            // Находим цель
            const target = this.findTargetById(data.targetId);
            if (!target) continue;
            
            // Создаём эффект
            const effect = this.createEffect(data.effectId, data.source, {
                durationOverride: data.duration,
                stacksOverride: data.currentStacks
            });
            
            if (!effect) continue;
            
            // Восстанавливаем состояние
            effect.remainingTicks = data.remainingTicks;
            effect.sourceId = sourceId; // восстанавливаем исходный sourceId
            
            // Применяем
            effect.apply(target, data.source, this.formulaParser);
            
            // Регистрируем
            this.activeEffects.set(sourceId, effect);
            
            if (!this.effectsByTarget.has(data.targetId)) {
                this.effectsByTarget.set(data.targetId, new Set());
            }
            this.effectsByTarget.get(data.targetId).add(sourceId);
            
            // Подписываем на TimeSystem
            if (effect.duration > 0 && window.game?.timeSystem) {
                window.game.timeSystem.registerEffect(effect);
            }
        }
    }
    
    /**
     * Вспомогательный метод для поиска цели по ID
     * @private
     */
    findTargetById(targetId) {
        // Сначала проверяем игрока
        if (window.game?.player?.id === targetId) {
            return window.game.player;
        }
        
        // Ищем в ZoneManager
        if (window.game?.zoneManager) {
            return window.game.zoneManager.getEntityById(targetId);
        }
        
        return null;
    }
    
    /**
     * Получить статистику для отладки
     */
    getStats() {
        return {
            templates: this.templates.size,
            activeEffects: this.activeEffects.size,
            targetsWithEffects: this.effectsByTarget.size,
            initialized: this.initialized
        };
    }
}

export { EffectService };
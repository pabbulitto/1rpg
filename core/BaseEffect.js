class BaseEffect {
    constructor(id, name, config = {}) {
        this.id = id;
        this.name = name;
        this.description = config.description || '';
        
        this.duration = config.duration || 0;        // в тиках, 0 = бесконечно
        this.remainingTicks = this.duration;         // оставшееся время
        this.maxStacks = config.maxStacks || 1;      // максимальное количество стаков
        this.currentStacks = config.initialStacks || 1;
        
        this.statsModifiers = config.stats || {};    // модификаторы характеристик
        this.source = config.source || 'unknown';    // источник эффекта
        this.isDebuff = config.isDebuff || false;
        
        this.onApply = config.onApply || null;       // callback при применении
        this.onTick = config.onTick || null;         // callback каждый тик
        this.onRemove = config.onRemove || null;     // callback при снятии
    }
    
    apply(target, source = null) {
        this.target = target;
        this.applicationTick = window.game?.gameState?.getCurrentTick?.() || 0;
        
        // Применяем модификаторы характеристик
        if (Object.keys(this.statsModifiers).length > 0) {
            const modifierId = `effect_${this.id}_${Date.now()}`;
            target.statManager?.addModifier(modifierId, this.statsModifiers);
            this.modifierId = modifierId;
        }
        
        // Вызываем кастомный обработчик
        if (this.onApply && typeof this.onApply === 'function') {
            this.onApply(this.target, source);
        }
        
        // Регистрируем в системе тиков, если есть длительность
        if (this.duration > 0) {
            window.game?.timeSystem?.registerEffect?.(this);
        }
        
        return true;
    }
    
    remove() {
        // Удаляем модификаторы характеристик
        if (this.modifierId && this.target?.statManager) {
            this.target.statManager.removeModifier(this.modifierId);
        }
        
        // Вызываем кастомный обработчик удаления
        if (this.onRemove && typeof this.onRemove === 'function') {
            this.onRemove(this.target);
        }
        
        // Отписываемся от системы тиков
        window.game?.timeSystem?.unregisterEffect?.(this);
        
        this.target = null;
        return true;
    }
    
    onTimeTick() {
        if (this.duration > 0) {
            this.remainingTicks--;
            
            // Вызываем кастомный обработчик тика
            if (this.onTick && typeof this.onTick === 'function') {
                this.onTick(this.target, this.remainingTicks);
            }
            
            // Проверяем истечение времени
            if (this.remainingTicks <= 0) {
                this.remove();
                return 'expired';
            }
        }
        
        return 'active';
    }
    
    addStack(count = 1) {
        if (this.maxStacks > 1) {
            const oldStacks = this.currentStacks;
            this.currentStacks = Math.min(this.maxStacks, this.currentStacks + count);
            
            // Обновляем модификаторы пропорционально стакам
            if (this.modifierId && this.target?.statManager) {
                const scaledModifiers = {};
                for (const [stat, value] of Object.entries(this.statsModifiers)) {
                    scaledModifiers[stat] = value * (this.currentStacks - oldStacks);
                }
                this.target.statManager.addModifier(this.modifierId, scaledModifiers);
            }
            
            return this.currentStacks;
        }
        return 1;
    }
    
    reduceStack(count = 1) {
        if (this.maxStacks > 1) {
            const oldStacks = this.currentStacks;
            this.currentStacks = Math.max(0, this.currentStacks - count);
            
            // Уменьшаем модификаторы
            if (this.modifierId && this.target?.statManager) {
                const reductionModifiers = {};
                for (const [stat, value] of Object.entries(this.statsModifiers)) {
                    reductionModifiers[stat] = -value * (oldStacks - this.currentStacks);
                }
                this.target.statManager.addModifier(this.modifierId, reductionModifiers);
            }
            
            if (this.currentStacks <= 0) {
                this.remove();
                return 0;
            }
            
            return this.currentStacks;
        }
        return 1;
    }
    
    getInfo() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            duration: this.duration,
            remainingTicks: this.remainingTicks,
            currentStacks: this.currentStacks,
            maxStacks: this.maxStacks,
            isDebuff: this.isDebuff,
            source: this.source
        };
    }
    
    // Статический метод для создания эффектов из конфигурации
    static createFromConfig(effectId, config) {
        return new BaseEffect(effectId, config.name || effectId, {
            description: config.description,
            duration: config.duration,
            maxStacks: config.maxStacks,
            initialStacks: config.initialStacks,
            stats: config.stats || {},
            source: config.source,
            isDebuff: config.isDebuff,
            onApply: config.onApply,
            onTick: config.onTick,
            onRemove: config.onRemove
        });
    }
}

export { BaseEffect };
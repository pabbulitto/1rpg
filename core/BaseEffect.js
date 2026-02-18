class BaseEffect {
    constructor(id, name, config = {}) {
        this.id = id;
        this.name = name;
        this.description = config.description || '';
        
        this.duration = config.duration || 0;
        this.remainingTicks = this.duration;
        this.maxStacks = config.maxStacks || 1;
        this.currentStacks = config.initialStacks || 1;
        
        this.statsModifiers = config.stats || {};
        this.source = config.source || 'unknown';
        this.isDebuff = config.isDebuff || false;
        
        this.onApply = config.onApply || null;
        this.onTick = config.onTick || null;
        this.onRemove = config.onRemove || null;
    }
    
    apply(target, source = null) {
        this.target = target;
        this.applicationTick = 0;
        
        if (Object.keys(this.statsModifiers).length > 0) {
            const modifierId = `effect_${this.id}_${Date.now()}`;
            target.statManager?.addModifier(modifierId, this.statsModifiers);
            this.modifierId = modifierId;
        }
        
        if (this.onApply && typeof this.onApply === 'function') {
            this.onApply(this.target, source);
        }
        
        return true;
    }
    
    remove() {
        if (this.modifierId && this.target?.statManager) {
            this.target.statManager.removeModifier(this.modifierId);
        }
        
        if (this.onRemove && typeof this.onRemove === 'function') {
            this.onRemove(this.target);
        }
        
        this.target = null;
        return true;
    }
    
    onTimeTick() {
        if (this.duration > 0) {
            this.remainingTicks--;
            
            if (this.onTick && typeof this.onTick === 'function') {
                this.onTick(this.target, this.remainingTicks);
            }
            
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
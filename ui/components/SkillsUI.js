// ui/components/SkillsUI.js
/**
 * SkillsUI - три фрейма: Умения, Заклинания, Активные эффекты
 */
class SkillsUI {
    constructor(container, eventBus, getActiveEffects, getAvailableSkills) {
        this.container = container;
        this.eventBus = eventBus;
        this.getActiveEffects = getActiveEffects;
        this.getAvailableSkills = getAvailableSkills;
        
        this.unsubscribeFunctions = [];
    }
    
    init() {
        this.render();
        this.subscribeToEvents();
        return this;
    }
    
    subscribeToEvents() {
        const effectApplied = this.eventBus.on('effect:applied', () => this.refreshEffects());
        const effectRemoved = this.eventBus.on('effect:removed', () => this.refreshEffects());
        const effectUpdated = this.eventBus.on('effect:updated', () => this.refreshEffects());
        
        const statsChanged = this.eventBus.on('player:statsChanged', () => {
            this.refreshSkills();
            this.refreshEffects();
        });
        
        this.unsubscribeFunctions.push(effectApplied, effectRemoved, effectUpdated, statsChanged);
    }
    
    refreshSkills() {
        const skillsList = this.container.querySelector('.skills-list');
        if (!skillsList) return;
        
        const skills = this.getAvailableSkills ? this.getAvailableSkills() : [];
        
        if (!skills || skills.length === 0) {
            skillsList.innerHTML = '<p class="no-data">Умения не изучены</p>';
            return;
        }
        
        let html = '';
        skills.forEach((skill, index) => {
            html += `
                <div class="skill-item">
                    <div class="skill-name">${skill.name || `Умение ${index + 1}`}</div>
                    <div class="skill-description">${skill.description || ''}</div>
                </div>
            `;
        });
        
        skillsList.innerHTML = html;
    }
    
    refreshSpells() {
        const spellsList = this.container.querySelector('.spells-list');
        if (!spellsList) return;
        
        spellsList.innerHTML = '<p class="no-data">Заклинания не изучены</p>';
    }
    
    refreshEffects() {
        const effectsList = this.container.querySelector('.effects-list');
        if (!effectsList) return;
        
        const effects = this.getActiveEffects ? this.getActiveEffects() : [];
        
        if (!effects || effects.length === 0) {
            effectsList.innerHTML = '<p class="no-data">Нет активных эффектов</p>';
            return;
        }
        
        let html = '';
        effects.forEach(effect => {
            const duration = effect.duration > 0 ? `${effect.remainingTicks} ходов` : 'Постоянный';
            const typeClass = effect.isDebuff ? 'debuff' : 'buff';
            
            html += `
                <div class="effect-item ${typeClass}">
                    <div class="effect-name">${effect.name}</div>
                    <div class="effect-duration">${duration}</div>
                    <div class="effect-source">${effect.source || ''}</div>
                </div>
            `;
        });
        
        effectsList.innerHTML = html;
    }
    
    refreshData() {
        this.refreshSkills();
        this.refreshSpells();
        this.refreshEffects();
    }
    
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="skills-three-frames">
                <div class="skills-frame">
                    <h3><i class="fas fa-star"></i> Умения</h3>
                    <div class="frame-content skills-list">
                        <p class="no-data">Загрузка умений...</p>
                    </div>
                </div>
                
                <div class="skills-frame">
                    <h3><i class="fas fa-magic"></i> Заклинания</h3>
                    <div class="frame-content spells-list">
                        <p class="no-data">Загрузка заклинаний...</p>
                    </div>
                </div>
                
                <div class="skills-frame">
                    <h3><i class="fas fa-bolt"></i> Активные эффекты</h3>
                    <div class="frame-content effects-list">
                        <p class="no-data">Загрузка эффектов...</p>
                    </div>
                </div>
            </div>
        `;
        
        this.refreshData();
    }
    
    destroy() {
        this.unsubscribeFunctions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') unsubscribe();
        });
        this.unsubscribeFunctions = [];
        if (this.container) this.container.innerHTML = '';
    }
}

export { SkillsUI };
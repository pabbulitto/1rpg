/**
 * StatsUI - компонент для отображения характеристик D&D
 * Совместим с UIManager из проекта
 */
class StatsUI {
    /**
     * @param {HTMLElement|string} container - Контейнер или его ID
     */
    constructor(container) {
        if (typeof container === 'string') {
            this.container = document.getElementById(container);
        } else {
            this.container = container;
        }
        
        if (!this.container) {
            console.error('StatsUI: контейнер не найден');
        }
        
        this.currentStats = null;
    }
    
    /**
     * Инициализация (совместима с UIManager)
     * @param {Object} game - Экземпляр игры
     * @returns {boolean} Успешность инициализации
     */
    init(game) {
        if (!this.container) return false;
        
        // Подписываемся на обновление характеристик через eventBus
        if (game && game.gameState && game.gameState.eventBus) {
            game.gameState.eventBus.on('player:statsChanged', (stats) => {
                this.update(stats);
            });
        }
        
        // Первоначальный рендер
        this.render();
        return true;
    }
    
    /**
     * Обновление характеристик
     * @param {Object} stats - Характеристики игрока
     */
    update(stats) {
        if (!stats || !this.container) return;
        
        this.currentStats = stats;
        const html = this.generateStatsHTML(stats);
        this.container.innerHTML = html;
    }
    
    /**
     * Генерация HTML с D&D характеристиками
     * ФИКС: правильно работает с данными от GameState.getPlayer() и StatManager.getStatsForUI()
     */
    generateStatsHTML(stats) {
        // Используем данные напрямую из stats (которые приходят от GameState.getPlayer())
        // stats уже содержит: strength, dexterity, strengthMod, dexterityMod, и т.д.
        // И fullStats, если он есть
        
        const s = stats;
        const fullStats = s.fullStats || {};
        const attrs = fullStats.attributes || {};
        const mods = fullStats.modifiers || {};
        
        // Функция для безопасного получения значения
        const getVal = (primary, secondary, fallback) => {
            return primary !== undefined ? primary : 
                   (secondary !== undefined ? secondary : fallback);
        };
        
        return `
            <div class="stats-grid">
                <div class="stats-block">
                    <h3><i class="fas fa-dumbbell"></i> Атрибуты</h3>
                    <div class="stat-row"><span class="stat-label">Сила:</span><span class="stat-value">${getVal(s.strength, attrs.strength, 10)} (${getVal(s.strengthMod, mods.strength, 0) >= 0 ? '+' : ''}${getVal(s.strengthMod, mods.strength, 0)})</span></div>
                    <div class="stat-row"><span class="stat-label">Ловкость:</span><span class="stat-value">${getVal(s.dexterity, attrs.dexterity, 10)} (${getVal(s.dexterityMod, mods.dexterity, 0) >= 0 ? '+' : ''}${getVal(s.dexterityMod, mods.dexterity, 0)})</span></div>
                    <div class="stat-row"><span class="stat-label">Телосложение:</span><span class="stat-value">${getVal(s.constitution, attrs.constitution, 10)} (${getVal(s.constitutionMod, mods.constitution, 0) >= 0 ? '+' : ''}${getVal(s.constitutionMod, mods.constitution, 0)})</span></div>
                    <div class="stat-row"><span class="stat-label">Интеллект:</span><span class="stat-value">${getVal(s.intelligence, attrs.intelligence, 10)} (${getVal(s.intelligenceMod, mods.intelligence, 0) >= 0 ? '+' : ''}${getVal(s.intelligenceMod, mods.intelligence, 0)})</span></div>
                    <div class="stat-row"><span class="stat-label">Мудрость:</span><span class="stat-value">${getVal(s.wisdom, attrs.wisdom, 10)} (${getVal(s.wisdomMod, mods.wisdom, 0) >= 0 ? '+' : ''}${getVal(s.wisdomMod, mods.wisdom, 0)})</span></div>
                    <div class="stat-row"><span class="stat-label">Обаяние:</span><span class="stat-value">${getVal(s.charisma, attrs.charisma, 10)} (${getVal(s.charismaMod, mods.charisma, 0) >= 0 ? '+' : ''}${getVal(s.charismaMod, mods.charisma, 0)})</span></div>
                </div>
                
                <div class="stats-block">
                    <h3><i class="fas fa-fist-raised"></i> Боевые</h3>
                    <div class="stat-row"><span class="stat-label">Атака ближ.:</span><span class="stat-value">${getVal(s.physicalAttackMod, fullStats.combat?.physicalAttackMod, 0) >= 0 ? '+' : ''}${getVal(s.physicalAttackMod, fullStats.combat?.physicalAttackMod, 0)}</span></div>
                    <div class="stat-row"><span class="stat-label">Атака дальн.:</span><span class="stat-value">${getVal(s.rangedAttackMod, fullStats.combat?.rangedAttackMod, 0) >= 0 ? '+' : ''}${getVal(s.rangedAttackMod, fullStats.combat?.rangedAttackMod, 0)}</span></div>
                    <div class="stat-row"><span class="stat-label">Атака маг.:</span><span class="stat-value">${getVal(s.magicAttackMod, fullStats.combat?.magicAttackMod, 0) >= 0 ? '+' : ''}${getVal(s.magicAttackMod, fullStats.combat?.magicAttackMod, 0)}</span></div>
                    <div class="stat-row"><span class="stat-label">Класс защиты:</span><span class="stat-value">${getVal(s.armorClass, fullStats.combat?.armorClass, 10)}</span></div>
                    <div class="stat-row"><span class="stat-label">Броня:</span><span class="stat-value">${getVal(s.armorValue, fullStats.combat?.armorValue, 0)}ед (${getVal(s.damageReduction, fullStats.combat?.damageReduction, 0)}%)</span></div>
                    <div class="stat-row"><span class="stat-label">Крит шанс:</span><span class="stat-value">5%</span></div>
                    <div class="stat-row"><span class="stat-label">Сила крита:</span><span class="stat-value">200%</span></div>
                    <div class="stat-row"><span class="stat-label">Инициатива:</span><span class="stat-value">${getVal(s.initiative, fullStats.combat?.initiative, 10)}</span></div>
                </div>
                
                <div class="stats-block">
                    <h3><i class="fas fa-heartbeat"></i> Ресурсы</h3>
                    <div class="stat-row"><span class="stat-label">Здоровье:</span><span class="stat-value">${s.health || 0}/${s.maxHealth || 0}</span></div>
                    <div class="stat-row"><span class="stat-label">Бонус здоровья:</span><span class="stat-value">+${getVal(s.healthBonus, fullStats.resources?.healthBonus, 0)}</span></div>
                    <div class="stat-row"><span class="stat-label">Восст. здоровья:</span><span class="stat-value">+0/</span></div>
                    <div class="stat-row"><span class="stat-label">Мана:</span><span class="stat-value">${s.mana || 0}/${s.maxMana || 0}</span></div>
                    <div class="stat-row"><span class="stat-label">Восст. маны:</span><span class="stat-value">+${getVal(s.manaRegen, fullStats.resources?.manaRegen, 0)}/</span></div>
                    <div class="stat-row"><span class="stat-label">Выносливость:</span><span class="stat-value">${s.stamina || 0}/${s.maxStamina || 0}</span></div>
                    <div class="stat-row"><span class="stat-label">Восст. вынос.:</span><span class="stat-value">+${getVal(s.staminaRegen, fullStats.resources?.staminaRegen, 0)}/</span></div>
                    <div class="stat-row"><span class="stat-label">Грузоподъемность:</span><span class="stat-value">${getVal(s.carryCapacity, fullStats.utility?.carryCapacity, 0)}</span></div>
                </div>
                
                <div class="stats-block">
                    <h3><i class="fas fa-shield-alt"></i> Сопротивления</h3>
                    <div class="stat-row"><span class="stat-label">Яды:</span><span class="stat-value">${getVal(s.poisonResistance, fullStats.resistances?.poisonResistance, 0)}%</span></div>
                    <div class="stat-row"><span class="stat-label">Болезни:</span><span class="stat-value">${getVal(s.diseaseResistance, fullStats.resistances?.diseaseResistance, 0)}%</span></div>
                    <div class="stat-row"><span class="stat-label">Магия:</span><span class="stat-value">${getVal(s.spellResistance, fullStats.resistances?.spellResistance, 0)}%</span></div>
                    <div class="stat-row"><span class="stat-label">Ментальное:</span><span class="stat-value">${getVal(s.mentalResistance, fullStats.resistances?.mentalResistance, 0)}%</span></div>
                    <div class="stat-row"><span class="stat-label">Чары:</span><span class="stat-value">${getVal(s.charmChance, fullStats.utility?.charmChance, 0)}%</span></div>
                    <div class="stat-row"><span class="stat-label">Удача:</span><span class="stat-value">${getVal(s.luckBonus, fullStats.utility?.luckBonus, 0) >= 0 ? '+' : ''}${getVal(s.luckBonus, fullStats.utility?.luckBonus, 0)}</span></div>
                    <div class="stat-row"><span class="stat-label">Уговор:</span><span class="stat-value">DC ${getVal(s.persuasionDC, fullStats.utility?.persuasionDC, 10)}</span></div>
                </div>
            </div>
        `;
    }
    
    /**
     * Рендер заглушки
     */
    render() {
        if (!this.container) return;
        this.container.innerHTML = '<p class="loading-stats">Загрузка характеристик...</p>';
    }
    
    /**
     * Очистка
     */
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

export { StatsUI };
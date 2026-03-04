/**
 * StatsUI - компонент для отображения характеристик
 * 4 колонки по 225px, высота 507px (колонки 357px + нижняя строка 150px)
 * Совместим с UIManager
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
        this.game = null;
    }
    
    /**
     * Инициализация
     * @param {Object} game - Экземпляр игры
     * @returns {boolean}
     */
    init(game) {
        if (!this.container) return false;
        
        this.game = game;
        
        if (game && game.gameState && game.gameState.eventBus) {
            game.gameState.eventBus.on('player:statsChanged', (stats) => {
                this.update(stats);
            });
        }
        document.getElementById('stats-tab').style.overflowX = 'hidden';
        this.render();
        return true;
    }
    
    /**
     * Обновление характеристик
     * @param {Object} stats - Характеристики игрока от GameState.getPlayer()
     */
    update(stats) {
        if (!stats || !this.container) return;
        
        this.currentStats = stats;
        const html = this.generateStatsHTML(stats);
        this.container.innerHTML = html;
    }
    
    getTotalStat(stats, statName) {
        return stats[statName] || 0;  
    }

    getBaseStat(statName) {
        if (!this.game?.player?.getStatManager) return 0;
        const baseStats = this.game.player.getStatManager().getBaseStats();
        return baseStats[statName] || 0;
    }

    formatStat(stats, statName) {
        const total = this.getTotalStat(stats, statName);      
        const base = this.getBaseStat(statName);                
        const bonus = total - base;                             
        return `${total} (${bonus})`;                           
    }
    
    /**
     * Получить название расы
     */
    getRaceName(raceId) {
        const races = {
            'northerner': 'Северянин',
            'eastern': 'Житель востока',
            'southerner': 'Южанин',
            'barbarian': 'Варвар',
            'western': 'Житель запада'
        };
        return races[raceId] || raceId;
    }
    
    /**
     * Получить название класса
     */
    getClassName(classId) {
        const classes = {
            'strongman': 'Громила',
            'warlock': 'Колдун',
            'thief': 'Вор',
            'healer': 'Лекарь'
        };
        return classes[classId] || classId;
    }
    
    /**
     * Генерация HTML
     */
    generateStatsHTML(stats) {
        const s = stats;
        const fullStats = s.fullStats || {};
        const resources = fullStats.resources || {};
        const combat = fullStats.combat || {};
        const resistances = fullStats.resistances || {};
        
        // Данные персонажа
        const playerName = s.name || 'Герой';
        const playerRace = this.getRaceName(this.game?.player?.race) || '—';
        const playerClass = this.getClassName(this.game?.player?.class) || '—';
        const playerLevel = s.level || 1;
        const playerReinc = this.game?.player?.reincarnations || 0;
        const playerExp = s.exp || 0;
        const playerExpToNext = s.expToNext || 100;
        const playerGold = s.gold || 0;
        const playerSize = 50;
        const influencePoints = 0;
        
        // Атрибуты в формате "родные (итоговые)"
        const strength = this.formatStat(s, 'strength');
        const dexterity = this.formatStat(s, 'dexterity');
        const constitution = this.formatStat(s, 'constitution');
        const intelligence = this.formatStat(s, 'intelligence');
        const wisdom = this.formatStat(s, 'wisdom');
        const charisma = this.formatStat(s, 'charisma');
        
        // Ресурсы
        const health = `${s.health || 0}/${s.maxHealth || 0}`;
        const healthRegen = s.healthRegen || resources.healthRegen || 0;
        const mana = `${s.mana || 0}/${s.maxMana || 0}`;
        const manaRegen = s.manaRegen || resources.manaRegen || 0;
        const stamina = `${s.stamina || 0}/${s.maxStamina || 0}`;
        const staminaRegen = s.staminaRegen || resources.staminaRegen || 0;
        
        // Боевые показатели
        const hitroll = s.hitroll || combat.hitroll || 0;
        const damroll = s.damroll || combat.damroll || 0;
        const initiative = s.initiative || combat.initiative || 0;
        const luckBonus = s.luckBonus || 0;
        const spellPower = s.spellPower || combat.spellPower || 1.0;
        const spellPowerPercent = Math.round(spellPower * 100);
        
        // Защита
        const armorClass = s.armorClass || combat.armorClass || 0;
        const defense = s.defense || combat.defense || 0;
        const armorValue = s.armorValue || combat.armorValue || 0;
        const damageReduction = s.damageReduction || combat.damageReduction || 0;
        
        // Спасброски и сопротивления (заглушки)
        const will = 0;
        const healthSave = 0;
        const fortitude = 0;
        const reflex = 0;
        const spellResist = resistances.spellResistance || s.spellResistance || 0;
        const poison = resistances.poisonResistance || s.poisonResistance || 0;
        const disease = resistances.diseaseResistance || s.diseaseResistance || 0;
        const heavyWounds = 0;
        const mental = resistances.mentalResistance || s.mentalResistance || 0;
        
        // Маг сопротивления (заглушки)
        const fireResist = 0;
        const waterResist = 0;
        const earthResist = 0;
        const airResist = 0;
        const darkResist = 0;
        const mindResist = 0;
        
        // Группа
        const groupInfo = 'не состоит';
        // Скрыть h2 в stats-tab
        const statsTab = document.getElementById('stats-tab');
        const h2 = statsTab.querySelector('h2');
        if (h2) h2.style.display = 'none';
        document.getElementById('stats-content').style.margin = '0';
        document.getElementById('stats-content').style.padding = '0';
        document.getElementById('stats-content').style.position = 'relative';
        
        return `
            <div style="
                height: 507px; 
                width: 894px; 
                position: relative;
                margin: 0;
                padding: 0;
                top: 0;
                left: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 17px;
                color: #ffaa44;
                font-weight: bold;
                line-height: 1.5;
                box-sizing: border-box;                
                overflow: hidden;
            ">
            <!-- Фон с затемнением -->
            <div style="
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: url('assets/backgrounds/stats-bg.jpg');
                background-size: 894px 507px;
                background-repeat: no-repeat;
                background-color: rgba(0, 0, 0, 0.4);
                background-blend-mode: overlay;
                z-index: 1;
            "></div>
            
            <!-- Контент (полностью ваш старый код, без изменений) -->
            <div style="position: relative; z-index: 2; height: 100%; width: 100%; display: flex; flex-direction: column; padding: 0; margin: 0; box-sizing: border-box;">
                
                <!-- Верхняя часть с 4 колонками (357px) -->
                <div style="display: flex; height: 357px;">
                    
                    <!-- Колонка 1 (235px) - Персоналия -->
                    <div style="width: 235px; padding: 8px 10px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
                        <div>
                            <div style="font-weight: bold; margin-bottom: 6px;">${playerName}</div>
                            <div>Раса: ${playerRace}</div>
                            <div>Класс: ${playerClass}</div>
                            <div style="margin-top: 12px;">Уровень: ${playerLevel}</div>
                            <div>Перевоплощений: ${playerReinc}</div>
                            <div style="margin-top: 12px;">Опыт: ${playerExp.toLocaleString()}</div>
                            <div>ДСУ: ${playerExpToNext.toLocaleString()}</div>
                            <div style="margin-top: 12px;">Золото: ${playerGold.toLocaleString()}</div>
                            <div>Размер: ${playerSize}</div>
                            <div style="margin-top: 12px;">Очки влияния: ${influencePoints}</div>
                        </div>                        
                    </div>
                    
                    <!-- Колонка 2 (235px) - Атрибуты и ресурсы -->
                    <div style="width: 235px; padding: 8px 10px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
                        <div>
                            <div>Сила: ${strength}</div>
                            <div>Ловкость: ${dexterity}</div>
                            <div>Телосложение: ${constitution}</div>
                            <div>Интеллект: ${intelligence}</div>
                            <div>Мудрость: ${wisdom}</div>
                            <div>Харизма: ${charisma}</div>
                            <div style="margin-top: 12px;">Жизнь: ${health} [+${healthRegen}]</div>
                            <div>Мана: ${mana} [+${manaRegen}]</div>
                            <div>Выносливость: ${stamina} [+${staminaRegen}]</div>
                        </div>
                    </div>
                    
                    <!-- Колонка 3 (215px) - Боевые показатели и защита -->
                    <div style="width: 215px; padding: 8px 10px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
                        <div>
                            <div>Попадание: ${hitroll}</div>
                            <div>Повреждение: ${damroll}</div>
                            <div>Инициатива: ${initiative}</div>
                            <div>Удача: ${luckBonus}</div>
                            <div>Сила заклинаний: ${spellPowerPercent}%</div>
                            <div style="margin-top: 12px;">Класс защиты: ${armorClass}</div>
                            <div>Защита: ${defense}</div>
                            <div>Броня: ${armorValue}</div>
                            <div>Поглощение: ${damageReduction}%</div>
                        </div>
                    </div>
                    
                    <!-- Колонка 4 (215px) - Спасброски и сопротивления -->
                    <div style="width: 215px; padding: 8px 10px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
                        <div>
                            <div>Воля: ${will}</div>
                            <div>Здоровье: ${healthSave}</div>
                            <div>Стойкость: ${fortitude}</div>
                            <div>Реакция: ${reflex}</div>
                            <div style="margin-top: 12px;">Заклинаниям: ${spellResist}</div>
                            <div>Яды: ${poison}</div>
                            <div>Болезни: ${disease}</div>
                            <div>Тяж. ранам: ${heavyWounds}</div>
                            <div>Ментальное: ${mental}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Нижняя строка (150px) на всю ширину -->
                <div style="height: 150px; width: 100%; padding: 12px 10px; border-top: 1px solid #444; box-sizing: border-box; display: flex; flex-direction: column; justify-content: flex-start;">
                    <div style="margin-bottom: 10px;">Группа: ${groupInfo}</div>
                    <div>Сопротивления типам магии :  огня ${fireResist} / воды ${waterResist} / земли ${earthResist} / воздуха ${airResist} / тьмы ${darkResist} / разума ${mindResist}</div>
                </div>
            </div>
        </div>
        `;
    }
    
    /**
     * Рендер заглушки
     */
    render() {
        if (!this.container) return;
        this.container.innerHTML = '<div style="height: 507px; width: 900px; display: flex; align-items: center; justify-content: center;">Загрузка характеристик...</div>';
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
// ui/components/SkillsUI.js

/**
 * SkillsUI - отображение умений и заклинаний
 * 
 * Левая колонка: Умения (skills) - активные и пассивные
 * Правая колонка: Заклинания (spells) - только активные
 * 
 * При клике на строку - модалка с описанием
 */
class SkillsUI {
    /**
     * @param {HTMLElement} container - контейнер для вкладки
     * @param {EventBus} eventBus - шина событий
     * @param {Object} game - глобальный объект игры
     */
    constructor(container, eventBus, game) {
        this.container = container;
        this.eventBus = eventBus;
        this.game = game;
        
        this.unsubscribeFunctions = [];
        this.infoModal = null;
    }

    /**
     * Инициализация компонента
     */
    init() {
        this.injectStyles();
        this.render();
        this.subscribeToEvents();
        this.bindEvents();
        return this;
    }

    /**
     * Добавить стили для компонента
     */
    injectStyles() {
        const styleId = 'skills-ui-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .skills-container {
                width: 900px;
                height: 507px;
                display: flex;
                gap: 10px;
                padding: 10px;
                box-sizing: border-box;
                background: rgba(20, 20, 30, 0.9);
                color: #e6e6e6;
                font-family: 'Segoe UI', sans-serif;
                overflow: hidden;
            }

            .skills-column {
                flex: 1;
                width: 445px;
                height: 100%;
                overflow-y: auto;
                padding: 0 5px;
                box-sizing: border-box;
            }

            .skills-column.left {
                border-right: 1px solid #444;
            }

            .section {
                margin-bottom: 20px;
            }

            .section-title {
                color: #4ecdc4;
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 10px;
                padding-bottom: 5px;
                border-bottom: 2px solid #3949ab;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .skill-item {
                display: flex;
                align-items: center;
                padding: 6px 8px;
                margin-bottom: 4px;
                background: rgba(40, 40, 60, 0.4);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .skill-item:hover {
                background: rgba(60, 60, 80, 0.6);
            }

            .skill-icon {
                width: 40px;
                height: 40px;
                margin-right: 10px;
                background: #2a2a3a;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                color: #4ecdc4;
            }

            .skill-icon img {
                width: 40px;
                height: 40px;
                object-fit: cover;
                border-radius: 4px;
            }

            .skill-info {
                flex: 1;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .skill-name {
                font-size: 14px;
                color: #fff;
            }

            .skill-mastery {
                font-size: 14px;
                color: #ffaa44;
                background: rgba(0,0,0,0.3);
                padding: 2px 6px;
                border-radius: 10px;
            }

            .skill-type-badge {
                font-size: 11px;
                color: #888;
                margin-left: 8px;
            }

            .no-data {
                color: #aaa;
                text-align: center;
                padding: 20px;
                font-style: italic;
            }

            /* Модальное окно информации */
            .skill-info-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #2a2a2a;
                border: 1px solid #4ecdc4;
                border-radius: 6px;
                padding: 16px 20px;
                z-index: 10000;
                min-width: 260px;
                max-width: 320px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            }

            .skill-info-modal h3 {
                margin: 0 0 8px 0;
                color: #4ecdc4;
                font-size: 16px;
                border-bottom: 1px solid #444;
                padding-bottom: 4px;
            }

            .skill-info-modal .modal-description {
                color: #ccc;
                font-size: 13px;
                line-height: 1.4;
                margin-bottom: 12px;
            }

            .skill-info-modal .modal-details {
                background: rgba(0,0,0,0.2);
                padding: 8px;
                border-radius: 4px;
                margin-bottom: 12px;
                font-size: 12px;
            }

            .skill-info-modal .modal-details div {
                margin: 4px 0;
                color: #aaa;
            }

            .skill-info-modal .modal-details span {
                color: #ffaa44;
                margin-left: 5px;
            }

            .skill-info-modal .close-btn {
                width: 100%;
                padding: 6px;
                background: #3949ab;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 13px;
            }

            .skill-info-modal .close-btn:hover {
                background: #5c6bc0;
            }

            /* Скроллбары */
            .skills-column::-webkit-scrollbar {
                width: 4px;
            }

            .skills-column::-webkit-scrollbar-track {
                background: #1a1a2e;
            }

            .skills-column::-webkit-scrollbar-thumb {
                background: #4ecdc4;
                border-radius: 2px;
            }

            .skills-container {
                background-image: url('assets/backgrounds/skills-bg.jpg');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                position: relative;
            }

            .skills-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(20, 20, 30, 0.6);
                backdrop-filter: blur(2px);
                pointer-events: none;
                z-index: 0;
            }

            .skills-column {
                position: relative;
                z-index: 1;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Подписка на события
     */
    subscribeToEvents() {
        const statsChanged = this.eventBus.on('player:statsChanged', () => this.render());
        const abilityLearned = this.eventBus.on('ability:learned', () => this.render());
        
        this.unsubscribeFunctions.push(statsChanged, abilityLearned);
    }

    /**
     * Привязка событий к DOM
     */
    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const skillItem = e.target.closest('.skill-item');
            if (skillItem) {
                const abilityId = skillItem.dataset.abilityId;
                const type = skillItem.dataset.type;
                this.showAbilityInfo(abilityId, type);
            }
        });
    }

    /**
     * Получить иконку для способности
     */
    getAbilityIcon(ability) {
        if (ability.icon) {
            return `<img src="${ability.icon}" alt="${ability.name}">`;
        }
        // Заглушка по типу
        if (ability.type === 'spell') return '✨';
        if (ability.school) return '🔮';
        if (ability.weaponType) return '⚔️';
        return '📜';
    }

    /**
     * Получить список умений (skills)
     */
    getSkills() {
        if (!this.game.abilityService) return [];
        
        const allSkills = this.game.abilityService.getCharacterAbilities(
            this.game.player.id,
            'skill'
        );
        
        // Сортируем: сначала активные, потом пассивные
        return allSkills.sort((a, b) => {
            const aActive = a.isBattle ? 1 : 0;
            const bActive = b.isBattle ? 1 : 0;
            return bActive - aActive;
        });
    }

    /**
     * Получить список заклинаний (spells)
     */
    getSpells() {
        if (!this.game.abilityService) return [];
        
        return this.game.abilityService.getCharacterAbilities(
            this.game.player.id,
            'spell'
        );
    }

    /**
     * Получить мастерство для способности
     */
    getMastery(abilityId) {
        if (!this.game.abilityService) return 0;
        return this.game.abilityService.getMastery(this.game.player.id, abilityId) || 0;
    }

    /**
     * Показать информацию о способности
     */
    showAbilityInfo(abilityId, type) {
        const ability = this.game.abilityService.getAbility(abilityId);
        if (!ability) return;

        this.closeModal();

        const modal = document.createElement('div');
        modal.className = 'skill-info-modal';

        // Форматируем требования
        const requirements = [];
        if (ability.requirements) {
            if (ability.requirements.intelligence) requirements.push(`Инт ${ability.requirements.intelligence}`);
            if (ability.requirements.strength) requirements.push(`Сил ${ability.requirements.strength}`);
            if (ability.requirements.level) requirements.push(`Ур ${ability.requirements.level}`);
        }

        // Форматируем детали
        let detailsHtml = '<div class="modal-details">';
        
        if (ability.type === 'spell') {
            detailsHtml += `<div>Школа: <span>${this._getSchoolName(ability.school)}</span></div>`;
        }
        
        if (ability.manaCost) {
            detailsHtml += `<div>Мана: <span>${ability.manaCost}</span></div>`;
        }
        
        if (ability.staminaCost) {
            detailsHtml += `<div>Выносливость: <span>${ability.staminaCost}</span></div>`;
        }
        
        if (requirements.length > 0) {
            detailsHtml += `<div>Требует: <span>${requirements.join(', ')}</span></div>`;
        }
        
        detailsHtml += '</div>';

        modal.innerHTML = `
            <h3>${ability.name}</h3>
            <div class="modal-description">${ability.description || 'Нет описания'}</div>
            ${detailsHtml}
            <button class="close-btn">Закрыть</button>
        `;

        document.body.appendChild(modal);
        this.infoModal = modal;

        modal.querySelector('.close-btn').addEventListener('click', () => this.closeModal());

        setTimeout(() => {
            document.addEventListener('click', function closeHandler(e) {
                if (!modal.contains(e.target)) {
                    modal.remove();
                    document.removeEventListener('click', closeHandler);
                }
            });
        }, 10);
    }

    /**
     * Получить название школы магии
     */
    _getSchoolName(school) {
        const names = {
            'fire': 'Огонь',
            'water': 'Вода',
            'air': 'Воздух',
            'earth': 'Земля',
            'life': 'Жизнь',
            'mind': 'Разум',
            'dark': 'Тьма'
        };
        return names[school] || school;
    }

    /**
     * Закрыть модальное окно
     */
    closeModal() {
        if (this.infoModal) {
            this.infoModal.remove();
            this.infoModal = null;
        }
    }

    /**
     * Отрисовать левую колонку (умения)
     */
    renderSkillsColumn() {
        const skills = this.getSkills();
        
        if (skills.length === 0) {
            return `
                <div class="skills-column left">
                    <div class="no-data">Умения не изучены</div>
                </div>
            `;
        }

        let activeHtml = '';
        let passiveHtml = '';

        skills.forEach(skill => {
            const mastery = this.getMastery(skill.id);
            const icon = this.getAbilityIcon(skill);
            
            const itemHtml = `
                <div class="skill-item" data-ability-id="${skill.id}" data-type="skill">
                    <div class="skill-icon">${icon}</div>
                    <div class="skill-info">
                        <span class="skill-name">${skill.name}</span>
                        <span class="skill-mastery">${mastery}%</span>
                    </div>
                </div>
            `;

            if (skill.isBattle) {
                activeHtml += itemHtml;
            } else {
                passiveHtml += itemHtml;
            }
        });

        return `
            <div class="skills-column left">
                ${activeHtml ? '<div class="section"><div class="section-title">▶ АКТИВНЫЕ</div>' + activeHtml + '</div>' : ''}
                ${passiveHtml ? '<div class="section"><div class="section-title">▶ ПАССИВНЫЕ</div>' + passiveHtml + '</div>' : ''}
            </div>
        `;
    }

    /**
     * Отрисовать правую колонку (заклинания)
     */
    renderSpellsColumn() {
        const spells = this.getSpells();
        
        if (spells.length === 0) {
            return `
                <div class="skills-column">
                    <div class="no-data">Заклинания не изучены</div>
                </div>
            `;
        }

        let spellsHtml = '';

        spells.forEach(spell => {
            const mastery = this.getMastery(spell.id);
            const icon = this.getAbilityIcon(spell);
            
            spellsHtml += `
                <div class="skill-item" data-ability-id="${spell.id}" data-type="spell">
                    <div class="skill-icon">${icon}</div>
                    <div class="skill-info">
                        <span class="skill-name">${spell.name}</span>
                        <span class="skill-mastery">${mastery}%</span>
                    </div>
                </div>
            `;
        });

        return `
            <div class="skills-column">
                <div class="section">
                    <div class="section-title">▶ ЗАКЛИНАНИЯ</div>
                    ${spellsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Основной рендер
     */
    render() {
        if (!this.container) return;

        const html = `
            <div class="skills-container">
                ${this.renderSkillsColumn()}
                ${this.renderSpellsColumn()}
            </div>
        `;

        this.container.innerHTML = html;
    }

    /**
     * Очистка при уничтожении
     */
    destroy() {
        this.closeModal();
        this.unsubscribeFunctions.forEach(fn => fn && fn());
        if (this.container) this.container.innerHTML = '';
    }
}

export { SkillsUI };
// ui/components/PassivesEffectsUI.js

/**
 * PassivesEffectsUI - компонент для отображения пассивных способностей и эффектов
 * 
 * Левая колонка: способности (врожденные + изученные с пустыми слотами)
 * Правая колонка: эффекты (постоянные + временные)
 * 
 * При клике на элемент - модальное окно с описанием
 */
class PassivesEffectsUI {
    /**
     * @param {HTMLElement} container - контейнер для вкладки
     * @param {EventBus} eventBus - шина событий
     * @param {Object} game - глобальный объект игры
     * @param {Function} getPassiveManager - функция, возвращающая passiveManager игрока
     * @param {Function} getActiveEffects - функция, возвращающая массив активных эффектов
     */
    constructor(container, eventBus, game, getPassiveManager, getActiveEffects) {
        this.container = container;
        this.eventBus = eventBus;
        this.game = game;
        this.getPassiveManager = getPassiveManager;
        this.getActiveEffects = getActiveEffects;
        
        this.unsubscribeFunctions = [];
        this.infoModal = null;
        this.currentItem = null;
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
        const styleId = 'passives-effects-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .passives-effects-container {
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

            /* Левая колонка - способности */
            .passives-column {
                flex: 1;
                width: 445px;
                height: 100%;
                overflow-y: auto;
                padding-right: 5px;
                box-sizing: border-box;
            }

            /* Правая колонка - эффекты */
            .effects-column {
                flex: 1;
                width: 445px;
                height: 100%;
                overflow-y: auto;
                padding-left: 5px;
                box-sizing: border-box;
                border-left: 1px solid #444;
            }

            /* Секции */
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

            /* Элементы списков */
            .passive-item, .effect-item {
                padding: 6px 10px;
                margin-bottom: 2px;
                background: rgba(40, 40, 60, 0.4);
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .passive-item:hover, .effect-item:hover {
                background: rgba(60, 60, 80, 0.6);
            }

            /* Врожденные способности */
            .passive-item.innate {
                color: #ffaa44;
            }

            /* Изученные способности */
            .passive-item.learned {
                color: #4ecdc4;
            }

            /* Пустые слоты */
            .passive-item.empty-slot {
                color: #666;
                font-style: italic;
                cursor: default;
                background: rgba(30, 30, 40, 0.2);
            }

            .passive-item.empty-slot:hover {
                background: rgba(30, 30, 40, 0.2);
            }

            /* Эффекты */
            .effect-item.permanent {
                color: #888;
            }

            .effect-item.temporary {
                color: #ffaa44;
            }

            .effect-name {
                font-weight: normal;
            }

            .effect-duration {
                color: #aaa;
                font-size: 12px;
                margin-left: 8px;
            }

            .passive-level, .slot-level {
                color: #aaa;
                font-size: 12px;
                margin-left: 8px;
            }

            /* Модальное окно - минималистичное */
            .passive-info-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #2a2a2a;
                border: 1px solid #4ecdc4;
                border-radius: 6px;
                padding: 16px 20px;
                z-index: 10000;
                min-width: 240px;
                max-width: 320px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            }

            .passive-info-modal h3 {
                margin: 0 0 8px 0;
                color: #4ecdc4;
                font-size: 16px;
                font-weight: normal;
                border-bottom: 1px solid #444;
                padding-bottom: 4px;
            }

            .passive-info-modal .modal-description {
                color: #ccc;
                font-size: 13px;
                line-height: 1.4;
                margin-bottom: 16px;
            }

            .passive-info-modal .close-btn {
                width: 100%;
                padding: 6px;
                background: #3949ab;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 13px;
            }

            .passive-info-modal .close-btn:hover {
                background: #5c6bc0;
            }

            /* Скроллбары - аккуратные */
            .passives-column::-webkit-scrollbar,
            .effects-column::-webkit-scrollbar {
                width: 4px;
            }

            .passives-column::-webkit-scrollbar-track,
            .effects-column::-webkit-scrollbar-track {
                background: #1a1a2e;
            }

            .passives-column::-webkit-scrollbar-thumb,
            .effects-column::-webkit-scrollbar-thumb {
                background: #4ecdc4;
                border-radius: 2px;
            }

            .passives-effects-container {
                background-image: url('assets/backgrounds/passives-bg.jpg');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                position: relative;
            }

            .passives-effects-container::before {
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

            .passives-column, .effects-column {
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
        // Обновление при изменении характеристик (могут повлиять на доступные слоты)
        const statsChanged = this.eventBus.on('player:statsChanged', () => this.render());
        
        // Обновление при изучении пассивки
        const passiveLearned = this.eventBus.on('passive:learned', () => this.render());
        
        // Обновление при изменении эффектов
        const effectApplied = this.eventBus.on('effect:applied', () => this.render());
        const effectRemoved = this.eventBus.on('effect:removed', () => this.render());
        const effectUpdated = this.eventBus.on('effect:updated', () => this.render());
        
        this.unsubscribeFunctions.push(
            statsChanged, passiveLearned,
            effectApplied, effectRemoved, effectUpdated
        );
    }

    /**
     * Привязка событий к DOM
     */
    bindEvents() {
        this.container.addEventListener('click', (e) => {
            // Клик по способности (не пустому слоту)
            const passiveItem = e.target.closest('.passive-item:not(.empty-slot)');
            if (passiveItem) {
                const passiveId = passiveItem.dataset.id;
                this.showPassiveInfo(passiveId);
                return;
            }

            // Клик по эффекту
            const effectItem = e.target.closest('.effect-item');
            if (effectItem) {
                const sourceId = effectItem.dataset.sourceId;
                this.showEffectInfo(sourceId);
                return;
            }
        });
    }

    /**
     * Показать информацию о пассивной способности
     * @param {string} passiveId 
     */
    showPassiveInfo(passiveId) {
        const passive = window.game.passiveAbilityService.getPassive(passiveId);
        if (!passive) return;

        this.closeModal();

        const modal = document.createElement('div');
        modal.className = 'passive-info-modal';

        // Определяем тип способности (врожденная или изученная)
        const manager = this.getPassiveManager();
        let type = 'обычная';
        if (manager) {
            const allPassives = manager.getAllPassives();
            if (allPassives.innate.includes(passiveId)) {
                type = 'врожденная';
            } else if (allPassives.learned.some(p => p.id === passiveId)) {
                type = 'изученная';
            }
        }

        // ТОЛЬКО название, тип и описание - никаких модификаторов!
        modal.innerHTML = `
            <h3>${passive.name}</h3>
            <div class="modal-type">${type}</div>
            <div class="modal-description">${passive.description || 'Нет описания'}</div>
            <button class="close-btn">Закрыть</button>
        `;

        document.body.appendChild(modal);
        this.infoModal = modal;

        modal.querySelector('.close-btn').addEventListener('click', () => this.closeModal());

        // Закрытие по клику вне модалки
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
     * Показать информацию об эффекте
     * @param {string} sourceId 
     */
    showEffectInfo(sourceId) {
        const effects = this.getActiveEffects ? this.getActiveEffects() : [];
        const effect = effects.find(e => e.sourceId === sourceId);
        if (!effect) return;

        this.closeModal();

        const modal = document.createElement('div');
        modal.className = 'passive-info-modal';

        const duration = effect.duration > 0 ? 
            `Осталось: ${effect.remainingTicks} ходов` : 
            'Постоянный';

        const typeText = effect.isDebuff ? 'вредный эффект' : 'полезный эффект';

        // ТОЛЬКО название, тип, описание и длительность - никаких модификаторов!
        modal.innerHTML = `
            <h3>${effect.name}</h3>
            <div class="modal-type">${typeText}</div>
            <div class="modal-description">${effect.description || 'Нет описания'}</div>
            <div class="modal-duration">${duration}</div>
            ${effect.currentStacks > 1 ? `<div class="modal-stacks">Стаков: ${effect.currentStacks}</div>` : ''}
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
     * Закрыть модальное окно
     */
    closeModal() {
        if (this.infoModal) {
            this.infoModal.remove();
            this.infoModal = null;
        }
    }

    /**
     * Отрисовать левую колонку (способности)
     * @returns {string} HTML
     */
    renderPassivesColumn() {
        const manager = this.getPassiveManager();
        if (!manager) {
            return '<div class="passives-column">Ошибка загрузки способностей</div>';
        }

        const allPassives = manager.getAllPassives();
        const step = manager.getStep();
        const currentLevel = this.game.player.getStats().level;

        // Получаем все слот-уровни до текущего
        const slotLevels = manager.getSlotLevels(currentLevel);

        // Создаем Map для быстрого поиска пассивок по уровню
        const passiveByLevel = new Map();
        allPassives.learned.forEach(p => {
            passiveByLevel.set(p.level, p.id);
        });

        // Врожденные способности
        let innateHtml = '';
        if (allPassives.innate.length > 0) {
            innateHtml = '<div class="section"><div class="section-title">▶ ВРОЖДЕННЫЕ</div>';
            allPassives.innate.forEach(id => {
                const passive = window.game.passiveAbilityService.getPassive(id);
                if (passive) {
                    innateHtml += `
                        <div class="passive-item innate" data-id="${id}">
                            <span class="effect-name">• ${passive.name}</span>
                        </div>
                    `;
                }
            });
            innateHtml += '</div>';
        }

        // Изученные способности + пустые слоты
        let learnedHtml = '<div class="section"><div class="section-title">▶ ИЗУЧЕННЫЕ</div>';

        slotLevels.forEach(level => {
            const passiveId = passiveByLevel.get(level);
            
            if (passiveId) {
                // На этом уровне есть изученная пассивка
                const passive = window.game.passiveAbilityService.getPassive(passiveId);
                learnedHtml += `
                    <div class="passive-item learned" data-id="${passiveId}">
                        <span class="effect-name">• ${passive.name}</span>
                        <span class="passive-level">(ур. ${level})</span>
                    </div>
                `;
            } else {
                // Пустой слот
                learnedHtml += `
                    <div class="passive-item empty-slot">
                        <span class="effect-name">• [пустой слот]</span>
                        <span class="slot-level">(ур. ${level})</span>
                    </div>
                `;
            }
        });

        learnedHtml += '</div>';

        return `
            <div class="passives-column">
                ${innateHtml}
                ${learnedHtml}
            </div>
        `;
    }
    /**
     * Отрисовать правую колонку (эффекты)
     * @returns {string} HTML
     */
    renderEffectsColumn() {
        const effects = this.getActiveEffects ? this.getActiveEffects() : [];

        // Разделяем на постоянные и временные
        const permanent = effects.filter(e => e.duration === 0);
        const temporary = effects.filter(e => e.duration > 0);

        let html = '<div class="effects-column">';

        // Постоянные эффекты
        if (permanent.length > 0) {
            html += '<div class="section"><div class="section-title">▶ ПОСТОЯННЫЕ</div>';
            permanent.forEach(effect => {
                html += `
                    <div class="effect-item permanent" data-source-id="${effect.sourceId}">
                        <span class="effect-name">• ${effect.name}</span>
                        <span class="effect-duration">(П)</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Временные эффекты
        if (temporary.length > 0) {
            html += '<div class="section"><div class="section-title">▶ ВРЕМЕННЫЕ</div>';
            temporary.forEach(effect => {
                // Форматирование времени: если duration в тиках, конвертируем в часы
                // Предполагаем, что 1 тик = 1 минута, тогда часы = тики / 60
                const hours = Math.ceil(effect.remainingTicks / 60);
                
                html += `
                    <div class="effect-item temporary" data-source-id="${effect.sourceId}">
                        <span class="effect-name">• ${effect.name}</span>
                        <span class="effect-duration">(${hours}ч)</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Если нет эффектов
        if (permanent.length === 0 && temporary.length === 0) {
            html += '<div class="section"><p style="color: #aaa; text-align: center; padding: 20px;">Нет активных эффектов</p></div>';
        }

        html += '</div>';
        return html;
    }

    /**
     * Основной рендер
     */
    render() {
        if (!this.container) return;
        
        const manager = this.getPassiveManager();
        if (!manager) {
            this.container.innerHTML = '<div style="padding:20px; text-align:center; color:#aaa;">Менеджер пассивок не инициализирован</div>';
            return;
        }

        const html = `
            <div class="passives-effects-container">
                ${this.renderPassivesColumn()}
                ${this.renderEffectsColumn()}
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

export { PassivesEffectsUI };
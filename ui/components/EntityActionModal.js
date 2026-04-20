// ui/components/EntityActionModal.js

/**
 * Универсальная модалка для взаимодействия с сущностями
 * 
 * Режимы:
 * - main: показывает кнопки действий для типа сущности
 * - ability: показывает список заклинаний/умений для применения
 */
class EntityActionModal {
    /**
     * @param {Object} options
     * @param {string} options.entityId - ID сущности
     * @param {string} options.entityType - тип ('living', 'corpse', 'item', 'object')
     * @param {Object} options.entityData - данные сущности (имя и т.д.)
     * @param {Object} options.game - глобальный объект игры
     * @param {EventBus} options.eventBus - шина событий
     * @param {Function} options.onClose - колбэк при закрытии
     */
    constructor({ entityId, entityType, entityData, game, eventBus, onClose }) {
        this.entityId = entityId;
        this.entityType = entityType;
        this.entityData = entityData;
        this.game = game;
        this.battleOrchestrator = game.battleOrchestrator;
        this.eventBus = eventBus;
        this.onClose = onClose;
        this.globalListenersAttached = false;
        this.justOpened = false;
        this.dialogueSystem = game.dialogueSystem;
        
        // Получаем саму сущность по ID
        const entity = game.zoneManager?.getEntityById(entityId);
        
        // Определяем, является ли сущность NPC
        this.isNPC = entity && typeof entity.isNPC === 'function' ? entity.isNPC() : false;
        this.services = this.isNPC && entity ? entity.services : {};
        
        this.mode = 'main';
        this.abilityType = null;
        this.abilities = [];
        
        this.modal = null;
    }

    _attachGlobalListeners() {
        // Если уже привязаны - выходим
        if (this.globalListenersAttached) return;
        
        // Привязываем обработчик на крестик (через делегирование)
        this.modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-btn')) {
                this.close();
            }
        });
        
        this.outsideClickHandler = (e) => {
            // Игнорировать клик, если модалка только что открылась
            if (this.justOpened) {
                return;
            }
            
            // Опционально: игнорировать клики в течение 300мс после открытия
            if (Date.now() - this.openedTime < 300) {
                return;
            }
            
            if (this.modal && !this.modal.contains(e.target)) {
                this.close();
            }
        };
        
        document.addEventListener('click', this.outsideClickHandler);
        
        this.globalListenersAttached = true;
    }
    _attachContextListeners() {
        if (!this.modal) return;
        
        if (this.mode === 'main') {
            // Получаем все кнопки действий
            const buttons = this.getMainButtons();
            buttons.forEach(btn => {
                const elements = this.modal.querySelectorAll(`[data-action="${btn.label}"]`);
                elements.forEach(element => {
                    // Убираем старые обработчики через замену клонирования или просто добавляем новый
                    element.replaceWith(element.cloneNode(true));
                    const newElement = this.modal.querySelector(`[data-action="${btn.label}"]`);
                    if (newElement) {
                        newElement.addEventListener('click', () => btn.action());
                    }
                });
            });
        } else {
            // Обработка кнопок способностей
            this.modal.querySelectorAll('.ability-btn').forEach(btn => {
                btn.replaceWith(btn.cloneNode(true));
                const newBtn = this.modal.querySelector(`[data-ability-id="${btn.dataset.abilityId}"]`);
                if (newBtn) {
                    newBtn.addEventListener('click', () => {
                        const abilityId = newBtn.dataset.abilityId;
                        const ability = this.abilities.find(a => a.id === abilityId);
                        if (ability) this.useAbility(ability);
                    });
                }
            });
            
            // Обработка кнопки "Назад"
            const backBtn = this.modal.querySelector('.back-btn');
            if (backBtn) {
                backBtn.replaceWith(backBtn.cloneNode(true));
                const newBackBtn = this.modal.querySelector('.back-btn');
                if (newBackBtn) {
                    newBackBtn.addEventListener('click', () => this.backToMain());
                }
            }
        }
    }
    /**
     * Показать модалку
     */
    show() {
        this.createModal();
        this.justOpened = true;           
        this.openedTime = Date.now();      
        this.render();
        this._attachGlobalListeners();
        
        setTimeout(() => {
            this.justOpened = false;
        }, 300); 
    }

    /**
     * Создать DOM элемент модалки
     */
    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'entity-action-modal';
        document.body.appendChild(this.modal);
    }

    /**
     * Закрыть модалку
     */
    close() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        
        // Удаляем обработчик с документа
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
            this.outsideClickHandler = null;
        }
        
        this.globalListenersAttached = false; 
        this.justOpened = false; 
        
        if (this.onClose) this.onClose();
    }

    /**
     * Получить заголовок в зависимости от режима
     */
    getTitle() {
        if (this.mode === 'main') {
            // Для живых существ показываем уровень и здоровье
            if (this.entityType === 'living' && this.entityData.level) {
                return `${this.entityData.name} (ур. ${this.entityData.level}) - Здоровье: ${this.entityData.health}/${this.entityData.maxHealth}`;
            }
            
            // Для остальных типов
            const names = {
                'living': this.entityData?.name || 'Существо',
                'corpse': this.entityData?.name || 'Труп',
                'item': this.entityData?.name || 'Предмет',
                'object': this.entityData?.name || 'Объект'
            };
            return names[this.entityType] || 'Сущность';
        } else {
            // В режиме выбора способностей
            return this.abilityType === 'spell' ? 'Выберите заклинание' : 'Выберите умение';
        }
    }

    /**
     * Получить кнопки для main режима
     */
    getMainButtons() {
        const buttons = [];
        
        // Осмотр - для всех
        buttons.push({
            icon: '🔍',
            label: 'Осмотреть',
            action: () => this.examine()
        });
        
        switch(this.entityType) {
            case 'living':
                buttons.push(
                    { icon: '💬', label: 'Говорить', action: () => this.talk() },
                    { icon: '⚔️', label: 'Атаковать', action: () => this.attack() },
                    { icon: '✨', label: 'Заклинания', action: () => this.showAbilities('spell') },
                    { icon: '🌀', label: 'Умения', action: () => this.showAbilities('skill') },
                    { icon: '🎁', label: 'Дать предмет', action: () => this.giveItem() }
                );
                break;
                
            case 'corpse':
                // Здесь только кнопки для вызова списков
                buttons.push(
                    { icon: '✨', label: 'Заклинания', action: () => this.showAbilities('spell') },
                    { icon: '🌀', label: 'Умения', action: () => this.showAbilities('skill') }
                );
                break;
                
            case 'item':
                buttons.push(
                    { icon: '👆', label: 'Поднять', action: () => this.pickup() }
                );
                break;
                
            case 'object':
                buttons.push(
                    { icon: '👆', label: 'Использовать', action: () => this.use() },
                    { icon: '🔧', label: 'Применить', action: () => this.applyTool() },
                    { icon: '✨', label: 'Заклинания', action: () => this.showAbilities('spell') },
                    { icon: '🌀', label: 'Умения', action: () => this.showAbilities('skill') }
                );
                break;
        }
        
        return buttons;
    }
    /**
     * Получить список способностей для выбора
     */
    getAbilitiesList() {
        if (!this.abilityType) return [];
        
        const allAbilities = this.game.abilityService.getCharacterAbilities(
            this.game.player.id,
            this.abilityType
        );
        
        // Для живых существ - только активные способности
        if (this.entityType === 'living') {
            return allAbilities.filter(ability => {

                const isActive = 
                    ability.isBattle === true ||
                    ability.startsCombat === true ||
                    (ability.damageFormula && ability.damageFormula !== '0') ||
                    (ability.effects && ability.effects.length > 0) ||
                    ability.mechanic ||
                    ability.type === 'spell';
                
                return isActive;
            });
        }
        
        // Для трупов и объектов - фильтруем по targetMain
        const targetMain = this.entityType === 'corpse' ? 'corpse' : 'object';
        return allAbilities.filter(ability => {
            // Сначала проверяем targetMain
            const targetMatch = ability.targetMain === targetMain || ability.targetMain === 'any';
            if (!targetMatch) return false;
            
            // Потом проверяем, что это активная способность
            const isActive = 
                ability.isBattle === true ||
                ability.startsCombat === true ||
                (ability.damageFormula && ability.damageFormula !== '0') ||
                (ability.effects && ability.effects.length > 0) ||
                ability.mechanic;
            
            return isActive;
        });
    }
    /**
     * Переключиться в режим выбора способностей
     */
    showAbilities(type) {
        this.mode = 'ability';
        this.abilityType = type;
        this.abilities = this.getAbilitiesList();
        
        // Устанавливаем флаг, что мы сейчас переключаем режим
        this.justOpened = true;
        this.openedTime = Date.now();
        
        this.render();
        
        // Сбросить флаг через задержку
        setTimeout(() => {
            this.justOpened = false;
        }, 300);
    }
    /**
     * Применить способность к цели
     */
    useAbility(ability) {
        console.log('Применяю способность:', ability.name, 'к цели:', this.entityId);
        
        // Получаем цель
        const target = this.game.zoneManager.getEntityById(this.entityId);
        
        if (!target) {
            console.error('Цель не найдена');
            this.close();
            return;
        }
        
        // Определяем, боевая ли способность (начинает бой или наносит урон)
        const isCombatAbility = ability.startsCombat === true || 
                            ability.isBattle === true || 
                            (ability.damageFormula && ability.damageFormula !== '0');
        
        // Является ли цель врагом (живой не-игрок)
        const isEnemy = target.type !== 'player' && target.state === 'alive';
        
        // Боевая способность на врага - начинаем бой
        if (isEnemy && isCombatAbility) {
            console.log('Начинаю бой с', target.name);
            
            // Начинаем бой
            this.game.battleOrchestrator.startBattle(target);
            
            // Даем время на инициализацию боя, затем применяем способность
            setTimeout(() => {
                this.eventBus.emit('combat:playerSelectedAction', {
                    action: {
                        type: 'ability',
                        data: ability
                    }
                });
            }, 200);
            
            this.close();
            return;
        }
        
        // Боевая способность на игрока или союзника - не должна применяться
        if (!isEnemy && isCombatAbility) {
            console.log('Нельзя применить боевую способность на союзника');
            this.eventBus.emit('log:add', {
                message: 'Нельзя применить боевую способность на союзника',
                type: 'warning'
            });
            this.close();
            return;
        }
        
        // Мирное применение (лечение, баффы, полет и т.д.)
        console.log('Мирное применение способности');
        const result = this.game.gameManager.useAbilityOnEntity(ability.id, this.entityId);
        
        this.eventBus.emit('player:statsChanged', this.game.player.getStats());
        this.game.uiManager.updatePlayerStats(this.game.player.getStats());
        
        this.close();
    }
    /**
     * Вернуться в главное меню
     */
    backToMain() {
        this.mode = 'main';
        this.abilityType = null;
        this.abilities = [];
        
        this.justOpened = true;
        this.openedTime = Date.now();
        
        this.render();
        
        setTimeout(() => {
            this.justOpened = false;
        }, 300);
    }

    // ===== Действия (заглушки) =====
    examine() {
        console.log('Осмотр сущности:', this.entityId);
        this.eventBus.emit('log:add', { message: 'Осмотр пока не реализован', type: 'info' });
    }

    talk() {
        // Получаем сущность
        const entity = this.game.zoneManager?.getEntityById(this.entityId);
        
        // Если это NPC с диалогом - запускаем DialogueSystem
        if (this.isNPC && entity && entity.dialogueTree) {
            this.close();
            this.dialogueSystem.startDialogue(entity, entity.dialogueTree);
        } else if (this.isNPC && entity) {
            // NPC без диалога - показываем простое сообщение
            console.log('Разговор с:', this.entityId);
            this.eventBus.emit('log:add', { 
                message: `${entity.name} молча смотрит на вас.`, 
                type: 'info' 
            });
            this.close();
        } else {
            // Для обычных существ - заглушка
            console.log('Разговор с:', this.entityId);
            this.eventBus.emit('log:add', { 
                message: `${this.entityData?.name || 'Существо'} не хочет говорить`, 
                type: 'info' 
            });
        }
    }
      
    attack() {
        const entity = this.game.zoneManager.getEntityById(this.entityId);
        if (entity && entity.state === 'alive') {
            this.game.battleOrchestrator.startBattle(entity);
            this.close();
        } else {
            this.eventBus.emit('log:add', { 
                message: 'Нельзя атаковать эту цель', 
                type: 'error' 
            });
        }
    }

    giveItem() {
        console.log('Передача предмета:', this.entityId);
        this.eventBus.emit('log:add', { message: 'Передача предметов пока не реализована', type: 'info' });
    }

    pickup() {
        // Для предметов на земле
        console.log('Поднять предмет:', this.entityId);
        // TODO: реализовать
    }

    use() {
        // Для объектов
        console.log('Использовать объект:', this.entityId);
        this.eventBus.emit('log:add', { message: 'Использование объектов пока не реализовано', type: 'info' });
    }

    applyTool() {
        // Открыть список инструментов
        console.log('Применить инструмент к:', this.entityId);
        this.eventBus.emit('log:add', { message: 'Применение инструментов пока не реализовано', type: 'info' });
    }

    /**
     * Отрендерить содержимое
     */
    render() {
        if (!this.modal) return;
        
        const title = this.getTitle();
        
        let content = '';
        
        if (this.mode === 'main') {
            // Рендерим кнопки main режима
            const buttons = this.getMainButtons();
            content = buttons.map(btn => 
                `<button class="modal-btn" data-action="${btn.label}">${btn.icon} ${btn.label}</button>`
            ).join('');
        } else {
            // Рендерим список способностей
            if (this.abilities.length === 0) {
                content = '<p class="no-abilities">Нет доступных способностей</p>';
            } else {
                content = this.abilities.map(ability => 
                    `<button class="modal-btn ability-btn" data-ability-id="${ability.id}">${ability.name}</button>`
                ).join('');
            }
            // Кнопка назад
            content += '<button class="modal-btn back-btn">◀ Назад</button>';
        }
        
        this.modal.innerHTML = `
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close-btn">&times;</button>
            </div>
            <div class="modal-content">
                ${content}
            </div>
        `;

        this._attachContextListeners();
    }

    /**
     * Привязать события
     */
    attachEvents() {
        if (!this.modal) return;
        
        // Закрытие
        this.modal.querySelector('.close-btn').addEventListener('click', () => this.close());
        
        if (this.mode === 'main') {
            // Обработка кнопок main режима
            const buttons = this.getMainButtons();
            buttons.forEach(btn => {
                const element = this.modal.querySelector(`[data-action="${btn.label}"]`);
                if (element) {
                    element.addEventListener('click', () => btn.action());
                }
            });
        } else {
            // Обработка выбора способности
            this.modal.querySelectorAll('.ability-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const abilityId = btn.dataset.abilityId;
                    const ability = this.abilities.find(a => a.id === abilityId);
                    if (ability) this.useAbility(ability);
                });
            });
            
            // Кнопка назад
            const backBtn = this.modal.querySelector('.back-btn');
            if (backBtn) {
                backBtn.addEventListener('click', () => this.backToMain());
            }
        }
    }
}

export { EntityActionModal };
// ui/components/DialogueUI.js

/**
 * DialogueUI - компонент для отображения диалогового окна
 * Показывает текст NPC и кнопки с вариантами ответа игрока
 */
class DialogueUI {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.modal = null;
        this.currentData = null;
        this.onSelect = null;
        this.onBack = null;
        this.mode = 'dialogue'; // 'dialogue' или 'abilityList'
        this.isVisible = false;
        this.overlay = null;
        
        this.injectStyles();
    }
    
    /**
     * Добавить стили для диалогового окна
     */
    injectStyles() {
        const styleId = 'dialogue-ui-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .dialogue-modal {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                width: 700px;
                max-width: 90vw;
                background: rgba(20, 20, 30, 0.95);
                border: 2px solid #4ecdc4;
                border-radius: 12px;
                padding: 20px;
                z-index: 10000;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8);
                font-family: 'Segoe UI', sans-serif;
                backdrop-filter: blur(4px);
                overflow-x: hidden;
                word-wrap: break-word;
            }
            
            .dialogue-npc-name {
                color: #ffaa44;
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 10px;
                padding-bottom: 8px;
                border-bottom: 1px solid #4ecdc4;
                word-wrap: break-word;
            }
            
            .dialogue-npc-text {
                color: #e6e6e6;
                font-size: 16px;
                line-height: 1.5;
                margin-bottom: 20px;
                min-height: 60px;
                word-wrap: break-word;
                overflow-x: hidden;
            }
            
            .dialogue-options {
                display: flex;
                flex-direction: column;
                gap: 8px;
                overflow-x: hidden;
            }
            
            .dialogue-option-btn {
                padding: 12px 16px;
                background: rgba(40, 40, 60, 0.8);
                border: 1px solid #555;
                border-radius: 8px;
                color: #fff;
                font-size: 15px;
                text-align: left;
                cursor: pointer;
                transition: all 0.2s;
                font-family: inherit;
                white-space: normal;
                word-wrap: break-word;
                overflow-wrap: break-word;
                word-break: break-word;
            }
            
            .dialogue-option-btn:hover {
                background: rgba(60, 60, 80, 0.9);
                border-color: #4ecdc4;
                transform: translateX(4px);
            }
            
            .dialogue-close-btn {
                position: absolute;
                top: 10px;
                right: 15px;
                background: none;
                border: none;
                color: #888;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
            }
            
            .dialogue-close-btn:hover {
                color: #fff;
            }
            
            .ability-list-title {
                color: #4ecdc4;
                font-size: 16px;
                margin-bottom: 10px;
                text-align: center;
                word-wrap: break-word;
            }
            
            .ability-cost {
                color: #ffaa44;
                font-size: 14px;
                margin-bottom: 15px;
                text-align: center;
                word-wrap: break-word;
            }
            
            .ability-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
                max-height: 250px;
                overflow-y: auto;
                overflow-x: hidden;
                margin-bottom: 10px;
                padding-right: 5px;
            }

            .ability-list .dialogue-option-btn {
                flex-shrink: 0;
                white-space: normal;
                word-wrap: break-word;
                overflow-wrap: break-word;
                word-break: break-word;
            }
                        
            .ability-list::-webkit-scrollbar {
                width: 4px;
            }
            
            .ability-list::-webkit-scrollbar-track {
                background: #1a1a2e;
                border-radius: 2px;
            }
            
            .ability-list::-webkit-scrollbar-thumb {
                background: #4ecdc4;
                border-radius: 2px;
            }
            
            .back-btn {
                padding: 10px 16px;
                background: rgba(40, 40, 60, 0.8);
                border: 1px solid #666;
                border-radius: 8px;
                color: #aaa;
                font-size: 14px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s;
                margin-top: 10px;
                white-space: normal;
                word-wrap: break-word;
            }
            
            .back-btn:hover {
                background: rgba(60, 60, 80, 0.9);
                border-color: #888;
                color: #fff;
            }

            .dialogue-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 9999;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Показать диалоговое окно
     */
    showDialogue(data) {
        this.mode = 'dialogue';
        this.currentData = data;
        this.onSelect = data.onSelect;
        this.onBack = null;
        
        if (this.modal) {
            this.modal.remove();
        }
        
        this.createModal();
        this.renderDialogue();
        this.bindDialogueEvents();
        this._createOverlay();

        this.isVisible = true;
    }
    
    /**
     * Показать список способностей для изучения
     */
    showAbilityList(data) {
        this.mode = 'abilityList';
        this.currentData = data;
        this.onSelect = data.onSelect;
        this.onBack = data.onBack;
        
        if (this.modal) {
            this.modal.remove();
        }
        
        this.createModal();
        this.renderAbilityList();
        this.bindAbilityListEvents();
        this._createOverlay();

        this.isVisible = true;
    }
    
    /**
     * Создать DOM-элемент модалки
     */
    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'dialogue-modal';
        document.body.appendChild(this.modal);
    }
    /**
     * Создать оверлей, блокирующий взаимодействие с интерфейсом
     * @private
     */
    _createOverlay() {
        this._removeOverlay(); // на всякий случай
        this.overlay = document.createElement('div');
        this.overlay.className = 'dialogue-overlay';
        this.overlay.addEventListener('click', () => this.hide());
        document.body.appendChild(this.overlay);
    }
    /**
     * Удалить оверлей
     * @private
     */
    _removeOverlay() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
    /**
     * Отрисовать диалог
     */
    renderDialogue() {
        if (!this.modal || !this.currentData) return;
        
        const { npcName, npcText, options } = this.currentData;
        
        const optionsHtml = options.map((opt, index) => `
            <button class="dialogue-option-btn" data-option-index="${index}">
                ${this.escapeHtml(opt.text)}
            </button>
        `).join('');
        
        this.modal.innerHTML = `
            <button class="dialogue-close-btn">&times;</button>
            <div class="dialogue-npc-name">${this.escapeHtml(npcName)}</div>
            <div class="dialogue-npc-text">${this.escapeHtml(npcText)}</div>
            <div class="dialogue-options">
                ${optionsHtml}
            </div>
        `;
    }
    
    /**
     * Отрисовать список способностей
     */
    renderAbilityList() {
        if (!this.modal || !this.currentData) return;
        
        const { title, npcName, cost, abilities } = this.currentData;
        
        const abilitiesHtml = abilities.map(ability => `
            <button class="dialogue-option-btn" data-ability-id="${ability.id}">
                ${this.escapeHtml(ability.name)}
            </button>
        `).join('');
        
        this.modal.innerHTML = `
            <button class="dialogue-close-btn">&times;</button>
            <div class="dialogue-npc-name">${this.escapeHtml(npcName)}</div>
            <div class="ability-list-title">${this.escapeHtml(title)}</div>
            ${cost > 0 ? `<div class="ability-cost">Стоимость: ${cost} золота</div>` : ''}
            <div class="ability-list">
                ${abilitiesHtml}
            </div>
            <button class="back-btn">◀ Назад</button>
        `;
    }
    
    /**
     * Привязать события для режима диалога
     */
    bindDialogueEvents() {
        if (!this.modal) return;
        
        const closeBtn = this.modal.querySelector('.dialogue-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        const optionBtns = this.modal.querySelectorAll('.dialogue-option-btn');
        optionBtns.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const option = this.currentData.options[index];
                if (option && this.onSelect) {
                    this.onSelect(option);
                }
            });
        });
        
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }
    
    /**
     * Привязать события для режима списка способностей
     */
    bindAbilityListEvents() {
        if (!this.modal) return;
        
        const closeBtn = this.modal.querySelector('.dialogue-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        const abilityBtns = this.modal.querySelectorAll('[data-ability-id]');
        abilityBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const abilityId = btn.dataset.abilityId;
                if (abilityId && this.onSelect) {
                    this.onSelect(abilityId);
                }
            });
        });
        
        const backBtn = this.modal.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (this.onBack) {
                    this.onBack();
                }
            });
        }
        
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }
    
    /**
     * Скрыть диалоговое окно
     */
    hide() {
        this._removeOverlay();
        
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        this.isVisible = false;
        this.currentData = null;
        this.onSelect = null;
        this.onBack = null;
        this.mode = 'dialogue';
        
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }
    }
    
    /**
     * Экранировать HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Уничтожить компонент
     */
    destroy() {
        this.hide();
    }
}

export { DialogueUI };
// ui/components/BeltUI.js
/**
 * BeltUI - компонент пояса быстрого доступа (горизонтальный) с улучшенными тултипами
 */
class BeltUI {
    constructor(container, eventBus, beltSystem) {
        this.container = container;
        this.eventBus = eventBus;
        this.beltSystem = beltSystem;
        this.isInitialized = false;
        this.currentBeltModal = null;
        this.handleBeltModalOutsideClick = this.handleBeltModalOutsideClick.bind(this);
    }
    
    init() {
        if (this.isInitialized) return;
        
        this.injectStyles();
        this.render();
        this.setupEventListeners();
        this.isInitialized = true;
    }
    
    injectStyles() {
        const styleId = 'belt-ui-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .belt-slots-container {
                display: flex;
                flex-direction: row;
                flex-wrap: nowrap;
                gap: 6px;
                margin-top: 8px;
                justify-content: center;
                overflow-x: auto;
                padding-bottom: 4px;
            }
            
            .belt-slot {
                width: 48px;
                height: 48px;
                border: 2px solid #666;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                cursor: pointer;
                transition: all 0.2s;
                background: #2a2a2a;
            }
            
            .belt-slot.active {
                border-color: #888;
                background: #333;
            }
            
            .belt-slot.active:hover {
                border-color: #aaa;
                background: #3a3a3a;
                transform: scale(1.05);
            }
            
            .belt-slot.locked {
                border-color: #444;
                background: #1a1a1a;
                cursor: not-allowed;
                opacity: 0.5;
            }
            
            .belt-item {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 20px;
                position: relative;
            }
            
            .belt-empty {
                color: #777;
                font-size: 12px;
            }
            
            .belt-locked {
                color: #555;
                font-size: 14px;
            }
            
            .belt-item-count {
                position: absolute;
                bottom: 2px;
                right: 2px;
                background: rgba(0,0,0,0.7);
                color: white;
                font-size: 10px;
                padding: 1px 4px;
                border-radius: 3px;
                min-width: 16px;
                text-align: center;
            }
            
            /* ТУЛТИП - ИСПРАВЛЕНА ВИДИМОСТЬ */
            .belt-tooltip {
                position: absolute;
                bottom: calc(100% + 5px);
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.95);
                color: white;
                padding: 8px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000;
                text-align: left;
                min-width: 150px;
                border: 1px solid #555;
                box-shadow: 0 4px 8px rgba(0,0,0,0.5);
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s;
            }
            
            .belt-tooltip strong {
                color: #fff;
                display: block;
                margin-bottom: 4px;
                border-bottom: 1px solid #666;
                padding-bottom: 2px;
            }
            
            .belt-tooltip span {
                color: #ccc;
                display: block;
                margin-top: 2px;
            }
            
            .belt-slot.active:hover .belt-tooltip {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }
    
    getItemIcon(itemId) {
        const iconMap = {
            'health_potion': 'fas fa-heart',
            'mana_potion': 'fas fa-tint',
            'stamina_potion': 'fas fa-flask',
            'bomb': 'fas fa-bomb',
            'scroll': 'fas fa-scroll',
            'key': 'fas fa-key'
        };
        
        for (const [key, icon] of Object.entries(iconMap)) {
            if (itemId.includes(key)) return icon;
        }
        
        return 'fas fa-question';
    }
    
    getItemTooltip(item) {
        if (!item) return '';
        
        let tooltip = `<strong>${item.name}</strong>`;
        
        // Определяем тип предмета по ID или свойствам
        const isHealthPotion = item.id.includes('health');
        const isManaPotion = item.id.includes('mana');
        const isStaminaPotion = item.id.includes('stamina');
        const isBomb = item.id.includes('bomb');
        const isScroll = item.id.includes('scroll');
        const isKey = item.id.includes('key');
        
        // Эффекты из stats
        if (item.stats) {
            if (item.stats.health) {
                tooltip += `<span>Восстанавливает ${item.stats.health} здоровья</span>`;
            }
            if (item.stats.mana) {
                tooltip += `<span>Восстанавливает ${item.stats.mana} маны</span>`;
            }
            if (item.stats.stamina) {
                tooltip += `<span>Восстанавливает ${item.stats.stamina} выносливости</span>`;
            }
            if (item.stats.attack) {
                tooltip += `<span>+${item.stats.attack} атаки на 10 ходов</span>`;
            }
            if (item.stats.defense) {
                tooltip += `<span>+${item.stats.defense} защиты на 10 ходов</span>`;
            }
        }
        
        // Тип предмета
        if (isHealthPotion) {
            tooltip += `<span>Зелье лечения</span>`;
        } else if (isManaPotion) {
            tooltip += `<span>Зелье маны</span>`;
        } else if (isStaminaPotion) {
            tooltip += `<span>Зелье выносливости</span>`;
        } else if (isBomb) {
            tooltip += `<span>Взрывчатка</span>`;
        } else if (isScroll) {
            tooltip += `<span>Магический свиток</span>`;
        } else if (isKey) {
            tooltip += `<span>Ключ</span>`;
        }
        
        // Размер/качество
        if (item.id.includes('large') || item.id.includes('big')) {
            tooltip += `<span>Большой размер</span>`;
        } else if (item.id.includes('small') || item.id.includes('minor')) {
            tooltip += `<span>Малый размер</span>`;
        }
        
        // Счетчик
        if (item.count > 1) {
            tooltip += `<span>Количество: ${item.count}</span>`;
        }
        
        return tooltip;
    }
    
    render() {
        const beltInfo = this.beltSystem.getBeltInfo();
        const activeSlots = beltInfo.activeSlots;
        
        let html = `<div class="belt-slots-container">`;
        
        for (let i = 0; i < 8; i++) {
            const isActive = i < activeSlots;
            const slotData = beltInfo.slots[i];
            const hasItem = slotData && slotData.item;
            
            html += `<div class="belt-slot ${isActive ? 'active' : 'locked'}" data-slot-index="${i}">`;
            
            if (isActive) {
                if (hasItem) {
                    const item = slotData.item;
                    const iconClass = this.getItemIcon(item.id);
                    
                    html += `
                        <div class="belt-item">
                            <i class="${iconClass}"></i>
                            ${item.count > 1 ? `<div class="belt-item-count">${item.count}</div>` : ''}
                            <div class="belt-tooltip">${this.getItemTooltip(item)}</div>
                        </div>
                    `;
                } else {
                    html += `<div class="belt-empty">+</div>`;
                }
            } else {
                html += `<div class="belt-locked"><i class="fas fa-lock"></i></div>`;
            }
            
            html += `</div>`;
        }
        
        html += `</div>`;
        this.container.innerHTML = html;
    }
    
    setupEventListeners() {
        this.container.addEventListener('click', (e) => {
            const slotElement = e.target.closest('.belt-slot.active');
            if (!slotElement) return;
            
            const slotIndex = parseInt(slotElement.dataset.slotIndex);
            if (isNaN(slotIndex)) return;
            
            this.useItem(slotIndex);
        });
        
        this.eventBus.on('belt:itemAdded', () => this.render());
        this.eventBus.on('belt:itemRemoved', () => this.render());
        this.eventBus.on('belt:itemUsed', () => this.render());
        this.eventBus.on('belt:slotsUpdated', () => this.render());
        this.eventBus.on('player:levelUp', () => this.render());
    }
    
    useItem(slotIndex) {
        const beltData = this.beltSystem.beltSlots[slotIndex];
        if (!beltData || !beltData.item) return;
        // Показываем модалку выбора вместо автоматического использования
        this.showBeltItemModal(slotIndex, beltData.item);
    }

    showBeltItemModal(slotIndex, item) {
        // Закрываем предыдущую модалку
        this.closeBeltModal();
        // Создаем модалку аналогичную инвентарной
        const modal = document.createElement('div');
        modal.className = 'belt-item-modal';
        modal.style.position = 'absolute';
        modal.style.zIndex = '1000';
        modal.style.background = '#2a2a2a';
        modal.style.border = '2px solid #666';
        modal.style.borderRadius = '8px';
        modal.style.padding = '10px';
        modal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        // Позиционируем рядом со слотом
        const slotElement = document.querySelector(`.belt-slot[data-slot-index="${slotIndex}"]`);
        if (slotElement) {
            const rect = slotElement.getBoundingClientRect();
            modal.style.left = `${rect.left}px`;
            modal.style.top = `${rect.bottom + 5}px`;
        }
        
        const itemInfo = item.getInfo ? item.getInfo() : item;
        
        modal.innerHTML = `
            <div class="belt-modal-header">
                <h4>${itemInfo.name}</h4>
                ${itemInfo.count > 1 ? `<div class="belt-modal-count">Количество: ${itemInfo.count}</div>` : ''}
            </div>
            <div class="belt-modal-actions">
                ${itemInfo.type === 'consumable' ? 
                    `<button class="belt-modal-btn use-btn" data-action="use">🧪 Использовать (1 шт.)</button>` : ''}
                <button class="belt-modal-btn remove-btn" data-action="remove">📦 Снять (все)</button>
                <button class="belt-modal-btn close-btn" data-action="close">✕ Закрыть</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.currentBeltModal = { modal, slotIndex };
        // Обработчики
        modal.querySelector('.use-btn')?.addEventListener('click', () => {
            const result = this.beltSystem.useBeltItem(slotIndex);
            if (result.message) {
                this.eventBus.emit('log:add', {
                    message: result.message,
                    type: result.success ? 'success' : 'error'
                });
            }
            this.closeBeltModal();
        });
        
        modal.querySelector('.remove-btn')?.addEventListener('click', () => {
            const result = this.beltSystem.removeFromBelt(slotIndex);
            if (result.success) {
                this.eventBus.emit('log:add', {
                    message: `Предмет снят с пояса`,
                    type: 'success'
                });
            }
            this.closeBeltModal();
        });
        
        modal.querySelector('.close-btn').addEventListener('click', () => this.closeBeltModal());
        // Закрытие при клике вне модалки
        setTimeout(() => {
            document.addEventListener('click', this.handleBeltModalOutsideClick);
        }, 10);
    }

    closeBeltModal() {
        if (this.currentBeltModal) {
            if (this.currentBeltModal.modal.parentNode) {
                this.currentBeltModal.modal.parentNode.removeChild(this.currentBeltModal.modal);
            }
            document.removeEventListener('click', this.handleBeltModalOutsideClick);
            this.currentBeltModal = null;
        }
    }

    handleBeltModalOutsideClick = (e) => {
        if (this.currentBeltModal && 
            !this.currentBeltModal.modal.contains(e.target) &&
            !e.target.closest(`.belt-slot[data-slot-index="${this.currentBeltModal.slotIndex}"]`)) {
            this.closeBeltModal();
        }
    }

    update() {
        this.render();
    }
    
    destroy() {
        this.container.innerHTML = '';
    }
}

export { BeltUI };
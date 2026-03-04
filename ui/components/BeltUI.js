// ui/components/BeltUI.js
/**
 * BeltUI - компонент пояса быстрого доступа (горизонтальный) с улучшенными тултипами
 * Адаптирован для работы с новой архитектурой пояса (только ссылки на предметы в инвентаре)
 */
class BeltUI {
    constructor(container, eventBus, beltSystem) {
        this.container = container;
        this.eventBus = eventBus;
        this.beltSystem = beltSystem;
        this.isInitialized = false;
        this.currentBeltModal = null;
        this.outsideClickHandler = null;
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
            
            /* Модальное окно для предметов пояса */
            .belt-item-modal {
                position: absolute;
                z-index: 1000;
                background: #2a2a2a;
                border: 2px solid #666;
                border-radius: 8px;
                padding: 10px;
                min-width: 200px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            }
            
            .belt-modal-header {
                margin-bottom: 10px;
                padding-bottom: 5px;
                border-bottom: 1px solid #444;
            }
            
            .belt-modal-header h4 {
                margin: 0 0 5px 0;
                color: #ffaa44;
                font-size: 16px;
            }
            
            .belt-modal-count {
                color: #ccc;
                font-size: 12px;
            }
            
            .belt-modal-actions {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            
            .belt-modal-btn {
                padding: 8px 12px;
                background: transparent;
                border: 1px solid #4ecdc4;
                color: #4ecdc4;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                transition: all 0.2s;
            }
            
            .belt-modal-btn:hover {
                background: rgba(78, 205, 196, 0.1);
            }
            
            .belt-modal-btn.use-btn {
                border-color: #4caf50;
                color: #4caf50;
            }
            
            .belt-modal-btn.remove-btn {
                border-color: #ff6b6b;
                color: #ff6b6b;
            }
            
            .belt-modal-btn.close-btn {
                border-color: #888;
                color: #888;
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
        }
        
        if (item.count > 1) {
            tooltip += `<span>Количество: ${item.count}</span>`;
        }
        
        return tooltip;
    }
    
    render() {
        const beltInfo = this.beltSystem.getBeltInfo();
        const activeSlots = beltInfo.activeSlots;
        
        let html = `<div style="width:200px; height:auto; min-height:auto; display:flex; flex-direction:column; background:#14141e;">`;
        // Верхняя полоса 200×50 со спрайтом пояса
        html += `<div style="width:200px; height:50px; display:flex; align-items:center; justify-content:center; border-bottom:1px solid #444;">`;
        html += `<img src="assets/sprites/ui/belt.png" style="max-width:190px; max-height:40px; object-fit:contain;">`;
        html += `</div>`;
        // Сетка слотов 2×4
        html += `<div style="display:grid; grid-template-columns:repeat(4,1fr); grid-template-rows:repeat(2,1fr); gap:1px; padding:4px; height:100px;">`;
        
        for (let i = 0; i < 8; i++) {
            const isActive = i < activeSlots;
            const slotData = beltInfo.slots[i];
            const hasItem = slotData && slotData.item;
            
            // Затемнение для неактивных слотов
            const opacity = isActive ? 1 : 0.5;
            
            html += `<div class="belt-slot ${isActive ? 'active' : ''}" data-slot-index="${i}" style="width:100%; aspect-ratio:1; border:1px solid #666; border-radius:4px; display:flex; align-items:center; justify-content:center; background:#1a1a1a; opacity:${opacity};">`;
            
            if (isActive) {
                if (hasItem) {
                    const item = slotData.item;
                    html += `
                        <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; position:relative;">
                            <img src="${item.icon}" style="width:40px; height:40px; object-fit:contain;">
                            <div class="belt-tooltip" style="display:none;">${this.getItemTooltip(item)}</div>
                        </div>
                    `;
                } else {
                    html += `<span style="color:#777; font-size:20px;">+</span>`;
                }
            }
            
            html += `</div>`;
        }
        
        html += `</div>`;
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
        this.eventBus.on('inventory:updated', () => this.render());
    }
    
    useItem(slotIndex) {
        const beltInfo = this.beltSystem.getBeltInfo();
        const slotData = beltInfo.slots[slotIndex];
        if (!slotData || !slotData.item) return;
        
        this.showBeltItemModal(slotIndex, slotData.item);
    }

    showBeltItemModal(slotIndex, item) {
        // Закрываем предыдущую модалку
        this.closeBeltModal();
        
        // Создаем модалку
        const modal = document.createElement('div');
        modal.className = 'belt-item-modal';
        
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
                    `<button class="belt-modal-btn use-btn" data-action="use">🧪 Использовать</button>` : ''}
                <button class="belt-modal-btn remove-btn" data-action="remove">📦 Снять с пояса</button>
                <button class="belt-modal-btn close-btn" data-action="close">✕ Закрыть</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.currentBeltModal = { modal, slotIndex };
        
        // Обработчики кнопок
        modal.querySelector('.use-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const result = this.beltSystem.useBeltItem(slotIndex);
            if (result.message) {
                this.eventBus.emit('log:add', {
                    message: result.message,
                    type: result.success ? 'success' : 'error'
                });
            }
            this.closeBeltModal();
        });
        
        modal.querySelector('.remove-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const result = this.beltSystem.removeFromBelt(slotIndex);
            if (result.success) {
                this.eventBus.emit('log:add', {
                    message: `Предмет снят с пояса`,
                    type: 'success'
                });
            }
            this.closeBeltModal();
        });
        
        modal.querySelector('.close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeBeltModal();
        });
        
        // Обработчик клика вне модалки
        this.outsideClickHandler = (e) => {
            if (this.currentBeltModal && 
                !this.currentBeltModal.modal.contains(e.target) &&
                !e.target.closest(`.belt-slot[data-slot-index="${this.currentBeltModal.slotIndex}"]`)) {
                this.closeBeltModal();
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', this.outsideClickHandler);
        }, 10);
    }

    closeBeltModal() {
        if (this.currentBeltModal) {
            if (this.currentBeltModal.modal.parentNode) {
                this.currentBeltModal.modal.parentNode.removeChild(this.currentBeltModal.modal);
            }
            
            if (this.outsideClickHandler) {
                document.removeEventListener('click', this.outsideClickHandler);
                this.outsideClickHandler = null;
            }
            
            this.currentBeltModal = null;
        }
    }

    update() {
        this.render();
    }
    
    destroy() {
        this.closeBeltModal();
        this.container.innerHTML = '';
    }
}

export { BeltUI };
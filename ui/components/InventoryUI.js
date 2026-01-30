// ui/components/InventoryUI.js
/**
 * InventoryUI - компактный вид с кнопками и всплывающим окном информации
 * Левая панель скрывается при открытии вкладки (через UIManager)
 */
class InventoryUI {
    constructor(container, eventBus, getInventoryInfo, onItemUse, onItemEquip) {
        this.container = container;
        this.eventBus = eventBus;
        this.getInventoryInfo = getInventoryInfo;
        this.onItemUse = onItemUse;
        this.onItemEquip = onItemEquip;
        
        this.unsubscribeFunctions = [];
        this.currentItems = [];
        this.infoModal = null;
        this.modalTimer = null;
    }
    
    init() {
        this.render();
        this.subscribeToEvents();
        this.bindEvents();
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
        return this;
    }
    
    subscribeToEvents() {
        const invUpdated = this.eventBus.on('inventory:updated', (invInfo) => this.update(invInfo));
        const equipChanged = this.eventBus.on('player:equipmentChanged', () => this.refreshFromSource());
        this.unsubscribeFunctions.push(invUpdated, equipChanged);
    }
    
    refreshFromSource() {
        if (typeof this.getInventoryInfo === 'function') {
            const invInfo = this.getInventoryInfo();
            this.update(invInfo);
        }
    }
    
    update(inventoryInfo) {
        if (!inventoryInfo || !this.container) return;
        this.currentItems = inventoryInfo.items || [];
        this.renderItems(this.currentItems);
    }
    
    formatStatIcon(stat, value) {
        const icons = {
            attack: '⚔️',
            defense: '🛡️',
            health: '❤️',
            strength: '💪',
            agility: '🏃',
            constitution: '🩸',
            wisdom: '📚',
            intelligence: '🧠',
            charisma: '😊'
        };
        const icon = icons[stat] || '📊';
        return `${icon} ${stat}: +${value}`;
    }
    
    createInfoModal(item, x, y) {
        this.closeInfoModal();
        
        const modal = document.createElement('div');
        modal.className = 'item-info-modal';
        modal.style.left = `${x}px`;
        modal.style.top = `${y}px`;
        
        const stats = item.stats || {};
        const hasStats = Object.keys(stats).length > 0;
        
        modal.innerHTML = `
            <div class="modal-header">
                <h4>${item.name}</h4>
                <div class="item-type">${item.type || 'предмет'}</div>
            </div>
            ${hasStats ? `
            <div class="modal-stats">
                <h5>Характеристики:</h5>
                ${Object.entries(stats).map(([stat, val]) => 
                    `<div class="stat-row">${this.formatStatIcon(stat, val)}</div>`
                ).join('')}
            </div>` : ''}
            <div class="modal-price">
                <div class="price-row">💰 Цена: ${item.price || 0} золота</div>
                <div class="price-row">💰 Продажа: ${Math.floor((item.price || 1) / 2)} золота</div>
            </div>
            ${item.description ? `<div class="modal-desc">${item.description}</div>` : ''}
            <div class="modal-close">Закрыть через 3 сек...</div>
        `;
        
        document.body.appendChild(modal);
        this.infoModal = modal;
        
        // Автозакрытие через 3 секунды
        this.modalTimer = setTimeout(() => this.closeInfoModal(), 3000);
        
        // Закрытие по клику на крестик или текст
        modal.querySelector('.modal-close').addEventListener('click', () => this.closeInfoModal());
    }
    
    closeInfoModal() {
        if (this.infoModal && this.infoModal.parentNode) {
            this.infoModal.parentNode.removeChild(this.infoModal);
            this.infoModal = null;
        }
        if (this.modalTimer) {
            clearTimeout(this.modalTimer);
            this.modalTimer = null;
        }
    }
    
    handleOutsideClick(e) {
        if (this.infoModal && !this.infoModal.contains(e.target) && 
            !e.target.closest('.info-btn')) {
            this.closeInfoModal();
        }
    }
    
    getActionButton(item, index) {
        if (item.type === 'consumable') {
            return `<button class="inv-btn action-btn use-btn" data-index="${index}">Использовать</button>`;
        }
        if (item.slot && item.slot !== 'none') {
            return `<button class="inv-btn action-btn equip-btn" data-index="${index}">Надеть</button>`;
        }
        return 
    }
    
    renderItems(items) {
        if (!this.container) return;
        
        if (!items || items.length === 0) {
            this.container.innerHTML = '<p class="empty-inventory">Инвентарь пуст</p>';
            return;
        }
        
        let html = '<div class="inventory-grid-compact">'; // ИЗМЕНИЛ: inventory-grid-compact
        
        items.forEach((item, index) => {
            if (!item) return;
            
            const countText = item.count > 1 ? `<span class="item-count">×${item.count}</span>` : '';
            const actionBtn = this.getActionButton(item, index);
            
            html += `
            <div class="inventory-item-compact" data-index="${index}"> <!-- ИЗМЕНИЛ: inventory-item-compact -->
                <div class="inv-compact-header">
                    <div class="inv-name-compact">${item.name}${countText}</div>
                </div>
                <div class="inv-actions-compact">
                    <button class="inv-btn info-btn" data-index="${index}" title="Информация">ℹ️</button>
                    ${actionBtn}
                </div>
            </div>
            `;
        });
        
        html += '</div>';
        this.container.innerHTML = html;
    }
    
    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const target = e.target;
            
            // === ОБРАБОТКА КНОПКИ "i" ===
            if (target.classList.contains('info-btn')) {
                const infoIndex = parseInt(target.dataset.index); // Имя переменной изменено
                if (isNaN(infoIndex)) return;
                
                const item = this.currentItems[infoIndex];
                if (!item) return;
                
                const rect = target.getBoundingClientRect();
                this.createInfoModal(item, rect.right + 10, rect.top);
                e.stopPropagation();
                return;
            }
            
            const index = parseInt(target.dataset.index);
            if (isNaN(index)) return;
            
            if (target.classList.contains('use-btn')) {
                if (typeof this.onItemUse === 'function') {
                    this.onItemUse(index);
                    this.closeInfoModal();
                }
                return;
            }
            
            if (target.classList.contains('equip-btn')) {
                if (typeof this.onItemEquip === 'function') {
                    this.onItemEquip(index);
                    this.closeInfoModal();
                }
                return;
            }
        });
    }
    
    render() {
        if (!this.container) return;
        this.container.innerHTML = '<p class="loading-inventory">Загрузка инвентаря...</p>';
        this.refreshFromSource();
    }
    
    destroy() {
        this.closeInfoModal();
        document.removeEventListener('click', (e) => this.handleOutsideClick(e));
        
        this.unsubscribeFunctions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') unsubscribe();
        });
        this.unsubscribeFunctions = [];
        this.container.innerHTML = '';
    }
}

export { InventoryUI };
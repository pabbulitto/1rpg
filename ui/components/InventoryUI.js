// ui/components/InventoryUI.js
/**
 * InventoryUI - компактный вид с кнопками и всплывающим окном информации
 * Левая панель скрывается при открытии вкладки (через UIManager)
 */
class InventoryUI {
    constructor(container, eventBus, getInventoryInfo, onItemUse, onItemEquip, onAddToBelt = null, onItemDrop = null) {
        this.container = container;
        this.eventBus = eventBus;
        this.getInventoryInfo = getInventoryInfo;
        this.onItemUse = onItemUse;
        this.onItemEquip = onItemEquip;
        this.onAddToBelt = onAddToBelt;
        this.onItemDrop = onItemDrop; 
        
        this.unsubscribeFunctions = [];
        this.currentItems = [];
        this.infoModal = null;
        this.modalTimer = null;
        this.currentItemIndex = -1;
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

    canAddToBelt(item) {
        if (!item) return false;
        
        // Только consumable и tool
        if (item.type !== 'consumable' && item.type !== 'tool') return false;
        
        // Проверяем через beltSystem если доступен
        if (window.game && window.game.beltSystem) {
            const result = window.game.beltSystem.canAddToBelt(item);
            return result.success;
        }
        
        return false;
    }
    createInfoModal(item, x, y, itemIndex) {
        this.closeInfoModal();
        this.currentItemIndex = itemIndex;
        
        const modal = document.createElement('div');
        modal.className = 'item-info-modal';
        modal.style.left = `${x}px`;
        modal.style.top = `${y}px`;
        modal.dataset.itemIndex = itemIndex;
        
        const stats = item.stats || {};
        const hasStats = Object.keys(stats).length > 0;
        
        // Проверяем можно ли добавить в пояс
        const canAddToBelt = this.canAddToBelt(item);
        const beltButtonHtml = canAddToBelt ? 
            `<button class="modal-btn belt-btn" data-action="belt">🎗️ В пояс</button>` : '';
        
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
            
            <div class="modal-actions">
                ${item.type === 'consumable' ? 
                    `<button class="modal-btn use-btn" data-action="use">🧪 Использовать</button>` : ''}
                
                ${beltButtonHtml}
                
                <button class="modal-btn drop-btn" data-action="drop">🗑️ Бросить</button>
                <button class="modal-btn close-btn" data-action="close">✕ Закрыть</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.infoModal = modal;
        
        this.bindModalEvents();
    }
    
    bindModalEvents() {
        if (!this.infoModal) return;
        
        const buttons = this.infoModal.querySelectorAll('.modal-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                this.handleModalAction(action);
            });
        });
    }
    
    handleModalAction(action) {
        const index = this.currentItemIndex;
        if (index < 0) return;
        
        switch(action) {
            case 'use':
                if (this.onItemUse) this.onItemUse(index);
                break;
            case 'belt':
                if (this.onAddToBelt) this.onAddToBelt(index);
                break;
            case 'drop':
                if (this.onItemDrop) this.onItemDrop(index);
                break;
            case 'close':
                break;
        }
        
        this.closeInfoModal();
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
        this.currentItemIndex = -1;
    }
    
    handleOutsideClick(e) {
        if (this.infoModal && !this.infoModal.contains(e.target) && 
            !e.target.closest('.info-btn')) {
            this.closeInfoModal();
        }
    }
    
    getActionButton(item, index) {
        return `<button class="inv-btn action-btn details-btn" data-index="${index}">Подробнее</button>`;
    }
        
    renderItems(items) {
        if (!this.container) return;
        
        if (!items || items.length === 0) {
            this.container.innerHTML = '<p class="empty-inventory">Инвентарь пуст</p>';
            return;
        }
        
        let html = '<div class="inventory-grid-compact">';
        
        items.forEach((item, index) => {
            if (!item) return;
            
            const countText = item.count > 1 ? `<span class="item-count">×${item.count}</span>` : '';
            
            html += `
            <div class="inventory-item-compact" data-index="${index}">
                <div class="inv-compact-header">
                    <div class="inv-name-compact">${item.name}${countText}</div>
                </div>
                <div class="inv-actions-compact">
                    <!-- ТОЛЬКО ОДНА КНОПКА "ПОДРОБНЕЕ", без "i" -->
                    <button class="inv-btn details-btn" data-index="${index}" title="Действия с предметом">Подробнее</button>
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
            
            // === ТОЛЬКО КНОПКА "ПОДРОБНЕЕ" ===
            if (target.classList.contains('details-btn')) {
                const itemIndex = parseInt(target.dataset.index);
                if (isNaN(itemIndex)) return;
                
                const item = this.currentItems[itemIndex];
                if (!item) return;
                
                // Позиционируем модалку снизу от кнопки
                const rect = target.getBoundingClientRect();
                this.createInfoModal(item, rect.left, rect.bottom + 10, itemIndex);
                e.stopPropagation();
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
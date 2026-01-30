// ui/components/ShopUI.js
/**
 * Упрощенный ShopUI - ближе к старой версии из UIManager
 * Создает модалку, рендерит всё заново при открытии
 */
class ShopUI {
    /**
     * @param {EventBus} eventBus
     * @param {Function} getShopInfo - () => { name, description, items, playerGold }
     * @param {Function} onBuyItem - (itemId) => void
     * @param {Function} onSellItem - (itemIndex) => void
     * @param {Function} getInventoryItems - () => Array<Item> для продажи
     */
    constructor(eventBus, getShopInfo, onBuyItem, onSellItem, getInventoryItems) {
        this.eventBus = eventBus;
        this.getShopInfo = getShopInfo;
        this.onBuyItem = onBuyItem;
        this.onSellItem = onSellItem;
        this.getInventoryItems = getInventoryItems;
        
        this.modalContainer = null;
        this.currentShop = null;
        this.activeTab = 'buy'; // 'buy' | 'sell'
    }
    
    init() {
        // Подписываемся только на открытие/закрытие
        this.eventBus.on('shop:open', (shopData) => this.open(shopData));
        this.eventBus.on('shop:close', () => this.close());
        return this;
    }

    setInventoryGetter(getInventoryItems) {
        this.getInventoryItems = getInventoryItems;
        
    }   
    open(shopData) {
        this.currentShop = shopData || (this.getShopInfo ? this.getShopInfo() : null);
        if (!this.currentShop) {
            console.error('ShopUI: нет данных магазина');
            return;
        }
        
        this.createModal();
        this.render();
        this.bindEvents();
        this.showModal();
    }
    
    close() {
        if (this.modalContainer) {
            this.hideModal();
            setTimeout(() => {
                if (this.modalContainer && this.modalContainer.parentNode) {
                    this.modalContainer.parentNode.removeChild(this.modalContainer);
                    this.modalContainer = null;
                }
            }, 300);
        }
    }
    
    createModal() {
        this.destroyModal();
        
        this.modalContainer = document.createElement('div');
        this.modalContainer.id = 'shop-modal-container';
        this.modalContainer.className = 'modal-container';
        document.body.appendChild(this.modalContainer);
    }
    
    showModal() {
        if (this.modalContainer) {
            this.modalContainer.style.display = 'flex';
            setTimeout(() => this.modalContainer.classList.add('active'), 10);
        }
    }
    
    hideModal() {
        if (this.modalContainer) {
            this.modalContainer.classList.remove('active');
        }
    }
    
    destroyModal() {
        if (this.modalContainer && this.modalContainer.parentNode) {
            this.modalContainer.parentNode.removeChild(this.modalContainer);
        }
        this.modalContainer = null;
    }
    
    formatItemStats(stats) {
        if (!stats) return '';
        const parts = [];
        if (stats.health) parts.push(`Здоровье +${stats.health}`);
        if (stats.attack) parts.push(`Атака +${stats.attack}`);
        if (stats.defense) parts.push(`Защита +${stats.defense}`);
        return parts.join(', ') || 'Нет бонусов';
    }
    
    renderShopItems(items) {
        if (!items || items.length === 0) {
            return '<p class="no-items">В магазине нет товаров</p>';
        }
        
        let html = '<div class="shop-grid">';
        const playerGold = this.currentShop.playerGold || 0;
        
        items.forEach(item => {
            if (!item) return;
            const canAfford = playerGold >= (item.price || 0);
            const statsText = this.formatItemStats(item.stats);
            
            html += `
                <div class="shop-item ${canAfford ? '' : 'cannot-afford'}" data-item-id="${item.id}">
                    <div class="shop-item-header">
                        <span class="item-name">${item.name}</span>
                        <span class="item-price">${item.price || 0} <i class="fas fa-coins"></i></span>
                    </div>
                    <div class="item-type">${item.type || 'предмет'}</div>
                    <div class="item-stats">${statsText}</div>
                    <button class="btn-shop buy-btn" data-item-id="${item.id}" ${canAfford ? '' : 'disabled'}>
                        ${canAfford ? 'Купить' : 'Недостаточно'}
                    </button>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }
    
    renderSellableItems() {
        const items = this.getInventoryItems ? this.getInventoryItems() : [];
        if (!items || items.length === 0) {
            return '<p class="empty-inventory">Нет предметов для продажи</p>';
        }
        
        let html = '<div class="sell-grid">';
        
        items.forEach((item, index) => {
            if (!item) return;
            const sellPrice = Math.floor((item.price || 1) / 2);
            const countText = item.count > 1 ? ` ×${item.count}` : '';
            const statsText = this.formatItemStats(item.stats);
            
            html += `
                <div class="sell-item" data-item-index="${index}">
                    <div class="sell-item-header">
                        <span class="item-name">${item.name}${countText}</span>
                        <span class="item-sell-price">${sellPrice} <i class="fas fa-coins"></i></span>
                    </div>
                    <div class="item-type">${item.type || 'предмет'}</div>
                    <div class="item-stats">${statsText}</div>
                    <button class="btn-sell" data-item-index="${index}">
                        <i class="fas fa-coins"></i> Продать
                    </button>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }
    
    render() {
        if (!this.modalContainer || !this.currentShop) return;
        
        const { name, description, items, playerGold } = this.currentShop;
        const shopItemsHTML = this.renderShopItems(items);
        const sellItemsHTML = this.renderSellableItems();
        
        this.modalContainer.innerHTML = `
            <div class="shop-modal">
                <div class="shop-header">
                    <h2><i class="fas fa-store"></i> ${name || 'Магазин'}</h2>
                    <p>${description || ''}</p>
                    <div class="shop-gold">
                        Ваше золото: <span class="gold-text">${playerGold || 0}</span> <i class="fas fa-coins"></i>
                    </div>
                </div>
                
                <div class="shop-tabs">
                    <button class="shop-tab-btn ${this.activeTab === 'buy' ? 'active' : ''}" data-tab="buy">
                        <i class="fas fa-coins"></i> Купить
                    </button>
                    <button class="shop-tab-btn ${this.activeTab === 'sell' ? 'active' : ''}" data-tab="sell">
                        <i class="fas fa-coins"></i> Продать
                    </button>
                </div>
                
                <div class="shop-content">
                    <div class="shop-tab-content ${this.activeTab === 'buy' ? 'active' : ''}" id="shop-buy-tab">
                        <div class="shop-items">
                            <h3>Товары:</h3>
                            ${shopItemsHTML}
                        </div>
                    </div>
                    
                    <div class="shop-tab-content ${this.activeTab === 'sell' ? 'active' : ''}" id="shop-sell-tab">
                        <div class="sell-items">
                            <h3>Ваши предметы:</h3>
                            ${sellItemsHTML}
                        </div>
                    </div>
                </div>
                
                <div class="shop-actions">
                    <button class="btn btn-secondary" id="close-shop-btn">
                        <i class="fas fa-times"></i> Закрыть
                    </button>
                </div>
            </div>
        `;
    }
    
    bindEvents() {
        if (!this.modalContainer) return;
        
        this.modalContainer.addEventListener('click', (e) => {
            const target = e.target;
            
            // Закрытие
            if (target.id === 'close-shop-btn' || target.closest('#close-shop-btn')) {
                this.close();
                return;
            }
            
            // Клик по фону
            if (target === this.modalContainer) {
                this.close();
                return;
            }
            
            // Табы
            if (target.classList.contains('shop-tab-btn')) {
                const tab = target.dataset.tab;
                if (tab && tab !== this.activeTab) {
                    this.activeTab = tab;
                    this.render();
                    this.bindEvents();
                }
                return;
            }
            
            // Покупка
            if (target.classList.contains('buy-btn')) {
                const itemId = target.dataset.itemId;
                if (itemId && this.onBuyItem) {
                    this.onBuyItem(itemId);
                    this.refreshShopData();
                }
                return;
            }
            
            // Продажа
            if (target.classList.contains('btn-sell')) {
                const itemIndex = parseInt(target.dataset.itemIndex);
                if (!isNaN(itemIndex) && this.onSellItem) {
                    this.onSellItem(itemIndex);
                    this.refreshShopData();
                }
                return;
            }
        });
    }
    
    refreshShopData() {
        // Получаем свежие данные и перерендериваем
        this.currentShop = this.getShopInfo ? this.getShopInfo() : this.currentShop;
        if (this.modalContainer && this.modalContainer.style.display !== 'none') {
            this.render();
            this.bindEvents();
        }
    }
    
    destroy() {
        this.destroyModal();
    }
}

export { ShopUI };
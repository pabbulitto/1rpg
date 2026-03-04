// ui/components/InventoryUI.js
/**
 * InventoryUI - компактный вид с кнопками и модальным окном
 */
class InventoryUI {
    constructor(container, eventBus, getInventoryInfo, onItemUse, onAddToBelt = null, onItemDrop = null) {
        this.container = container;
        this.eventBus = eventBus;
        this.getInventoryInfo = getInventoryInfo;
        this.onItemUse = onItemUse;
        this.onAddToBelt = onAddToBelt;
        this.onItemDrop = onItemDrop;
        
        this.unsubscribeFunctions = [];
        this.currentItems = [];
        this.infoModal = null;
        this.currentItemInstanceId = null;
        this.outsideClickHandler = null;
    }
    
    init() {
        this.ensurePositioningStyles();
        this.createWeightDisplay();
        this.render();
        this.subscribeToEvents();
        this.bindEvents();
        this.eventBus.emit('inventory:request');
        return this;
    }
    
    ensurePositioningStyles() {
        if (document.getElementById('inventory-position-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'inventory-position-styles';
        style.textContent = `
            #inventory-tab {
                position: relative;
                width: 900px;
                height: 507px;
                background-image: url('assets/backgrounds/inventory-bg.jpg');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            }
            #inventory-belt-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 200px;
                height: 150px;
                z-index: 1;
            }
            #inventory-weight {
                position: absolute;
                top: 155px;
                left: 0;
                width: 200px;
                height: 30px;
                z-index: 1;
                font-weight: bold;
                color: #e6e6e6;
                line-height: 30px;
                padding-left: 10px;
                box-sizing: border-box;
                background: rgba(0,0,0,0.5);
                border-radius: 4px;
            }
            #inventory-weight span {
                color: #ffaa44;
                font-weight: bold;
            }
            #inventory-content {
                position: absolute;
                top: 0;
                left: 200px;
                width: 700px;
                height: 507px;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 5px;
                box-sizing: border-box;
                background: rgba(0,0,0,0.6);
                backdrop-filter: blur(2px);
            }
            .inventory-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 0;
                width: 100%;
            }
            .inventory-item {
                width: 170px;
                height: 50px;
                padding: 5px 8px;
                margin: 0;
                border: 1px solid #444;
                background: rgba(40, 40, 60, 0.8);
                color: #4ecdc4;
                text-align: left;
                cursor: pointer;
                font-family: inherit;
                font-size: 14px;
                font-weight: bold;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                box-sizing: border-box;
                border-radius: 6px;
            }
            .inventory-item:hover {
                background: rgba(50, 50, 70, 0.9);
                border-color: #4ecdc4;
            }
            .inventory-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #2a2a2a;
                border: 2px solid #666;
                border-radius: 8px;
                padding: 15px;
                z-index: 1000;
                min-width: 250px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            }
            .inventory-modal h3 {
                margin: 0 0 10px 0;
                color: #ffaa44;
                text-align: center;
                font-size: 18px;
            }
            .modal-btn {
                display: block;
                width: 100%;
                margin: 5px 0;
                padding: 12px;
                background: transparent;
                border: 1px solid #4ecdc4;
                color: #4ecdc4;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 16px;
            }
            .modal-btn:hover {
                background: rgba(78, 205, 196, 0.1);
            }
        `;
        document.head.appendChild(style);
    }
    
    createWeightDisplay() {
        if (document.getElementById('inventory-weight')) return;
        
        const beltContainer = document.getElementById('inventory-belt-container');
        if (!beltContainer) return;
        
        const weightDiv = document.createElement('div');
        weightDiv.id = 'inventory-weight';
        weightDiv.innerHTML = 'Вес: <span id="inventory-weight-value">0/100</span>';
        
        beltContainer.parentNode.insertBefore(weightDiv, beltContainer.nextSibling);
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
        this.updateWeight(inventoryInfo.totalWeight || 0);
        this.renderItems(this.currentItems);
    }
    
    updateWeight(totalWeight) {
        const weightSpan = document.getElementById('inventory-weight-value');
        if (weightSpan) {
            const maxWeight = window.game?.player?.getStats?.()?.carryCapacity || 100;
            weightSpan.textContent = `${totalWeight}/${maxWeight}`;
        }
    }
    
    // Метод удален — используется BeltSystem.canAddToBelt() напрямую
    
    renderItems(items) {
        if (!this.container) return;
        
        if (!items || items.length === 0) {
            this.container.innerHTML = '<div style="padding:20px; text-align:center;">Инвентарь пуст</div>';
            return;
        }
        
        let html = '<div class="inventory-grid">';
        
        items.forEach((item, index) => {
            if (!item) return;
            
            const displayName = item.count > 1 ? `${item.name} x${item.count}` : item.name;
            
            html += `
                <button class="inventory-item" data-index="${index}" data-instance-id="${item.instanceId || ''}">
                    ${displayName}
                </button>
            `;
        });
        
        html += '</div>';
        this.container.innerHTML = html;
    }
    
    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const button = e.target.closest('.inventory-item');
            if (button) {
                const instanceId = button.dataset.instanceId;
                const index = parseInt(button.dataset.index);
                if (instanceId) {
                    this.openItemModal(instanceId, index);
                } else if (!isNaN(index)) {
                    // Fallback для старых данных
                    const item = this.currentItems[index];
                    if (item && item.instanceId) {
                        this.openItemModal(item.instanceId, index);
                    }
                }
            }
        });
    }
    
    openItemModal(instanceId, index) {
        // Находим предмет по instanceId или индексу
        let item = null;
        if (instanceId) {
            item = this.currentItems.find(i => i && i.instanceId === instanceId);
        }
        if (!item && index !== undefined && index >= 0) {
            item = this.currentItems[index];
        }
        
        if (!item) return;
        
        this.closeModal();
        this.currentItemInstanceId = item.instanceId;
        
        const modal = document.createElement('div');
        modal.className = 'inventory-modal';
        
        const canUse = item.type === 'consumable';
        let canBelt = false;
        
        // Проверка через BeltSystem если он доступен
        if (window.game?.beltSystem) {
            const validation = window.game.beltSystem.canAddToBelt(item);
            canBelt = validation.success;
        }
        
        let buttonsHtml = '';
        
        if (canUse) {
            buttonsHtml += `<button class="modal-btn" data-action="use">🧪 Использовать</button>`;
        }
        if (canBelt) {
            buttonsHtml += `<button class="modal-btn" data-action="belt">⬇️ В пояс</button>`;
        }
        
        buttonsHtml += `
            <button class="modal-btn" data-action="identify">🔍 Опознать</button>
            <button class="modal-btn" data-action="drop">🗑️ Выбросить</button>
        `;
        
        modal.innerHTML = `
            <h3>${item.name}</h3>
            ${buttonsHtml}
        `;
        
        document.body.appendChild(modal);
        this.infoModal = modal;
        
        // Обработчики кнопок
        modal.querySelectorAll('.modal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                this.handleModalAction(action);
            });
        });
        
        // Обработчик клика вне модалки
        this.outsideClickHandler = (e) => {
            if (this.infoModal && !this.infoModal.contains(e.target)) {
                this.closeModal();
            }
        };
        
        // Добавляем с небольшой задержкой, чтобы не сработал сразу на открытие
        setTimeout(() => {
            document.addEventListener('click', this.outsideClickHandler);
        }, 10);
    }
    
    handleModalAction(action) {
        const instanceId = this.currentItemInstanceId;
        if (!instanceId) {
            this.closeModal();
            return;
        }
        
        switch(action) {
            case 'use':
                if (this.onItemUse) {
                    this.onItemUse(instanceId);
                }
                this.closeModal();
                break;
                
            case 'belt':
                if (this.onAddToBelt) {
                    this.onAddToBelt(instanceId);
                }
                this.closeModal();
                break;
                
            case 'identify':
                console.log('🔍 Опознание предмета:', instanceId);
                this.eventBus?.emit('log:add', {
                    message: 'Опознание предметов пока не реализовано',
                    type: 'info'
                });
                // Не закрываем модалку для identify
                break;
                
            case 'drop':
                if (this.onItemDrop) {
                    this.onItemDrop(instanceId);
                }
                this.closeModal();
                break;
                
            default:
                this.closeModal();
        }
    }
    
    closeModal() {
        if (this.infoModal) {
            if (this.outsideClickHandler) {
                document.removeEventListener('click', this.outsideClickHandler);
                this.outsideClickHandler = null;
            }
            this.infoModal.remove();
            this.infoModal = null;
        }
        this.currentItemInstanceId = null;
    }
    
    render() {
        if (!this.container) return;
        this.container.innerHTML = '<div style="padding:20px; text-align:center;">Загрузка инвентаря...</div>';
        this.refreshFromSource();
    }
    
    destroy() {
        this.closeModal();
        
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
            this.outsideClickHandler = null;
        }
        
        this.unsubscribeFunctions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') unsubscribe();
        });
        this.unsubscribeFunctions = [];
        
        const weightEl = document.getElementById('inventory-weight');
        if (weightEl) weightEl.remove();
        
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

export { InventoryUI };
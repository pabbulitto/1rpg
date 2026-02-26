// ui/components/EquipmentUI.js
/**
 * EquipmentUI - компонент экипировки с выбором предметов из инвентаря
 * Клик на слот открывает список доступных предметов
 */
class EquipmentUI {
    constructor(container, eventBus, getEquipmentData, onUnequip, onEquip) {
        this.container = container;
        this.eventBus = eventBus;
        this.getEquipmentData = getEquipmentData;
        this.onUnequip = onUnequip;
        this.onEquip = onEquip; // новый колбэк для экипировки
        this.unsubscribeFunctions = [];
        
        this.slotNames = {
            head: 'Голова',
            neck1: 'Шея (1)',
            neck2: 'Шея (2)',
            arms: 'Руки',
            hands: 'Кисти',
            bracelet1: 'Браслет (1)',
            bracelet2: 'Браслет (2)',
            ring1: 'Кольцо (1)',
            ring2: 'Кольцо (2)',
            body: 'Тело',
            belt: 'Пояс',
            legs: 'Ноги',
            feet: 'Стопы',
            right_hand: 'Правая рука',
            left_hand: 'Левая рука'
        };
        
        this.currentSlot = null;
        this.itemsModal = null;
    }
    
    init() {
        this.render();
        this.subscribeToEvents();
        this.bindEvents();
        return this;
    }
    
    subscribeToEvents() {
        const equipChanged = this.eventBus.on('player:equipmentChanged', () => this.refreshFromSource());
        const invUpdated = this.eventBus.on('inventory:updated', () => {
            // если модалка открыта - обновить список предметов
            if (this.itemsModal) {
                this.showItemsForSlot(this.currentSlot);
            }
        });
        this.unsubscribeFunctions.push(equipChanged, invUpdated);
    }
    
    refreshFromSource() {
        if (typeof this.getEquipmentData === 'function') {
            const data = this.getEquipmentData();
            if (data) this.update(data);
        }
    }
    
    update(equipmentData) {
        if (!equipmentData || !this.container) return;
        
        let html = '<div class="equipment-grid">';
        
        Object.entries(this.slotNames).forEach(([slot, name]) => {
            const item = equipmentData[slot];
            const itemName = item ? item.name : 'Пусто';
            const itemId = item ? item.id : null;
            
            html += `
                <div class="equipment-slot" data-slot="${slot}" data-item-id="${itemId || ''}">
                    <div class="slot-name">${name}</div>
                    <div class="slot-item">${itemName}</div>
                    <div class="slot-actions">
                        ${item ? 
                            `<button class="btn-inv unequip-btn" data-slot="${slot}">Снять</button>` : 
                            `<button class="btn-inv equip-select-btn" data-slot="${slot}">Надеть</button>`
                        }
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        this.container.innerHTML = html;
    }
    
    /**
     * Получить предметы из инвентаря, подходящие для слота
     * @param {string} slot - слот
     * @returns {Array} массив подходящих предметов
     */
    getItemsForSlot(slot) {
        const player = window.game.player;
        if (!player) return [];
        
        const inventory = player.getInventoryItems();
        const currentEquipment = player.getEquipment();
        
        return inventory.filter(item => {
            // Предмет должен иметь слот
            if (!item.slot) return false;
            
            // Проверяем, можно ли надеть в этот слот
            const validation = window.game.equipmentService.canEquip(
                item, 
                currentEquipment, 
                player, 
                slot
            );
            
            return validation.success;
        });
    }
    
    /**
     * Показать модалку с предметами для слота
     * @param {string} slot - слот
     */
    showItemsForSlot(slot) {
        this.closeItemsModal();
        this.currentSlot = slot;
        
        const items = this.getItemsForSlot(slot);
        const slotName = this.slotNames[slot] || slot;
        
        const modal = document.createElement('div');
        modal.className = 'equip-items-modal';
        modal.style.position = 'absolute';
        modal.style.zIndex = '1000';
        modal.style.background = '#2a2a2a';
        modal.style.border = '2px solid #666';
        modal.style.borderRadius = '8px';
        modal.style.padding = '10px';
        modal.style.maxWidth = '300px';
        modal.style.maxHeight = '400px';
        modal.style.overflowY = 'auto';
        
        // Позиционируем рядом со слотом
        const slotElement = this.container.querySelector(`[data-slot="${slot}"]`);
        if (slotElement) {
            const rect = slotElement.getBoundingClientRect();
            modal.style.left = `${rect.left}px`;
            modal.style.top = `${rect.bottom + 5}px`;
        }
        
        let itemsHtml = '';
        if (items.length === 0) {
            itemsHtml = '<p class="no-items">Нет подходящих предметов</p>';
        } else {
            itemsHtml = items.map((item, index) => `
                <div class="equip-item-row" data-item-index="${index}">
                    <span class="item-name">${item.name}</span>
                    ${item.count > 1 ? `<span class="item-count">×${item.count}</span>` : ''}
                    <button class="btn-equip-item" data-item-id="${item.instanceId}">Надеть</button>
                </div>
            `).join('');
        }
        
        modal.innerHTML = `
            <div class="modal-header">
                <h4>Выберите предмет для ${slotName}</h4>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-items">
                ${itemsHtml}
            </div>
        `;
        
        document.body.appendChild(modal);
        this.itemsModal = modal;
        
        // Обработчики
        modal.querySelector('.close-modal').addEventListener('click', () => this.closeItemsModal());
        
        modal.querySelectorAll('.btn-equip-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = btn.dataset.itemId;
                const item = window.game.player.getInventoryItems().find(i => i.instanceId === itemId);
                if (item && this.onEquip) {
                    this.onEquip(item, slot);
                }
                this.closeItemsModal();
            });
        });
        
        // Закрытие по клику вне модалки
        setTimeout(() => {
            document.addEventListener('click', this.handleOutsideClick);
        }, 10);
    }
    
    handleOutsideClick = (e) => {
        if (this.itemsModal && !this.itemsModal.contains(e.target) && 
            !e.target.closest('.equip-select-btn')) {
            this.closeItemsModal();
        }
    }
    
    closeItemsModal() {
        if (this.itemsModal) {
            document.removeEventListener('click', this.handleOutsideClick);
            this.itemsModal.remove();
            this.itemsModal = null;
        }
        this.currentSlot = null;
    }
    
    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const target = e.target;
            
            // Снять предмет
            if (target.classList.contains('unequip-btn')) {
                e.stopPropagation();
                const slot = target.dataset.slot;
                if (slot && typeof this.onUnequip === 'function') {
                    this.onUnequip(slot);
                }
                return;
            }
            
            // Выбрать предмет для слота
            if (target.classList.contains('equip-select-btn')) {
                e.stopPropagation();
                const slot = target.dataset.slot;
                if (slot) {
                    this.showItemsForSlot(slot);
                }
                return;
            }
        });
    }
    
    render() {
        if (!this.container) return;
        this.container.innerHTML = '<p class="loading-equipment">Загрузка экипировки...</p>';
        this.refreshFromSource();
    }
    
    destroy() {
        this.closeItemsModal();
        this.unsubscribeFunctions.forEach(fn => fn && fn());
        if (this.container) this.container.innerHTML = '';
    }
}

export { EquipmentUI };
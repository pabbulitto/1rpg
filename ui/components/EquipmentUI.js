// ui/components/EquipmentUI.js
/**
 * Упрощенный компонент экипировки (как в старом UIManager)
 * Простая сетка слотов без категорий и статистики
 */
class EquipmentUI {
    constructor(container, eventBus, getEquipmentData, onUnequip) {
        this.container = container;
        this.eventBus = eventBus;
        this.getEquipmentData = getEquipmentData;
        this.onUnequip = onUnequip;
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
    }
    
    init() {
        this.render();
        this.subscribeToEvents();
        this.bindEvents();
        return this;
    }
    
    subscribeToEvents() {
        const equipChanged = this.eventBus.on('player:equipmentChanged', () => this.refreshFromSource());
        this.unsubscribeFunctions.push(equipChanged);
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
            html += `
                <div class="equipment-slot" data-slot="${slot}">
                    <div class="slot-name">${name}</div>
                    <div class="slot-item">${item ? item.name : 'Пусто'}</div>
                    ${item ? `<button class="btn-inv unequip-btn" data-slot="${slot}">Снять</button>` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        this.container.innerHTML = html;
    }
    
    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.classList.contains('unequip-btn')) {
                const slot = target.dataset.slot;
                if (slot && typeof this.onUnequip === 'function') {
                    this.onUnequip(slot);
                }
            }
        });
    }
    
    render() {
        if (!this.container) return;
        this.container.innerHTML = '<p class="loading-equipment">Загрузка экипировки...</p>';
        this.refreshFromSource();
    }
    
    destroy() {
        this.unsubscribeFunctions.forEach(fn => fn && fn());
        if (this.container) this.container.innerHTML = '';
    }
}

export { EquipmentUI };
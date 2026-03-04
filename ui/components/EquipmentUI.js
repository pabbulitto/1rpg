// ui/components/EquipmentUI.js
/**
 * EquipmentUI - компонент экипировки с жестко заданными стилями
 */
class EquipmentUI {
    constructor(container, eventBus, getEquipmentData, onUnequip, onEquip) {
        this.container = container;
        this.eventBus = eventBus;
        this.getEquipmentData = getEquipmentData;
        this.onUnequip = onUnequip;
        this.onEquip = onEquip;
        this.unsubscribeFunctions = [];
        
        this.slotNames = {
            head: 'Голова',
            neck1: 'Шея 1',
            neck2: 'Шея 2',
            arms: 'Руки',
            hands: 'Кисти',
            bracelet1: 'Браслет 1',
            bracelet2: 'Браслет 2',
            ring1: 'Кольцо 1',
            ring2: 'Кольцо 2',
            body: 'Тело',
            belt: 'Пояс',
            legs: 'Ноги',
            feet: 'Ступни',
            right_hand: 'Правая рука',
            left_hand: 'Левая рука'
        };
        
        this.currentSlot = null;
        this.itemsModal = null;
        this.game = window.game;
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
            if (this.itemsModal) {
                this.showItemsForSlot(this.currentSlot);
            }
        });
        const statsChanged = this.eventBus.on('player:statsChanged', () => this.refreshFromSource());
        this.unsubscribeFunctions.push(equipChanged, invUpdated, statsChanged);
    }
    
    refreshFromSource() {
        if (typeof this.getEquipmentData === 'function') {
            const data = this.getEquipmentData();
            if (data) this.update(data);
        }
    }
    
    update(equipmentData) {
        if (!equipmentData || !this.container) return;
        this.render(equipmentData);
    }
    
    renderSlot(slot, label, equipment) {
        const item = equipment[slot];
        const itemName = item ? item.name : 'Пусто';
        const itemId = item ? item.instanceId : '';
        
        return `
            <div style="width:200px; height:79px; margin:0; padding:0; box-sizing:border-box;" data-slot="${slot}" data-item-id="${itemId}">
                <div style="width:100%; height:100%; background:rgba(40,40,60,0.9); border:2px solid #5252bf; border-radius:8px; padding:1px; text-align:center; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box; font-family:'Segoe UI',sans-serif;">
                    <div style="color:#4ecdc4; font-size:14px; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">${label}</div>
                    <div style="color:#ffaa44; font-weight:bold; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 5px;">${itemName}</div>
                    <div>
                        ${item ? 
                            `<button style="padding:7px 16px; background:#6b6b9a; color:white; border:1px solid #1818f5; border-radius:4px; cursor:pointer; font-size:14px; font-weight:bold; transition:all 0.2s;" 
                                class="unequip-btn" data-slot="${slot}">Снять</button>` : 
                            `<button style="padding:7px 16px; background:#4a6b4a; color:white; border:1px solid #24f424; border-radius:4px; cursor:pointer; font-size:14px; font-weight:bold; transition:all 0.2s;" 
                                class="equip-select-btn" data-slot="${slot}">Надеть</button>`
                        }
                    </div>
                </div>
            </div>
        `;
    }
    
    renderStats() {
        const stats = this.game?.player?.getStats() || {};
        const finalStats = this.game?.player?.getStatManager()?.getFinalStats() || {};
        
        const strTotal = stats.strength || 0;
        const strBase = finalStats.strength || 0;
        const strBonus = strTotal - strBase;
        
        const dexTotal = stats.dexterity || 0;
        const dexBase = finalStats.dexterity || 0;
        const dexBonus = dexTotal - dexBase;
        
        const conTotal = stats.constitution || 0;
        const conBase = finalStats.constitution || 0;
        const conBonus = conTotal - conBase;
        
        const intTotal = stats.intelligence || 0;
        const intBase = finalStats.intelligence || 0;
        const intBonus = intTotal - intBase;
        
        const wisTotal = stats.wisdom || 0;
        const wisBase = finalStats.wisdom || 0;
        const wisBonus = wisTotal - wisBase;
        
        const chaTotal = stats.charisma || 0;
        const chaBase = finalStats.charisma || 0;
        const chaBonus = chaTotal - chaBase;
        
        return `
            <div style="width:100%; height:100%; color: #ffaa44; font-weight:bold; padding-left:15px; font-family:'Segoe UI',sans-serif; font-size:15px; line-height:1.8;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div>
                        <div style="border-bottom:1px solid #4ecdc4; margin-bottom:8px; padding-bottom:3px; color:#a0a0ff; font-weight:bold;">  ХАРАКТЕРИСТИКИ</div>
                        <div> Сила: ${strTotal} (${strBonus >= 0 ? '+' : ''}${strBonus})</div>
                        <div> Ловкость: ${dexTotal} (${dexBonus >= 0 ? '+' : ''}${dexBonus})</div>
                        <div> Телосложение: ${conTotal} (${conBonus >= 0 ? '+' : ''}${conBonus})</div>
                        <div> Интеллект: ${intTotal} (${intBonus >= 0 ? '+' : ''}${intBonus})</div>
                        <div> Мудрость: ${wisTotal} (${wisBonus >= 0 ? '+' : ''}${wisBonus})</div>
                        <div> Харизма: ${chaTotal} (${chaBonus >= 0 ? '+' : ''}${chaBonus})</div>
                    </div>
                    <div>
                        <div style="border-bottom:1px solid #4ecdc4; margin-bottom:8px; padding-bottom:3px; color:#a0a0ff; font-weight:bold;">РЕСУРСЫ И БОЙ</div>
                        <div>Жизнь: ${stats.health || 0}/${stats.maxHealth || 0} <span style="color:#6f6;">[+${stats.healthRegen || 0}]</span></div>
                        <div>Мана: ${stats.mana || 0}/${stats.maxMana || 0} <span style="color:#6f6;">[+${stats.manaRegen || 0}]</span></div>
                        <div>Выносливость: ${stats.stamina || 0}/${stats.maxStamina || 0} <span style="color:#6f6;">[+${stats.staminaRegen || 0}]</span></div>
                        <div style="margin-top:8px;">Попадание: ${stats.hitroll || 0}</div>
                        <div>Повреждение: ${stats.damroll || 0}</div>
                        <div>Инициатива: ${stats.initiative || 0}</div>
                        <div style="margin-top:8px;">Класс защиты: ${stats.armorClass || 0}</div>
                        <div>Защита: ${stats.defense || 0}</div>
                        <div>Броня: ${stats.armorValue || 0}</div>
                        <div>Поглощение: ${stats.damageReduction || 0}%</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    render(equipmentData) {
        if (!this.container) return;
        
        const equipment = equipmentData || this.getEquipmentData() || {};
        
        const html = `
            <div style="width:900px; height:507px; display:flex; padding:0px; box-sizing:border-box; overflow:hidden; background-image:url('assets/backgrounds/equipment-bg.jpg'); background-size:cover; background-position:center; font-family:'Segoe UI',sans-serif;">
                <!-- Левая часть - сетка экипировки -->
                <div style="width:450px; height:503px; display:flex; flex-direction:column; gap:4px; background:rgba(20,20,30,0.5); backdrop-filter:blur(3px); border-radius:12px; padding:0px; box-sizing:border-box; border:1px solid #4a4a6a;">
                    <!-- Строка 1: Голова -->
                    <div style="display:flex; justify-content:center;">
                        ${this.renderSlot('head', 'Голова', equipment)}
                    </div>
                    
                    <!-- Строка 2: Шея 1 и Шея 2 -->
                    <div style="display:flex; justify-content:center; gap:10px;">
                        ${this.renderSlot('neck1', 'Шея 1', equipment)}
                        ${this.renderSlot('neck2', 'Шея 2', equipment)}
                    </div>
                    
                    <!-- Строка 3: Тело и Руки -->
                    <div style="display:flex; justify-content:center; gap:10px;">
                        ${this.renderSlot('body', 'Тело', equipment)}
                        ${this.renderSlot('arms', 'Руки', equipment)}
                    </div>
                    
                    <!-- Строка 4: Браслет 1, Пояс, Браслет 2 -->
                    <div style="display:flex; justify-content:center; gap:10px;">
                        ${this.renderSlot('bracelet1', 'Браслет 1', equipment)}
                        ${this.renderSlot('belt', 'Пояс', equipment)}
                        ${this.renderSlot('bracelet2', 'Браслет 2', equipment)}
                    </div>
                    
                    <!-- Строка 5: Левая рука, Ноги, Правая рука -->
                    <div style="display:flex; justify-content:center; gap:10px;">
                        ${this.renderSlot('left_hand', 'Левая рука', equipment)}
                        ${this.renderSlot('legs', 'Ноги', equipment)}
                        ${this.renderSlot('right_hand', 'Правая рука', equipment)}
                    </div>
                    
                    <!-- Строка 6: Кольцо 1, Ступни, Кольцо 2 -->
                    <div style="display:flex; justify-content:center; gap:10px;">
                        ${this.renderSlot('ring1', 'Кольцо 1', equipment)}
                        ${this.renderSlot('feet', 'Ступни', equipment)}
                        ${this.renderSlot('ring2', 'Кольцо 2', equipment)}
                    </div>
                </div>
                
                <!-- Правая часть - характеристики -->
                <div style="width:430px; height:503px; margin-left:10px; background:rgba(20,20,30,0.4); backdrop-filter:blur(3px); border-radius:12px; padding:0px; box-sizing:border-box; border:1px solid #4a4a6a; overflow-y:auto;">
                    ${this.renderStats()}
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
    }
    
    getItemsForSlot(slot) {
        const player = window.game.player;
        if (!player) return [];
        
        const inventory = player.getInventoryItems();
        const currentEquipment = player.getEquipment();
        
        return inventory.filter(item => {
            if (!item.slot) return false;
            
            const validation = window.game.equipmentService.canEquip(
                item, 
                currentEquipment, 
                player, 
                slot
            );
            
            return validation.success;
        });
    }
    
    showItemsForSlot(slot) {
        this.closeItemsModal();
        this.currentSlot = slot;
        
        const items = this.getItemsForSlot(slot);
        const slotName = this.slotNames[slot] || slot;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            z-index: 10000;
            background: #2a2a3a;
            border: 2px solid #6a6a9a;
            border-radius: 12px;
            padding: 15px;
            min-width: 280px;
            max-width: 350px;
            max-height: 450px;
            overflow-y: auto;
            box-shadow: 0 8px 24px rgba(0,0,0,0.8);
            font-family: 'Segoe UI', sans-serif;
            color: white;
        `;
        
        const slotElement = this.container.querySelector(`[data-slot="${slot}"]`);
        if (slotElement) {
            const rect = slotElement.getBoundingClientRect();
            modal.style.left = `${rect.left}px`;
            modal.style.top = `${rect.bottom + 5}px`;
        }
        
        let itemsHtml = '';
        if (items.length === 0) {
            itemsHtml = '<p style="color:#aaa; text-align:center; padding:20px;">Нет подходящих предметов</p>';
        } else {
            itemsHtml = items.map(item => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #3a3ad7;">
                    <div>
                        <span style="color:#ffaa44; font-weight:bold;">${item.name}</span>
                        ${item.count > 1 ? `<span style="color:#aaa; margin-left:5px;">×${item.count}</span>` : ''}
                    </div>
                    <button class="equip-item-btn" data-item-id="${item.instanceId}" 
                        style="padding:4px 12px; background:#4a6b4a; color:white; border:1px solid #17d917; border-radius:4px; cursor:pointer;">
                        Надеть
                    </button>
                </div>
            `).join('');
        }
        
        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:8px; border-bottom:2px solid #5151e3;">
                <h3 style="margin:0; color:#a0a0ff; font-size:16px;">Выберите предмет для ${slotName}</h3>
                <button class="close-modal" style="background:none; border:none; color:#aaa; font-size:24px; cursor:pointer;">×</button>
            </div>
            <div style="max-height:350px; overflow-y:auto;">
                ${itemsHtml}
            </div>
        `;
        
        document.body.appendChild(modal);
        this.itemsModal = modal;
        
        modal.querySelector('.close-modal').addEventListener('click', () => this.closeItemsModal());
        
        modal.querySelectorAll('.equip-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = btn.dataset.itemId;
                const item = window.game.player.getInventoryItems().find(i => i.instanceId === itemId);
                if (item && this.onEquip) {
                    this.onEquip(item, slot);
                }
                this.closeItemsModal();
            });
        });
        
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
            
            if (target.classList.contains('unequip-btn')) {
                e.stopPropagation();
                const slot = target.dataset.slot;
                if (slot && typeof this.onUnequip === 'function') {
                    this.onUnequip(slot);
                }
                return;
            }
            
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
    
    destroy() {
        this.closeItemsModal();
        this.unsubscribeFunctions.forEach(fn => fn && fn());
        if (this.container) this.container.innerHTML = '';
    }
}

export { EquipmentUI };
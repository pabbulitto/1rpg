import { Item } from '../core/Item.js';

class InventorySystem {
  constructor(gameState) {
    this.gameState = gameState;
  }

  addItem(item) {
    if (!item) return false;
    
    if (item.stackable) {
      const items = this.gameState.getInventoryItems();
      
      for (let i = 0; i < items.length; i++) {
        const existingItem = items[i];
        if (existingItem.canStackWith(item)) {
          if (existingItem.count + item.count <= existingItem.maxStack) {
            existingItem.count += item.count;
            return true;
          }
        }
      }
    }
    
    this.gameState.addInventoryItem(item);
    return true;
  }

  addItemById(itemId, count = 1) {
    if (!window.itemsData || !window.itemsData[itemId]) {
      console.error(`Предмет ${itemId} не найден в базе данных`);
      return false;
    }
    
    const item = new Item(itemId, count);
    return this.addItem(item);
  }

  removeItem(itemIndex) {
    const items = this.gameState.getInventoryItems();
    if (itemIndex < 0 || itemIndex >= items.length) return null;
    const item = items[itemIndex];
    const success = this.gameState.removeInventoryItem(itemIndex);
    return success ? item : null;
  }
  
  useItem(itemIndex, player) {
    const items = this.gameState.getInventoryItems();
    
    if (itemIndex < 0 || itemIndex >= items.length) {
      return { success: false, message: "Предмет не найден" };
    }
    
    const item = items[itemIndex];
    
    if (item.type === "consumable") {
      const useResult = item.use(player);
      
      if (useResult.success) {
        if (item.stackable && item.count > 1) {
          item.count--;
          if (item.count === 0) {
            this.gameState.removeInventoryItem(itemIndex);
          }
        } else {
          this.gameState.removeInventoryItem(itemIndex);
        }
        
        return {
          success: true,
          message: useResult.effects.join(", "),
          effects: useResult.effects
        };
      }
    }
    
    return { success: false, message: "Нельзя использовать этот предмет" };
  }

  equipItem(itemIndex, player) {
    const items = this.gameState.getInventoryItems();
    
    if (itemIndex < 0 || itemIndex >= items.length) {
      return { success: false, message: "Предмет не найден" };
    }
    
    const item = items[itemIndex];
    
    if (!item.slot) {
      return { success: false, message: "Этот предмет нельзя надеть" };
    }
    
    let targetSlot = item.slot;
    const equipment = this.gameState.getEquipment();
    
    if (item.slot === "ring") {
      if (!equipment.ring1) targetSlot = "ring1";
      else if (!equipment.ring2) targetSlot = "ring2";
      else return { success: false, message: "Оба слота колец заняты" };
    }
    
    else if (item.slot === "neck") {
      if (!equipment.neck1) targetSlot = "neck1";
      else if (!equipment.neck2) targetSlot = "neck2";
      else return { success: false, message: "Оба слота амулетов заняты" };
    }
    
    else if (item.slot === "hand") {
      if (!equipment.right_hand) targetSlot = "right_hand";
      else if (!equipment.left_hand) targetSlot = "left_hand";
      else return { success: false, message: "Оба слота рук заняты" };
    }
    
    const removedItem = this.removeItem(itemIndex);
    if (!removedItem) {
      return { success: false, message: "Не удалось удалить предмет из инвентаря" };
    }
    
    const statManager = this.gameState.getStatManager();
    const equipmentSource = `equipment_${targetSlot}`;
    
    if (equipment[targetSlot]) {
      const oldItem = equipment[targetSlot];
      const equipped = player.equipItem(removedItem, targetSlot);
      
      if (equipped) {
        statManager.removeModifier(`equipment_${targetSlot}`);
        
        if (removedItem.stats && Object.keys(removedItem.stats).length > 0) {
          statManager.addModifier(equipmentSource, removedItem.stats);
        }
        
        this.addItem(oldItem);
        return { 
          success: true, 
          message: `Вы надели ${removedItem.name} (сняли ${oldItem.name})` 
        };
      } else {
        player.equipItem(oldItem, targetSlot); 
        this.addItem(removedItem); 
        return { success: false, message: "Не удалось надеть предмет" };
      }
    }
    
    const equipped = player.equipItem(removedItem, targetSlot);
    
    if (!equipped) {
      this.addItem(removedItem);
      return { success: false, message: "Не удалось надеть предмет" };
    }
    if (removedItem.stats && Object.keys(removedItem.stats).length > 0) {
      statManager.addModifier(equipmentSource, removedItem.stats);
    }
    
    return { success: true, message: `Вы надели ${removedItem.name}` };
  }

  unequipItem(slot, player) {
    const equipment = this.gameState.getEquipment();
    const item = equipment[slot];
    
    if (!item) return { 
      success: false, 
      message: "В этом слоте ничего нет", 
      isEmpty: true 
    };
    
    // Очищаем слот
    this.gameState.updateEquipment(slot, null);
    
    // Удаляем модификатор
    const statManager = this.gameState.getStatManager();
    statManager.removeModifier(`equipment_${slot}`);
    
    // Возвращаем предмет в инвентарь
    this.addItem(item);
    
    return { success: true, message: `Вы сняли ${item.name}` };
  }
  getInventoryInfo() {
    const items = this.gameState.getInventoryItems();
    const equipment = this.gameState.getEquipment();
    const statManager = this.gameState.getStatManager();
    
    // Получаем финальные характеристики из StatManager
    const finalStats = statManager.getFinalStats();
    const bonuses = {
      attack: finalStats.attack - (statManager.getBaseStats().attack || 0),
      defense: finalStats.defense - (statManager.getBaseStats().defense || 0),
      health: finalStats.maxHealth - (statManager.getBaseStats().maxHealth || 0)
    };
    
    return {
      items: items.map(item => item.getInfo()),
      equipment: Object.entries(equipment).reduce((acc, [slot, item]) => {
        acc[slot] = item ? item.getInfo() : null;
        return acc;
      }, {}),
      bonuses
    };
  }

  findItemIndexById(itemId) {
    const items = this.gameState.getInventoryItems();
    return items.findIndex(item => item.id === itemId);
  }

  getItemCount(itemId) {
    const items = this.gameState.getInventoryItems();
    return items
      .filter(item => item.id === itemId && item.stackable)
      .reduce((total, item) => total + item.count, 0);
  }

  hasItem(itemId) {
    return this.getItemCount(itemId) > 0;
  }
}

export { InventorySystem };

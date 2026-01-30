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
    
    const equipment = this.gameState.getEquipment();
    const statManager = this.gameState.getStatManager();
    
    // === ОБРАБОТКА ДВУРУЧНОГО ОРУЖИЯ (НОВАЯ ЛОГИКА) ===
    if (item.slot === "two_handed") {
      const rightHandItem = equipment.right_hand;
      const leftHandItem = equipment.left_hand;
      
      // Проверяем, можно ли освободить левую руку
      if (leftHandItem && leftHandItem.slot === "two_handed") {
        return { success: false, message: "Уже экипировано двуручное оружие" };
      }
      
      // Снимаем предметы с обеих рук
      if (rightHandItem) {
        const unequipResult = this.unequipItem("right_hand", player);
        if (!unequipResult.success && !unequipResult.isEmpty) {
          return { success: false, message: "Не удалось освободить правую руку" };
        }
      }
      
      if (leftHandItem) {
        const unequipResult = this.unequipItem("left_hand", player);
        if (!unequipResult.success && !unequipResult.isEmpty) {
          return { success: false, message: "Не удалось освободить левую руку" };
        }
      }
      
      // Надеваем двуручник в правую руку
      const removedItem = this.removeItem(itemIndex);
      if (!removedItem) {
        return { success: false, message: "Не удалось удалить предмет из инвентаря" };
      }
      
      const equipped = player.equipItem(removedItem, "right_hand");
      if (!equipped) {
        this.addItem(removedItem);
        return { success: false, message: "Не удалось надеть двуручное оружие" };
      }
      
      // Добавляем модификатор
      if (removedItem.stats && Object.keys(removedItem.stats).length > 0) {
        statManager.addModifier("equipment_right_hand", removedItem.stats);
      }
      const result = { success: true, message: `Вы надели ${removedItem.name} (двуручное)` };
      this.gameState.eventBus.emit('player:equipmentChanged', { slot: 'right_hand', item: removedItem });
      this.gameState.eventBus.emit('player:statsChanged', this.gameState.getPlayer());
      return result;      
    }
    // === СТАРАЯ ЛОГИКА ДЛЯ РУК (С ДОПОЛНЕНИЕМ) ===
    if (item.slot === "hand") {
      // ПРОВЕРКА: левая рука не заблокирована двуручником
      const rightHandItem = equipment.right_hand;
      if (rightHandItem && rightHandItem.slot === "two_handed") {
        return { success: false, message: "Левая рука занята двуручным оружием" };
      }
      
      // Ищем свободную руку
      let targetSlot = null;
      if (!equipment.right_hand) {
        targetSlot = "right_hand";
      } else if (!equipment.left_hand) {
        targetSlot = "left_hand";
      } else {
        return { success: false, message: "Обе руки заняты" };
      }
      
      return this.equipToSlot(itemIndex, targetSlot, player, item);
    }
    
    // === ОБРАБОТКА КОЛЕЦ (старая логика) ===
    if (item.slot === "ring") {
      if (!equipment.ring1) {
        return this.equipToSlot(itemIndex, "ring1", player, item);
      } else if (!equipment.ring2) {
        return this.equipToSlot(itemIndex, "ring2", player, item);
      } else {
        return { success: false, message: "Оба слота колец заняты" };
      }
    }
    
    // === ОБРАБОТКА АМУЛЕТОВ (старая логика) ===
    if (item.slot === "neck") {
      if (!equipment.neck1) {
        return this.equipToSlot(itemIndex, "neck1", player, item);
      } else if (!equipment.neck2) {
        return this.equipToSlot(itemIndex, "neck2", player, item);
      } else {
        return { success: false, message: "Оба слота амулетов заняты" };
      }
    }
    
    // === ОБРАБОТКА ПРЯМЫХ СЛОТОВ (НОВАЯ ЛОГИКА) ===
    const directSlots = ["head", "body", "arms", "hands", "belt", "legs", "feet"];
    if (directSlots.includes(item.slot)) {
      return this.equipToSlot(itemIndex, item.slot, player, item);
    }
    
    // === РЕЗЕРВНЫЙ ВАРИАНТ (старая логика) ===
    let targetSlot = item.slot;
    
    if (equipment[targetSlot]) {
      const oldItem = equipment[targetSlot];
      const equipped = player.equipItem(item, targetSlot);
      
      if (equipped) {
        statManager.removeModifier(`equipment_${targetSlot}`);
        
        if (item.stats && Object.keys(item.stats).length > 0) {
          statManager.addModifier(`equipment_${targetSlot}`, item.stats);
        }
        
        this.addItem(oldItem);
        return { 
          success: true, 
          message: `Вы надели ${item.name} (сняли ${oldItem.name})` 
        };
      } else {
        player.equipItem(oldItem, targetSlot);
        this.addItem(item);
        return { success: false, message: "Не удалось надеть предмет" };
      }
    }
    
    const equipped = player.equipItem(item, targetSlot);
    
    if (!equipped) {
      this.addItem(item);
      return { success: false, message: "Не удалось надеть предмет" };
    }
    
    if (item.stats && Object.keys(item.stats).length > 0) {
      statManager.addModifier(`equipment_${targetSlot}`, item.stats);
    }
    
    return { success: true, message: `Вы надели ${item.name}` };
  }
  
  // === ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ НАДЕВАНИЯ В КОНКРЕТНЫЙ СЛОТ ===
  equipToSlot(itemIndex, targetSlot, player, item) {
    const equipment = this.gameState.getEquipment();
    const statManager = this.gameState.getStatManager();
    
    const removedItem = this.removeItem(itemIndex);
    if (!removedItem) {
      return { success: false, message: "Не удалось удалить предмет из инвентаря" };
    }
    
    const equipmentSource = `equipment_${targetSlot}`;
    
    if (equipment[targetSlot]) {
      const oldItem = equipment[targetSlot];
      const equipped = player.equipItem(removedItem, targetSlot);
      
      if (equipped) {
        statManager.removeModifier(equipmentSource);
        
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
    const result = { success: true, message: `Вы надели ${removedItem.name}` };
    this.gameState.eventBus.emit('inventory:updated', this.getInventoryInfo());
    this.gameState.eventBus.emit('player:statsChanged', this.gameState.getPlayer());
    return result;    
  }

  unequipItem(slot, player) {
    const equipment = this.gameState.getEquipment();
    const item = equipment[slot];
    
    if (!item) return { 
      success: false, 
      message: "В этом слоте ничего нет", 
      isEmpty: true 
    };
    
    // === ОСОБАЯ ЛОГИКА ДЛЯ ДВУРУЧНИКА ===
    if (item.slot === "two_handed" && slot === "right_hand") {
      // При снятии двуручника освобождаем только правую руку
      // Левая рука и так была "заблокирована"
      this.gameState.updateEquipment("right_hand", null);
      
      const statManager = this.gameState.getStatManager();
      statManager.removeModifier(`equipment_right_hand`);
      
      this.addItem(item);
      return { success: true, message: `Вы сняли ${item.name} (двуручное)` };
    }
    // === СТАНДАРТНАЯ ЛОГИКА ===
    this.gameState.updateEquipment(slot, null);
    
    const statManager = this.gameState.getStatManager();
    statManager.removeModifier(`equipment_${slot}`);
    
    this.addItem(item);
    const result = { success: true, message: `Вы сняли ${item.name}` };
    this.gameState.eventBus.emit('inventory:updated', this.getInventoryInfo());
    this.gameState.eventBus.emit('player:statsChanged', this.gameState.getPlayer());
    return result;
  }
  
  getInventoryInfo() {
    const items = this.gameState.getInventoryItems();
    const equipment = this.gameState.getEquipment();
    const statManager = this.gameState.getStatManager();
    
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
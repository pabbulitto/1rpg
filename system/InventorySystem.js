import { Item } from '../core/Item.js';

class InventorySystem {
  constructor(gameState, equipmentService = null) {
    this.gameState = gameState;
    this.equipmentService = equipmentService;
    
    // Обратная совместимость: если сервис не передан
    if (!equipmentService) {
      console.warn('InventorySystem: EquipmentService не передан, используется упрощенная логика');
    }
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
            this.gameState.eventBus.emit('inventory:updated', this.getInventoryInfo());
            return true;
          }
        }
      }
    }
    
    this.gameState.addInventoryItem(item);
    this.gameState.eventBus.emit('inventory:updated', this.getInventoryInfo());
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
    
    if (success) {
      this.gameState.eventBus.emit('inventory:updated', this.getInventoryInfo());
      return item;
    }
    
    return null;
  }
  
  useItem(itemIndex, player) {
    const items = this.gameState.getInventoryItems();
    
    if (itemIndex < 0 || itemIndex >= items.length) {
      return { success: false, message: "Предмет не найден" };
    }
    
    const battleState = this.gameState.getBattleState();
    if (battleState.inBattle) {
      if (window.game && window.game.battleService) {
        window.game.battleService.useItemInBattle(itemIndex, false);
        return { success: true, message: 'Предмет используется в бою' };
      }
      return { success: false, message: 'BattleService не найден' };
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
        
        this.gameState.eventBus.emit('inventory:updated', this.getInventoryInfo());
        
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
    const equipment = this.gameState.getEquipment();
    
    // === ИСПОЛЬЗУЕМ EQUIPMENTSERVICE ЕСЛИ ОН ПЕРЕДАН ===
    if (this.equipmentService) {
      return this.equipWithService(itemIndex, item, equipment, player);
    }
    
    // === СТАРАЯ ЛОГИКА (для обратной совместимости) ===
    return this.equipLegacy(itemIndex, player, item);
  }
  
  // НОВЫЙ МЕТОД: экипировка через EquipmentService
  equipWithService(itemIndex, item, equipment, player) {
    // 1. Проверяем возможность экипировки
    const validation = this.equipmentService.canEquip(item, equipment, player);
    
    if (!validation.success) {
      return { success: false, message: validation.message };
    }
    
    const { targetSlot, slotsToClear } = validation;
    
    // 2. Освобождаем слоты если нужно (для двуручного оружия)
    for (const slot of slotsToClear) {
      const unequipResult = this.unequipItem(slot, player);
      if (!unequipResult.success && !unequipResult.isEmpty) {
        return { success: false, message: `Не удалось освободить ${this.getSlotName(slot)}` };
      }
    }
    
    // 3. Удаляем предмет из инвентаря
    const removedItem = this.removeItem(itemIndex);
    if (!removedItem) {
      return { success: false, message: "Не удалось удалить предмет из инвентаря" };
    }
    
    // 4. Экипируем
    const equipped = player.equipItem(removedItem, targetSlot);
    if (!equipped) {
      this.addItem(removedItem); // Возвращаем обратно в инвентарь
      return { success: false, message: "Не удалось надеть предмет" };
    }
    
    // 5. Применяем модификаторы через сервис
    this.equipmentService.applyEquipmentModifiers(targetSlot, removedItem);
    
    // 6. Отправляем события
    this.gameState.eventBus.emit('player:equipmentChanged', { 
      slot: targetSlot, 
      item: removedItem 
    });
    
    // 7. Особый случай: двуручное оружие блокирует левую руку
    if (item.slot === 'two_handed') {
    }
    
    return { 
      success: true, 
      message: `Вы надели ${removedItem.name}` 
    };
  }
  // СТАРАЯ ЛОГИКА (оставлена для обратной совместимости)
  equipLegacy(itemIndex, player, item) {
    const items = this.gameState.getInventoryItems();
    const equipment = this.gameState.getEquipment();
    const statManager = this.gameState.getStatManager();
    
    if (item.slot === "two_handed") {
      const rightHandItem = equipment.right_hand;
      const leftHandItem = equipment.left_hand;
      
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
      
      // ... остальная старая логика ...
    }
    
    return this.equipToSlot(itemIndex, item.slot, player, item);
  }

  unequipItem(slot, player) {
    const equipment = this.gameState.getEquipment();
    const item = equipment[slot];
    
    if (!item) return { 
      success: false, 
      message: "В этом слоте ничего нет", 
      isEmpty: true 
    };
    // === ИСПОЛЬЗУЕМ EQUIPMENTSERVICE ЕСЛИ ОН ПЕРЕДАН ===
    if (this.equipmentService) {
      // Обработка через сервис
      const unequipResult = this.equipmentService.handleUnequip(slot, item, equipment);
      
      if (unequipResult.success) {
        // Освобождаем слот(ы)
        for (const freedSlot of unequipResult.freedSlots) {
          this.gameState.updateEquipment(freedSlot, null);
          this.equipmentService.applyEquipmentModifiers(freedSlot, null);
        }
        
        // Возвращаем предмет в инвентарь
        this.addItem(item);
        
        // Отправляем события
        this.gameState.eventBus.emit('player:equipmentChanged', { slot: slot, item: null });
        
        return { 
          success: true, 
          message: unequipResult.message,
          item: item
        };
      }
    }
    // === СТАНДАРТНАЯ ЛОГИКА ===
    this.gameState.updateEquipment(slot, null);
    
    const statManager = this.gameState.getStatManager();
    statManager.removeModifier(`equipment_${slot}`);
    
    this.addItem(item);
    
    const result = { 
      success: true, 
      message: `Вы сняли ${item.name}`,
      item: item
    };
    
    this.gameState.eventBus.emit('player:equipmentChanged', { slot: slot, item: null });
    this.gameState.eventBus.emit('player:statsChanged', this.gameState.getPlayer());
    
    return result;
  }
  
  equipToSlot(itemIndex, targetSlot, player, item) {
    // СТАРАЯ ЛОГИКА из исходного файла
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
    this.gameState.eventBus.emit('player:equipmentChanged', { slot: targetSlot, item: removedItem });
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
  
  // Вспомогательный метод для получения имени слота
  getSlotName(slot) {
    const slotNames = {
      'head': 'голову',
      'body': 'тело',
      'arms': 'руки',
      'hands': 'кисти',
      'belt': 'пояс',
      'legs': 'ноги',
      'feet': 'ступни',
      'right_hand': 'правую руку',
      'left_hand': 'левую руку',
      'ring1': 'первое кольцо',
      'ring2': 'второе кольцо',
      'neck1': 'первый амулет',
      'neck2': 'второй амулет'
    };
    
    return slotNames[slot] || slot;
  }
}

export { InventorySystem };
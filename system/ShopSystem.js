class ShopSystem {
  constructor(gameState) {
    this.gameState = gameState;
    this.currentShop = null;
    this.shopItems = [];
  }
  
  loadShop(roomId) {
    const shopData = window.shopsData?.[roomId];
    
    if (!shopData) {
      console.error(`Магазин для комнаты ${roomId} не найден`);
      return false;
    }
    
    this.currentShop = shopData;
    this.shopItems = shopData.items || [];
    return true;
  }
  
  getShopItems() {
    return this.shopItems.map(itemId => {
      const itemData = window.itemsData?.[itemId];
      return itemData ? { ...itemData, id: itemId } : null;
    }).filter(item => item !== null);
  }
  
  buyItem(itemId, player, inventorySystem) {
    const itemData = window.itemsData?.[itemId];
    
    if (!itemData) {
      return { success: false, message: "Предмет не найден" };
    }
    
    if (!this.gameState.spendGold(itemData.price)) {
      return { success: false, message: "Недостаточно золота" };
    }
    
    if (!this.shopItems.includes(itemId)) {
      return { success: false, message: "Этот предмет не продается" };
    }
    
    const added = inventorySystem.addItemById(itemId, 1);
    
    if (added) {
      return { 
        success: true, 
        message: `Куплено: ${itemData.name} за ${itemData.price} золота`,
        goldSpent: itemData.price,
        item: itemData
      };
    }
    
    return { success: false, message: "Не удалось добавить предмет" };
  }
  
  sellItem(itemIndex, player, inventorySystem) {
    const items = this.gameState.getInventoryItems();
    
    if (itemIndex < 0 || itemIndex >= items.length) {
      return { success: false, message: "Предмет не найден" };
    }
    
    const item = items[itemIndex];
    if (!item) {
      return { success: false, message: "Предмет не найден" };
    }
    
    const sellPrice = Math.floor(item.price / 2);
    
    // removeItem теперь возвращает удалённый предмет
    const removedItem = inventorySystem.removeItem(itemIndex);
    
    // Проверяем, что предмет действительно удалён (возвращён)
    if (removedItem) {
      this.gameState.addGold(sellPrice);
      
      return { 
        success: true, 
        message: `Продано: ${item.name} за ${sellPrice} золота`,
        goldReceived: sellPrice,
        item: item.getInfo()
      };
    }
  
  return { success: false, message: "Не удалось продать предмет" };
}
  
  getShopInfo() {
    if (!this.currentShop) return null;
    
    const playerData = this.gameState.getPlayer();
    
    return {
      name: this.currentShop.name || "Магазин",
      description: this.currentShop.description || "",
      items: this.getShopItems(),
      playerGold: playerData.gold
    };
  }
}

export { ShopSystem };
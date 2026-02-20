// services/ShopSystem.js
import { itemFactory } from '../core/ItemFactory.js';

class ShopSystem {
  constructor(gameState) {
    this.gameState = gameState;
    this.currentShop = null;
    this.shopItems = [];
    
    // ===== ЗАГОТОВКА ДЛЯ ЛИМИТИРОВАННЫХ ТОВАРОВ =====
    /** @type {Map<string, {count: number, maxCount: number, restockTime: number}>} */
    this.shopInventory = new Map(); // itemId -> { count, maxCount, restockTime }
    
    /** @type {number} Время последнего обновления запасов */
    this.lastRestockTick = 0;
    
    /** @type {number} Интервал обновления запасов (в тиках) */
    this.restockInterval = 100; // 100 тиков ≈ 10 минут игрового времени
  }
  
  loadShop(roomId) {
    const shopData = window.shopsData?.[roomId];
    
    if (!shopData) {
      console.error(`Магазин для комнаты ${roomId} не найден`);
      return false;
    }
    
    this.currentShop = shopData;
    this.shopItems = shopData.items || [];
    
    // ===== ИНИЦИАЛИЗАЦИЯ ЛИМИТИРОВАННЫХ ТОВАРОВ =====
    this._initShopInventory(shopData);
    
    return true;
  }
  
  /**
   * Инициализация запасов магазина
   * @private
   */
  _initShopInventory(shopData) {
    this.shopInventory.clear();
    
    if (shopData.limitedItems) {
      // Если в данных магазина указаны лимиты
      Object.entries(shopData.limitedItems).forEach(([itemId, config]) => {
        this.shopInventory.set(itemId, {
          count: config.initialCount || config.maxCount,
          maxCount: config.maxCount,
          restockTime: config.restockTime || this.restockInterval
        });
      });
    } else {
      // По умолчанию все товары безлимитные
      this.shopItems.forEach(itemId => {
        this.shopInventory.set(itemId, {
          count: -1, // -1 означает бесконечно
          maxCount: -1,
          restockTime: 0
        });
      });
    }
  }
  
  /**
   * Получить список товаров с учетом лимитов
   * @returns {Array} массив доступных предметов
   */
  getShopItems() {
    const availableItems = [];
    
    this.shopItems.forEach(itemId => {
      const stock = this.shopInventory.get(itemId);
      
      // Проверяем наличие (если count = -1, то бесконечно)
      if (stock && (stock.count === -1 || stock.count > 0)) {
        const itemData = window.itemsData?.[itemId];
        if (itemData) {
          availableItems.push({
            ...itemData,
            id: itemId,
            stock: stock.count === -1 ? '∞' : stock.count
          });
        }
      }
    });
    
    return availableItems;
  }

  canBuy(itemId, player) {
      const itemData = window.itemsData?.[itemId];
      
      if (!itemData) {
          return { success: false, message: "Предмет не найден" };
      }
      
      // Проверка наличия в магазине
      if (!this.shopItems.includes(itemId)) {
          return { success: false, message: "Этот предмет не продается" };
      }
      
      // Проверка лимитов
      const stock = this.shopInventory.get(itemId);
      if (stock && stock.count !== -1 && stock.count <= 0) {
          return { success: false, message: "Товар временно отсутствует" };
      }
      
      // ===== ИСПРАВЛЕНО: проверка золота в инвентаре =====
      const playerGold = this._getPlayerGold();
      if (playerGold < itemData.price) {
          return { success: false, message: "Недостаточно золота" };
      }
      
      return { success: true, itemData, stock };
  }
  _executeBuy(itemId, player, validationResult) {
      const { itemData, stock } = validationResult;
      
      // ===== ИСПРАВЛЕНО: списываем золото =====
      if (!this._spendGoldFromInventory(itemData.price)) {
          return { success: false, message: "Не удалось списать золото" };
      }
      
      // Уменьшаем количество, если товар лимитированный
      if (stock && stock.count !== -1) {
          stock.count--;
          this.shopInventory.set(itemId, stock);
      }
      
      // Создаем предмет через фабрику
      const item = itemFactory.create(itemId, 1);
      if (!item) {
          // Возвращаем золото
          this._addGoldToInventory(itemData.price);
          // Возвращаем товар обратно в магазин
          if (stock && stock.count !== -1) {
              stock.count++;
              this.shopInventory.set(itemId, stock);
          }
          return { success: false, message: "Не удалось создать предмет" };
      }
      
      // Добавляем предмет в инвентарь
      const added = this.gameState.playerContainer.addItem(item);
      if (!added) {
          // Возвращаем золото
          this._addGoldToInventory(itemData.price);
          // Возвращаем товар обратно в магазин
          if (stock && stock.count !== -1) {
              stock.count++;
              this.shopInventory.set(itemId, stock);
          }
          item.destroy();
          return { success: false, message: "Не удалось добавить предмет в инвентарь" };
      }
      
      // Событие для будущих расширений
      this.gameState.eventBus.emit('shop:purchase', {
          itemId,
          price: itemData.price,
          player: player.id,
          shopId: this.currentShop?.id
      });
      
      return { 
          success: true, 
          message: `Куплено: ${itemData.name} за ${itemData.price} золота`,
          goldSpent: itemData.price,
          item: itemData
      };
  }
  /**
   * Купить предмет
   * @param {string} itemId 
   * @param {Object} player 
   * @returns {Object} результат покупки
   */
  buyItem(itemId, player) {
      // 1. Проверка
      const validation = this.canBuy(itemId, player);
      if (!validation.success) {
          return validation;
      }
      
      // 2. Исполнение
      return this._executeBuy(itemId, player, validation);
  }
  
  /**
   * Цена продажи предмета
   * @param {Item} item 
   * @returns {number} цена продажи
   */
  getSellPrice(item) {
    if (!item || !item.price) return 1;
    
    // Базовая формула: половина цены покупки
    let price = Math.floor(item.price / 2);
    
    // ===== ЗАГОТОВКИ ДЛЯ БУДУЩИХ РАСШИРЕНИЙ =====
    
    // TODO: Модификаторы от навыков игрока (торговля, харизма)
    // if (player.hasSkill('bargaining')) price = Math.floor(price * 1.2);
    
    // TODO: Модификаторы от репутации с фракцией магазина
    // if (this.currentShop?.faction && player.reputation[this.currentShop.faction] > 50) {
    //   price = Math.floor(price * 1.1);
    // }
    
    // TODO: Модификаторы от типа магазина (скупщик краденого дает меньше)
    // if (this.currentShop?.type === 'fence') price = Math.floor(price * 0.7);
    
    // TODO: Динамические цены в зависимости от спроса
    // if (this.itemDemand[item.id]) price = Math.floor(price * this.itemDemand[item.id]);
    
    return Math.max(1, price);
  }
  /**
   * Получить количество золота в инвентаре
   * @returns {number}
   */
  _getPlayerGold() {
      const items = this.gameState.playerContainer.getAllItems();
      const goldItem = items.find(item => item.id === 'gold');
      return goldItem ? goldItem.count : 0;
  }

  /**
   * Добавить золото в инвентарь
   * @param {number} amount
   * @returns {boolean}
   */
  _addGoldToInventory(amount) {
      if (amount <= 0) return false;
      
      const items = this.gameState.playerContainer.getAllItems();
      const goldItem = items.find(item => item.id === 'gold');
      
      if (goldItem) {
          goldItem.count += amount;
      } else {
          const newGold = itemFactory.create('gold', amount);
          if (!newGold) return false;
          this.gameState.playerContainer.addItem(newGold);
      }
      
      this.gameState.eventBus.emit('inventory:updated', 
          this.gameState.playerContainer.getInfo());
      this.gameState.eventBus.emit('player:statsChanged', 
          this.gameState.getPlayer());
      
      return true;
  }

  /**
   * Потратить золото из инвентаря
   * @param {number} amount
   * @returns {boolean}
   */
  _spendGoldFromInventory(amount) {
      if (amount <= 0) return true;
      
      const items = this.gameState.playerContainer.getAllItems();
      const goldItem = items.find(item => item.id === 'gold');
      
      if (!goldItem || goldItem.count < amount) return false;
      
      goldItem.count -= amount;
      
      if (goldItem.count <= 0) {
          const index = items.indexOf(goldItem);
          this.gameState.playerContainer.removeItem(index);
      }
      
      this.gameState.eventBus.emit('inventory:updated', 
          this.gameState.playerContainer.getInfo());
      this.gameState.eventBus.emit('player:statsChanged', 
          this.gameState.getPlayer());
      
      return true;
  }

  sellItem(itemIndex, player) {
      const items = this.gameState.playerContainer.getAllItems();
      
      if (itemIndex < 0 || itemIndex >= items.length) {
          return { success: false, message: "Предмет не найден" };
      }
      
      const item = items[itemIndex];
      if (!item) {
          return { success: false, message: "Предмет не найден" };
      }
      
      const sellPrice = this.getSellPrice(item);
      
      // Продажа из стека
      if (item.stackable && item.count > 1) {
          item.count--;
          this.gameState.playerContainer._markDirty();
          
          // ===== ИСПРАВЛЕНО: добавляем золото в инвентарь =====
          this._addGoldToInventory(sellPrice);
          
          this.gameState.eventBus.emit('inventory:updated', 
              this.gameState.playerContainer.getInfo());
          this.gameState.eventBus.emit('player:statsChanged', 
              this.gameState.getPlayer());
          
          return { 
              success: true, 
              message: `Продано: ${item.name} за ${sellPrice} золота`,
              goldReceived: sellPrice,
              item: item.getInfo()
          };
      } 
      // Продажа всего предмета
      else {
          const removedItem = this.gameState.playerContainer.removeItem(itemIndex);
          if (removedItem) {
              // ===== ИСПРАВЛЕНО: добавляем золото в инвентарь =====
              this._addGoldToInventory(sellPrice);
              
              this.gameState.eventBus.emit('inventory:updated', 
                  this.gameState.playerContainer.getInfo());
              this.gameState.eventBus.emit('player:statsChanged', 
                  this.gameState.getPlayer());
              
              return { 
                  success: true, 
                  message: `Продано: ${item.name} за ${sellPrice} золота`,
                  goldReceived: sellPrice,
                  item: item.getInfo()
              };
          }
      }
      
      return { success: false, message: "Не удалось продать предмет" };
  } 
  /**
   * Обновить запасы магазина (вызывать каждый тик)
   * @param {number} currentTick 
   */
  updateStock(currentTick) {
    if (currentTick - this.lastRestockTick < this.restockInterval) return;
    
    this.lastRestockTick = currentTick;
    
    for (const [itemId, stock] of this.shopInventory.entries()) {
      if (stock.count !== -1 && stock.count < stock.maxCount) {
        // Восстанавливаем 1 единицу товара за интервал
        stock.count++;
        this.shopInventory.set(itemId, stock);
        
        this.gameState.eventBus.emit('shop:restocked', {
          itemId,
          newCount: stock.count,
          shopId: this.currentShop?.id
        });
      }
    }
  }
  
  getShopInfo() {
      if (!this.currentShop) return null;
      
      return {
          name: this.currentShop.name || "Магазин",
          description: this.currentShop.description || "",
          items: this.getShopItems(),
          // ===== ИСПРАВЛЕНО: золото из инвентаря =====
          playerGold: this._getPlayerGold()
      };
  }
}

export { ShopSystem };
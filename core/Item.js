class Item {
  constructor(itemId, count = 1) {
    const itemData = window.itemsData?.[itemId] || this.getDefaultData();
    
    this.id = itemId;
    this.name = itemData.name;
    this.type = itemData.type;
    this.slot = itemData.slot;
    this.stats = {...itemData.stats};
    this.price = itemData.price;
    this.stackable = itemData.stackable || false;
    this.maxStack = itemData.maxStack || 99;
    this.count = count;
  }
  
  getDefaultData() {
    return {
      name: "Неизвестный предмет",
      type: "misc",
      slot: null,
      stats: {},
      price: 1,
      stackable: false
    };
  }
  
  canStackWith(otherItem) {
    if (!this.stackable || !otherItem.stackable) return false;
    
    return (
      this.id === otherItem.id &&
      this.type === otherItem.type &&
      this.price === otherItem.price
    );
  }
  
  splitStack(amount) {
    if (!this.stackable || amount >= this.count) return null;
    
    const newItem = new Item(this.id, amount);
    this.count -= amount;
    return newItem;
  }
  
  getSellPrice() {
    return Math.floor((this.price / 2) * this.count);
  }
  
  use(player) {
      if (this.type !== "consumable") {
          return { success: false, message: "Нельзя использовать этот предмет" };
      }
      
      let result = { success: true, effects: [] };
      
      // ВОССТАНОВЛЕНИЕ ЗДОРОВЬЯ
      if (this.stats.health > 0) {
          const healed = player.heal(this.stats.health);
          result.effects.push(`Восстановлено ${healed} здоровья`);
      }
      
      // ВРЕМЕННЫЕ БОНУСЫ - через gameState.statManager
      if (this.stats.attack > 0) {
          // НОВЫЙ ПОДХОД: модификатор через StatManager
          const game = window.game; // получаем доступ к game
          if (game && game.gameState && game.gameState.statManager) {
              const sourceId = `item_${this.id}_${Date.now()}`;
              game.gameState.statManager.addModifier(sourceId, { 
                  attack: this.stats.attack 
              });
              // Удалить через 10 тиков (можно позже добавить через TimeSystem)
              setTimeout(() => {
                  game.gameState.statManager.removeModifier(sourceId);
              }, 10000); // 10 секунд как временное решение
              result.effects.push(`Атака +${this.stats.attack} на 10 ходов`);
          }
      }
      
      if (this.stats.defense > 0) {
          const game = window.game;
          if (game && game.gameState && game.gameState.statManager) {
              const sourceId = `item_${this.id}_def_${Date.now()}`;
              game.gameState.statManager.addModifier(sourceId, { 
                  defense: this.stats.defense 
              });
              setTimeout(() => {
                  game.gameState.statManager.removeModifier(sourceId);
              }, 10000);
              result.effects.push(`Защита +${this.stats.defense} на 10 ходов`);
          }
      }
      
      return result;
  }
  
  // ДОБАВИТЬ В КОНЕЦ КЛАССА Item (перед export)
  applyTimedEffect(effectName, statChanges, durationTicks = 10) {
      const game = window.game;
      if (!game || !game.gameState || !game.gameState.statManager) {
          return null;
      }
      
      const sourceId = `item_${this.id}_${effectName}_${Date.now()}`;
      game.gameState.statManager.addModifier(sourceId, statChanges);
      
      // Интеграция с TimeSystem для автоудаления
      if (game.timeSystem) {
          const removeAfterTicks = () => {
              game.gameState.statManager.removeModifier(sourceId);
          };
          // Временное решение - позже через BaseEffect
          setTimeout(removeAfterTicks, durationTicks * 1000);
      }
      
      return sourceId;
  }

  getInfo() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      slot: this.slot,
      stats: this.stats,
      price: this.price,
      stackable: this.stackable,
      count: this.count,
      sellPrice: this.getSellPrice()
    };
  }
  
  static createItem(itemId, count = 1) {
    return new Item(itemId, count);
  }

}
export { Item };
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
    
    if (this.stats.health > 0) {
      const healed = player.heal(this.stats.health);
      result.effects.push(`Восстановлено ${healed} здоровья`);
    }
    
    if (this.stats.attack > 0) {
      player.tempAttackBonus = (player.tempAttackBonus || 0) + this.stats.attack;
      result.effects.push(`Атака +${this.stats.attack} на 10 ходов`);
    }
    
    if (this.stats.defense > 0) {
      player.tempDefenseBonus = (player.tempDefenseBonus || 0) + this.stats.defense;
      result.effects.push(`Защита +${this.stats.defense} на 10 ходов`);
    }
    
    return result;
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
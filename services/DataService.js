class DataService {
    constructor() {
        this.enemiesData = null;
        this.itemsData = null;
        this.shopsData = null;
        this.loaded = false;
    }
    
    async loadGameData() {
        try {
            const [enemiesData, itemsData, shopsData] = await Promise.all([
                this.loadJson('./data/enemies.json'),
                this.loadJson('./data/items.json'),
                this.loadJson('./data/shops.json')
            ]);
            
            this.enemiesData = enemiesData;
            this.itemsData = itemsData;
            this.shopsData = shopsData;
            
            window.enemiesData = enemiesData;
            window.itemsData = itemsData;
            window.shopsData = shopsData;
            
            this.loaded = true;
            console.log('DataService: данные игры загружены');
            return true;
        } catch (error) {
            console.error('DataService: ошибка загрузки данных:', error);
            return false;
        }
    }
    
    async loadJson(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText} для ${url}`);
            }
            return response.json();
        } catch (error) {
            console.error(`DataService: ошибка загрузки JSON ${url}:`, error);
            throw error;
        }
    }
    
    getEnemyData(enemyType) {
        return this.enemiesData?.[enemyType] || null;
    }
    
    getItemData(itemId) {
        return this.itemsData?.[itemId] || null;
    }
    
    getShopData(shopId) {
        return this.shopsData?.[shopId] || null;
    }
    
    isLoaded() {
        return this.loaded;
    }
}

export { DataService };
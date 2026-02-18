// services/DataService.js
import { ItemDataRegistry } from '../data/ItemDataRegistry.js';

class DataService {
    constructor() {
        this.enemiesData = null;
        this.itemsData = null;
        this.shopsData = null;
        this.spellsData = null;
        this.skillsData = null;
        this.roomsData = new Map(); // zoneId -> roomData
        this.loaded = false;
    }
    
    async loadGameData() {
        try {
            // Загружаем ВСЕ JSON файлы параллельно
            const [enemiesData, itemsData, shopsData, spellsData, skillsData] = await Promise.all([
                this.loadJson('./data/enemies.json'),
                this.loadJson('./data/items.json'),
                this.loadJson('./data/shops.json'),
                this.loadJson('./data/spells.json'),
                this.loadJson('./data/skills.json')
            ]);
            
            this.enemiesData = enemiesData;
            this.itemsData = itemsData;
            this.shopsData = shopsData;
            this.spellsData = spellsData;
            this.skillsData = skillsData;
            
            // ИНИЦИАЛИЗИРУЕМ РЕЕСТР ПРЕДМЕТОВ
            ItemDataRegistry.init(itemsData);
            
            // Для обратной совместимости (пока не перепишем всё)
            window.enemiesData = enemiesData;
            window.itemsData = itemsData;
            window.shopsData = shopsData;
            window.spellsData = spellsData;
            window.skillsData = skillsData;
            
            this.loaded = true;
            console.log('DataService: данные игры загружены', {
                enemies: Object.keys(enemiesData || {}).length,
                items: Object.keys(itemsData || {}).length,
                shops: Object.keys(shopsData || {}).length,
                spells: Object.keys(spellsData || {}).length,
                skills: Object.keys(skillsData || {}).length
            });
            
            return true;
        } catch (error) {
            console.error('DataService: критическая ошибка загрузки данных:', error);
            return false;
        }
    }
    
    async loadJson(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                // Для опциональных файлов возвращаем пустой объект
                if (url.includes('spells.json') || url.includes('skills.json')) {
                    console.warn(`DataService: файл ${url} не найден, используем пустые данные`);
                    return {};
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText} для ${url}`);
            }
            return response.json();
        } catch (error) {
            // Для опциональных файлов возвращаем пустой объект
            if (url.includes('spells.json') || url.includes('skills.json')) {
                console.warn(`DataService: не удалось загрузить ${url}, используем пустые данные:`, error.message);
                return {};
            }
            console.error(`DataService: ошибка загрузки JSON ${url}:`, error);
            throw error;
        }
    }
    
    /**
     * Загрузить данные комнат для зоны
     * @param {string} zoneId 
     * @returns {Promise<Object>}
     */
    async loadRoomData(zoneId) {
        if (this.roomsData.has(zoneId)) {
            return this.roomsData.get(zoneId);
        }
        
        try {
            const data = await this.loadJson(`./data/rooms/${zoneId}.json`);
            this.roomsData.set(zoneId, data);
            return data;
        } catch (error) {
            console.error(`DataService: ошибка загрузки комнат для зоны ${zoneId}:`, error);
            return null;
        }
    }
    
    // === МЕТОДЫ ДЛЯ РАБОТЫ С ДАННЫМИ ===
    
    getEnemyData(enemyType) {
        return this.enemiesData?.[enemyType] || null;
    }
    
    getItemData(itemId) {
        return this.itemsData?.[itemId] || null;
    }
    
    getShopData(shopId) {
        return this.shopsData?.[shopId] || null;
    }
    
    getSpellData(spellId) {
        return this.spellsData?.[spellId] || null;
    }
    
    getSkillData(skillId) {
        return this.skillsData?.[skillId] || null;
    }
    
    getAllSpells() {
        return this.spellsData ? { ...this.spellsData } : {};
    }
    
    getAllSkills() {
        return this.skillsData ? { ...this.skillsData } : {};
    }
    
    getAbilityData(abilityId) {
        return this.spellsData?.[abilityId] || this.skillsData?.[abilityId] || null;
    }
    
    isLoaded() {
        return this.loaded;
    }
    
    getStats() {
        return {
            enemies: this.enemiesData ? Object.keys(this.enemiesData).length : 0,
            items: this.itemsData ? Object.keys(this.itemsData).length : 0,
            shops: this.shopsData ? Object.keys(this.shopsData).length : 0,
            spells: this.spellsData ? Object.keys(this.spellsData).length : 0,
            skills: this.skillsData ? Object.keys(this.skillsData).length : 0,
            rooms: this.roomsData.size,
            loaded: this.loaded
        };
    }
}

export { DataService };
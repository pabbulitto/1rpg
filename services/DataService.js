// services/DataService.js
import { ItemDataRegistry } from '../data/ItemDataRegistry.js';

class DataService {
    constructor() {
        this.enemiesData = null;
        this.itemsData = null;
        this.shopsData = null;
        this.spellsData = null;
        this.skillsData = null;
        this.npcsData = null;
        this.roomsData = new Map();
        this.loaded = false;
        this.statPresets = null;
    }
    
    async loadGameData() {
        try {
            const [enemiesData, itemsData, shopsData, spellsData, skillsData, statPresets, npcsData] = await Promise.all([
                this.loadJson('./data/enemies.json'),
                this.loadJson('./data/items.json'),
                this.loadJson('./data/shops.json'),
                this.loadJson('./data/spells.json'),
                this.loadJson('./data/skills.json'),
                this.loadJson('./data/stat-presets.json'),
                this.loadJson('./data/npcs.json')
            ]);
            
            this.enemiesData = enemiesData;
            this.itemsData = itemsData;
            this.shopsData = shopsData;
            this.spellsData = spellsData;
            this.skillsData = skillsData;
            this.statPresets = statPresets;
            this.npcsData = npcsData;
            
            ItemDataRegistry.init(itemsData);
            
            window.enemiesData = enemiesData;
            window.itemsData = itemsData;
            window.shopsData = shopsData;
            window.spellsData = spellsData;
            window.skillsData = skillsData;
            window.statPresets = statPresets;
            window.npcsData = npcsData;
            
            this.loaded = true;
            console.log('DataService: данные игры загружены', {
                enemies: Object.keys(enemiesData || {}).length,
                items: Object.keys(itemsData || {}).length,
                shops: Object.keys(shopsData || {}).length,
                spells: Object.keys(spellsData || {}).length,
                skills: Object.keys(skillsData || {}).length,
                npcs: Object.keys(npcsData || {}).length
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
                if (url.includes('spells.json') || url.includes('skills.json') || url.includes('npcs.json')) {
                    console.warn(`DataService: файл ${url} не найден, используем пустые данные`);
                    return {};
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText} для ${url}`);
            }
            return response.json();
        } catch (error) {
            if (url.includes('spells.json') || url.includes('skills.json') || url.includes('npcs.json')) {
                console.warn(`DataService: не удалось загрузить ${url}, используем пустые данные:`, error.message);
                return {};
            }
            console.error(`DataService: ошибка загрузки JSON ${url}:`, error);
            throw error;
        }
    }
    
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
    
    getNPCData(npcId) {
        return this.npcsData?.[npcId] || null;
    }
    
    getAllSpells() {
        return this.spellsData ? { ...this.spellsData } : {};
    }
    
    getAllSkills() {
        return this.skillsData ? { ...this.skillsData } : {};
    }
    
    getAllNPCs() {
        return this.npcsData ? { ...this.npcsData } : {};
    }
    
    getAbilityData(abilityId) {
        return this.spellsData?.[abilityId] || this.skillsData?.[abilityId] || null;
    }
    
    isLoaded() {
        return this.loaded;
    }
    
    getProfessionData(professionId) {
        return this.statPresets?.professions?.[professionId] || null;
    }

    getAllProfessions() {
        return this.statPresets?.professions || {};
    }

    getRaceData(raceId) {
        return this.statPresets?.races?.[raceId] || null;
    }

    getAllRaces() {
        return this.statPresets?.races || {};
    }
    
    getStats() {
        return {
            enemies: this.enemiesData ? Object.keys(this.enemiesData).length : 0,
            items: this.itemsData ? Object.keys(this.itemsData).length : 0,
            shops: this.shopsData ? Object.keys(this.shopsData).length : 0,
            spells: this.spellsData ? Object.keys(this.spellsData).length : 0,
            skills: this.skillsData ? Object.keys(this.skillsData).length : 0,
            npcs: this.npcsData ? Object.keys(this.npcsData).length : 0,
            rooms: this.roomsData.size,
            loaded: this.loaded
        };
    }
}

export { DataService };
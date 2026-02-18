// services/AbilityService.js
/**
 * AbilityService - сервис управления способностями
 * Загружает данные из JSON, создает экземпляры, управляет доступными способностями
 */
import { AbilityBase } from '../core/AbilityBase.js';

class AbilityService {
    constructor(gameState = null) {
        this.gameState = gameState;
        this.abilities = new Map(); // id -> AbilityBase instance
        this.availableAbilities = new Map(); // player/enemyId -> Set(abilityId)
        this.loaded = false;
    }
    
    /**
     * Загрузить данные способностей
     * @param {Object} spellsData - данные заклинаний из spells.json
     * @param {Object} skillsData - данные умений из skills.json
     */
    loadAbilities(spellsData = {}, skillsData = {}) {
        // Загружаем заклинания
        for (const [spellId, spellData] of Object.entries(spellsData)) {
            const ability = new AbilityBase(spellId, {
                ...spellData,
                type: 'spell'
            });
            this.abilities.set(spellId, ability);
        }
        
        // Загружаем умения
        for (const [skillId, skillData] of Object.entries(skillsData)) {
            const ability = new AbilityBase(skillId, {
                ...skillData,
                type: 'skill'
            });
            this.abilities.set(skillId, ability);
        }
        
        this.loaded = true;
        console.log(`AbilityService: загружено ${this.abilities.size} способностей`);
        return true;
    }
    
    /**
     * Получить способность по ID
     * @param {string} abilityId 
     * @returns {AbilityBase|null}
     */
    getAbility(abilityId) {
        return this.abilities.get(abilityId) || null;
    }
    
    /**
     * Получить все способности определенного типа
     * @param {string} type - 'spell', 'skill' или null (все)
     * @returns {Array<AbilityBase>}
     */
    getAbilitiesByType(type = null) {
        const result = [];
        for (const ability of this.abilities.values()) {
            if (!type || ability.type === type) {
                result.push(ability);
            }
        }
        return result;
    }
    
    /**
     * Добавить способность персонажу
     * @param {string} characterId - ID персонажа
     * @param {string} abilityId - ID способности
     */
    addAbilityToCharacter(characterId, abilityId) {
        if (!this.availableAbilities.has(characterId)) {
            this.availableAbilities.set(characterId, new Set());
        }
        this.availableAbilities.get(characterId).add(abilityId);
    }
    
    /**
     * Удалить способность у персонажа
     */
    removeAbilityFromCharacter(characterId, abilityId) {
        if (this.availableAbilities.has(characterId)) {
            this.availableAbilities.get(characterId).delete(abilityId);
        }
    }
    
    /**
     * Получить доступные способности персонажа
     * @param {string} characterId 
     * @param {string} type - фильтр по типу
     * @returns {Array<AbilityBase>}
     */
    getCharacterAbilities(characterId, type = null) {
        const abilityIds = this.availableAbilities.get(characterId) || new Set();
        const result = [];
        
        for (const abilityId of abilityIds) {
            const ability = this.getAbility(abilityId);
            if (ability && (!type || ability.type === type)) {
                result.push(ability);
            }
        }
        
        return result;
    }
    
    /**
     * Получить доступные способности с проверкой требований
     * @param {CharacterBase} character - экземпляр персонажа
     * @param {string} type - фильтр по типу
     * @returns {Array<AbilityBase>}
     */
    getAvailableAbilitiesForCharacter(character, type = null) {
        const characterId = character.id;
        const allAbilities = this.getCharacterAbilities(characterId, type);
        
        return allAbilities.filter(ability => {
            const canUse = ability.canUse(character);
            return canUse.success;
        });
    }
    
    /**
     * Обновить перезарядки способностей (вызывать каждый ход)
     */
    updateCooldowns() {
        for (const ability of this.abilities.values()) {
            ability.updateCooldown();
        }
    }
    
    /**
     * Сбросить все способности (для новой игры)
     */
    reset() {
        this.availableAbilities.clear();
    }
    
    /**
     * Получить информацию о сервисе для отладки
     */
    getInfo() {
        return {
            loaded: this.loaded,
            totalAbilities: this.abilities.size,
            charactersWithAbilities: this.availableAbilities.size
        };
    }
}

export { AbilityService };
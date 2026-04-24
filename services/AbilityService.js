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
        this.availableAbilities = new Map();// player/enemyId -> Set(abilityId)
        this.characterMastery = new Map(); // characterId -> Map(abilityId -> mastery)
        this.characterMaxMastery = new Map(); 
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
    getCharacterBattleAbilities(characterId) {
        const allAbilities = this.getCharacterAbilities(characterId);
        return allAbilities.filter(ability => ability.isBattle === true);
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
     * Получить мастерство способности для персонажа
     * @param {string} characterId
     * @param {string} abilityId
     * @returns {number}
     */
    getMastery(characterId, abilityId) {
        const baseMastery = this.characterMastery.get(characterId)?.get(abilityId) || 0;
        
        // Получаем персонажа
        const character = this.findCharacterById(characterId);
        if (!character) return baseMastery;
        
        // Проверяем эффекты с модификатором мастерства
        const effectService = window.game?.effectService;
        if (!effectService) return baseMastery;
        
        const effects = effectService.getEffectsOnTarget(characterId);
        let masteryModifier = 0;
        
        for (const effect of effects) {
            const stats = effect.statsModifiers || {};
            if (stats.masteryModifier !== undefined) {
                masteryModifier += stats.masteryModifier;
            }
        }
        
        // Применяем модификатор (в процентах)
        const modifiedMastery = baseMastery * (1 + masteryModifier / 100);
        return Math.max(0, Math.min(200, modifiedMastery));
    }
    /**
     * Найти персонажа по ID
     * @param {string} characterId
     * @returns {Object|null}
     */
    findCharacterById(characterId) {
        if (window.game?.player?.id === characterId) {
            return window.game.player;
        }
        if (window.game?.zoneManager) {
            return window.game.zoneManager.getEntityById(characterId);
        }
        return null;
    }
    /**
     * Установить мастерство способности для персонажа
     * @param {string} characterId
     * @param {string} abilityId
     * @param {number} value
     */
    setMastery(characterId, abilityId, value) {
        if (!this.characterMastery.has(characterId)) {
            this.characterMastery.set(characterId, new Map());
        }
        this.characterMastery.get(characterId).set(abilityId, value);
    }

    /**
     * Добавить опыт к мастерству
     * @param {string} characterId
     * @param {string} abilityId
     * @param {number} amount
     * @returns {number} сколько реально добавлено
     */
    addMastery(characterId, abilityId, amount) {
        // ПРОВЕРКА: есть ли у персонажа это умение
        if (!this.availableAbilities.has(characterId) || 
            !this.availableAbilities.get(characterId).has(abilityId)) {
            return 0;  // нет умения - нет роста
        }
        
        const current = this.getMastery(characterId, abilityId);
        const maxMastery = this.getMaxMasteryForCharacter(characterId);
        const newValue = Math.min(maxMastery, current + amount);
        
        if (newValue > current) {
            this.setMastery(characterId, abilityId, newValue);
            return newValue - current;
        }
        return 0;
    }

    /**
     * Получить максимально возможный процент мастерства для персонажа
     * @param {string} characterId
     * @returns {number}
     */
    getMaxMasteryForCharacter(characterId) {
        // Если есть сохраненное значение - возвращаем его
        if (this.characterMaxMastery.has(characterId)) {
            return this.characterMaxMastery.get(characterId);
        }
        
        // Иначе рассчитываем (по умолчанию 80 + реинкарнации*10)
        let maxMastery = 80;
        if (this.gameState?.getPlayer()?.id === characterId) {
            const player = this.gameState.getPlayer();
            const reincarnations = player.reincarnations || 0;
            maxMastery = Math.min(200, 80 + reincarnations * 10);
        }
        
        this.characterMaxMastery.set(characterId, maxMastery);
        return maxMastery;
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
    /**
     * Получить данные для сохранения
     * @returns {Object}
     */
    getSaveData() {
        const masteryData = {};
        for (const [charId, masteryMap] of this.characterMastery.entries()) {
            masteryData[charId] = Object.fromEntries(masteryMap);
        }
        
        const maxMasteryData = Object.fromEntries(this.characterMaxMastery);
        
        return {
            mastery: masteryData,
            maxMastery: maxMasteryData,
            available: Object.fromEntries(
                Array.from(this.availableAbilities.entries()).map(([k, v]) => [k, Array.from(v)])
            )
        };
    }

    /**
     * Загрузить данные из сохранения
     * @param {Object} data
     */
    loadSaveData(data) {
        if (!data) return;
        
        // Загружаем мастерство
        if (data.mastery) {
            this.characterMastery.clear();
            for (const [charId, masteryObj] of Object.entries(data.mastery)) {
                this.characterMastery.set(charId, new Map(Object.entries(masteryObj)));
            }
        }
        
        // Загружаем максимальное мастерство
        if (data.maxMastery) {
            this.characterMaxMastery = new Map(Object.entries(data.maxMastery));
        }
        
        // Загружаем доступные способности
        if (data.available) {
            this.availableAbilities.clear();
            for (const [charId, abilityArray] of Object.entries(data.available)) {
                this.availableAbilities.set(charId, new Set(abilityArray));
            }
        }
    }
}

export { AbilityService };
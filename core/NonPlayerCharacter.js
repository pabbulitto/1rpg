// core/NonPlayerCharacter.js
import { Character } from './Character.js';
import { StatManager } from './StatManager.js';
import { EntityContainer } from './EntityContainer.js';
import { itemFactory } from './ItemFactory.js';
import { ItemDataRegistry } from '../data/ItemDataRegistry.js';

/**
 * Неигровые персонажи:
 * - Враги (сейчас)
 * - Союзники, торговцы, квестодатели (потом)
 * 
 * Имеют собственные характеристики, инвентарь, экипировку.
 * Не зависят от GameState.
 */
class NonPlayerCharacter extends Character {
    constructor(dependencies = {}) {
        super(dependencies);
        
        // Инверсия зависимостей
        this.statManager = dependencies.statManager || new StatManager();
        
        // Контейнер для инвентаря и экипировки
        this.container = new EntityContainer();
        
        // Характеристики по умолчанию
        const stats = this.statManager.getFinalStats();
        this.health = stats.health || 10;
        this.maxHealth = stats.maxHealth || 10;
        
        // Данные из конфига
        this.type = 'creature';
        this.race = null;
        this.profession = null;
        this.aiType = 'passive';
        this.canMove = false;
        this.detectionRange = 3;
        
        // Награды и лут
        this.expReward = 10;
        this.goldReward = 5;
        this.manualLoot = []; // DEPRECATED: будет удалён в Этапе 3
        this.naturalWeapon = null;
        
        // Боевые формулы
        this.attackFormula = '1d20+attackMod';
        this.damageFormula = '1d6+strengthMod';
        
        // Респавн и труп
        this.corpseDecay = 300;
        this.respawnTime = 600;
        this.zoneId = null;
        this.roomId = null;
    }
    
    /**
     * Получить характеристики из StatManager
     */
    getStats() {
        return this.statManager?.getFinalStats() || this._localStats;
    }
    
    /**
     * Получить StatManager
     */
    getStatManager() {
        return this.statManager;
    }
    
    /**
     * Установить профессию (загружает пресет)
     */
    setProfession(professionId, professionData) {
        this.profession = professionId;
        
        if (professionData?.baseStats) {
            this.statManager.applyStatPreset(professionData);
        }
        
        if (professionData?.proficiencies) {
            this.proficiencies = new Set(professionData.proficiencies);
        }
        
        if (professionData?.startingAbilities && this.abilityService) {
            professionData.startingAbilities.forEach(abilityId => {
                this.abilityService.addAbilityToCharacter(this.id, abilityId);
            });
        }
    }
    
    /**
     * Атаковать игрока
     */
    attackPlayer(playerStats) {
        if (!this.battleSystem || !playerStats) return 0;
        
        const stats = this.getStats();
        const equipment = this.container ? this.container.getAllEquipment() : {};
        const rightHand = equipment.right_hand;
        
        // ===== 1. ОПРЕДЕЛЯЕМ ФОРМУЛЫ АТАКИ =====
        let attackFormula = this.attackFormula;
        let damageFormula = this.damageFormula;
        let attackName = 'атака';
        
        // Приоритет 1: Оружие в правой руке
        if (rightHand && this._isWeapon(rightHand)) {
            attackFormula = rightHand.attackFormula || this.attackFormula;
            damageFormula = rightHand.damage || this.damageFormula;
            attackName = rightHand.name;
        }
        // Приоритет 2: Природное оружие (когти, клыки)
        else if (this.naturalWeapon) {
            attackFormula = this.naturalWeapon.attackFormula || '1d20+strengthMod';
            damageFormula = this.naturalWeapon.damageFormula || '1d6+strengthMod';
            attackName = this.naturalWeapon.name || 'природное оружие';
        }
        // Приоритет 3: Кулаки (по умолчанию)
        
        // ===== 2. КОНТЕКСТ ДЛЯ ФОРМУЛ =====
        const context = {
            strength: stats.strength || 10,
            dexterity: stats.dexterity || 10,
            constitution: stats.constitution || 10,
            intelligence: stats.intelligence || 10,
            wisdom: stats.wisdom || 10,
            charisma: stats.charisma || 10,
            strengthMod: Math.floor(((stats.strength || 10) - 10) / 2),
            dexterityMod: Math.floor(((stats.dexterity || 10) - 10) / 2),
            constitutionMod: Math.floor(((stats.constitution || 10) - 10) / 2),
            intelligenceMod: Math.floor(((stats.intelligence || 10) - 10) / 2),
            wisdomMod: Math.floor(((stats.wisdom || 10) - 10) / 2),
            charismaMod: Math.floor(((stats.charisma || 10) - 10) / 2),
            attackMod: stats.attack || 0,
            level: this.level || 1
        };
        
        // ===== 3. УПРОЩЕННЫЙ РАСЧЕТ (ЕСЛИ НЕТ DICEROLLER) =====
        if (!this.battleSystem.diceRoller) {
            const playerAC = playerStats.armorClass || 10;
            const attackRoll = Math.floor(Math.random() * 20) + 1 + (stats.attack || 0);
            
            if (attackRoll >= playerAC) {
                const damage = Math.floor(Math.random() * 6) + 1 + context.strengthMod;
                return Math.max(0, damage);
            }
            return 0;
        }
        
        // ===== 4. ПОЛНЫЙ РАСЧЕТ ЧЕРЕЗ DICEROLLER =====
        try {
            const attackResult = this.battleSystem.diceRoller.roll(attackFormula, context);
            const playerAC = playerStats.armorClass || 10;
            const naturalRoll = attackResult.rolls[0] || 0;
            const isCritical = naturalRoll === 20;
            const isFumble = naturalRoll === 1;
            
            let hits = false;
            if (isCritical) {
                hits = true;
            } else if (isFumble) {
                hits = false;
            } else {
                hits = attackResult.total >= playerAC;
            }
            
            if (!hits) return 0;
            
            const damageResult = this.battleSystem.diceRoller.roll(damageFormula, context);
            let damage = damageResult.total;
            
            if (isCritical) {
                const diceTotal = damageResult.rolls.reduce((sum, roll) => sum + roll, 0);
                const modifierTotal = damageResult.total - diceTotal;
                damage = (diceTotal * 2) + modifierTotal;
            }
            
            return Math.max(0, damage);
            
        } catch (error) {
            console.error(`NonPlayerCharacter: ошибка при атаке ${this.name}:`, error);
            return 0;
        }
    }
    /**
     * Получить урон с учётом брони
     */
    takeDamage(damage) {
        const stats = this.getStats();
        if (!stats || stats.health === undefined) {
            return { damage: 0, isDead: true, healthRemaining: 0 };
        }
        
        const damageReduction = stats.damageReduction || 0;
        const reducedDamage = Math.max(1, Math.floor(damage * (1 - damageReduction / 100)));
        
        const newHealth = Math.max(0, stats.health - reducedDamage);
        this.statManager?.setResource('health', newHealth);
        
        const isDead = newHealth <= 0;
        if (isDead) {
            this.die();
            // ===== ИСПРАВЛЕНО: эмитим событие с актуальными данными =====
            if (this.eventBus && this.roomId) {
                // Получаем актуальный список сущностей в комнате
                const game = window.game;
                if (game?.zoneManager) {
                    const entities = game.zoneManager.getRoomEntitiesInfo(this.roomId);
                    this.eventBus.emit('room:entitiesUpdated', {
                        roomId: this.roomId,
                        entities: entities
                    });
                } else {
                    // fallback если zoneManager недоступен
                    this.eventBus.emit('room:entitiesUpdated', {
                        roomId: this.roomId,
                        entities: []
                    });
                }
            }
        }
        
        return {
            damage: reducedDamage,
            isDead: isDead,
            healthRemaining: newHealth
        };
    }
    /**
     * Получить информацию для UI
     */
    getInfo() {
        const stats = this.getStats();
        const containerInfo = this.container ? this.container.getInfo() : { items: [], equipment: {} };
        
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            level: this.level,
            state: this.state,
            health: stats.health || this.health || 0,
            maxHealth: stats.maxHealth || this.maxHealth || 0,
            armorClass: stats.armorClass || 10,
            attack: stats.attack || 0,
            expReward: this.expReward,
            goldReward: this.goldReward,
            manualLoot: [...(this.manualLoot || [])],
            aiType: this.aiType,
            profession: this.profession,
            race: this.race,
            zoneId: this.zoneId,
            roomId: this.roomId,
            inventory: containerInfo.items,
            equipment: containerInfo.equipment,
            inventoryCount: containerInfo.itemCount || 0
        };
    }
    /**
     * Загрузить конфигурацию врага из JSON
     * @param {Object} config - конфиг врага из enemies.json
     * @param {number} level - уровень врага
     * @param {string} enemyType - тип врага
     * @returns {NonPlayerCharacter}
     */
    loadFromConfig(config, level = 1, enemyType = null) {
        this.name = config.name || enemyType || 'Существо';
        this.type = config.type || enemyType || 'creature';
        this.level = level;
        
        const scale = level / (config.baseLevel || 1);
        
        // Базовая статистика
        if (config.baseStats) {
            const scaledStats = {};
            Object.entries(config.baseStats).forEach(([stat, value]) => {
                if (typeof value === 'number') {
                    scaledStats[stat] = Math.floor(value * scale);
                } else {
                    scaledStats[stat] = value;
                }
            });
            
            this.statManager.baseStats = {
                ...this.statManager.baseStats,
                ...scaledStats
            };
        }
        
        // Старые поля для обратной совместимости
        if (config.baseStrength) {
            const oldStats = this._convertOldStats(config, level);
            this.statManager.baseStats = {
                ...this.statManager.baseStats,
                ...oldStats
            };
        }
        
        // Экипировка (стартовая, без шанса)
        if (config.startingEquipment && this.equipmentService) {
            Object.entries(config.startingEquipment).forEach(([slot, itemId]) => {
                const item = itemFactory.create(itemId, 1);
                if (item) {
                    this.equipItem(item, slot);
                }
            });
        }
        
        // ===== НОВАЯ ЛОГИКА ЗАПОЛНЕНИЯ ИНВЕНТАРЯ =====
        if (config.inventory) {
            // 1. Гарантированный лут
            if (config.inventory.guaranteed) {
                Object.entries(config.inventory.guaranteed).forEach(([itemId, value]) => {
                    let count = 1;
                    
                    // Если это объект с min/max (для золота и ресурсов)
                    if (typeof value === 'object' && value.min !== undefined) {
                        count = Math.floor(Math.random() * (value.max - value.min + 1)) + value.min;
                    } 
                    // Если это число (фиксированное количество)
                    else if (typeof value === 'number') {
                        count = value;
                    }
                    
                    const item = itemFactory.create(itemId, count);
                    if (item) this.addItem(item);
                });
            }
            
            // 2. Шансовый лут (обычные предметы)
            if (config.inventory.chance) {
                Object.entries(config.inventory.chance).forEach(([itemId, chance]) => {
                    if (Math.random() <= chance) {
                        const item = itemFactory.create(itemId, 1);
                        if (item) this.addItem(item);
                    }
                });
            }
            
            // 3. Лимитированные предметы (для будущего)
            if (config.inventory.limited && Array.isArray(config.inventory.limited)) {
                config.inventory.limited.forEach(limited => {
                    if (Math.random() <= limited.chance) {
                        const item = itemFactory.create(limited.itemId, 1);
                        if (item) this.addItem(item);
                    }
                });
            }
        }
        // ===== ЭКИПИРОВКА С ШАНСОМ =====
        if (config.equipmentChance) {
            Object.entries(config.equipmentChance).forEach(([slot, equipConfig]) => {
                if (Math.random() <= equipConfig.chance) {
                    const item = itemFactory.create(equipConfig.itemId, 1);
                    if (item) {
                        this.equipItem(item, slot);
                        // Применяем бонусы к статам
                        if (equipConfig.statsBonus) {
                            Object.entries(equipConfig.statsBonus).forEach(([stat, bonus]) => {
                                this.statManager.baseStats[stat] = (this.statManager.baseStats[stat] || 0) + bonus;
                            });
                        }
                    }
                }
            });
        }
        // Природное оружие
        if (config.naturalWeapon) {
            this.naturalWeapon = {
                damageFormula: config.naturalWeapon.damageFormula || '1d6+strengthMod',
                damageType: config.naturalWeapon.damageType || 'slashing',
                attackFormula: config.naturalWeapon.attackFormula || '1d20+strengthMod',
                name: config.naturalWeapon.name || 'Природное оружие'
            };
        }
        
        // Навыки
        if (config.proficiencies) {
            this.proficiencies = new Set(config.proficiencies);
        }
        
        // Способности
        if (config.abilities && this.abilityService) {
            this.abilities = [...config.abilities];
            config.abilities.forEach(abilityId => {
                this.abilityService.addAbilityToCharacter(this.id, abilityId);
            });
        }
        
        // Боевые формулы
        this.attackFormula = config.attackFormula || this.attackFormula;
        this.damageFormula = config.damageFormula || this.damageFormula;
        
        // Награды (опыт и золото теперь только для информации, золото в инвентаре)
        this.expReward = config.experienceReward || 10;
        this.goldReward = 0; // золото теперь в инвентаре
        
        // AI и поведение
        this.aiType = config.aiType || 'aggressive';
        this.faction = config.faction || null;
        
        // Труп и респавн
        this.corpseDecay = config.corpseDecay || 100;
        this.respawnTime = config.respawnTime || 160;
        
        // Текущие статы
        const finalStats = this.statManager.getFinalStats();
        this.health = finalStats.health || finalStats.maxHealth || 10;
        this.maxHealth = finalStats.maxHealth || 10;
        
        return this;
    }
    
    /**
     * Конвертация старых полей
     */
    _convertOldStats(config, level) {
        const scale = level / (config.baseLevel || 1);
        return {
            strength: Math.floor((config.baseStrength || 10) * scale),
            dexterity: Math.floor((config.baseDexterity || 10) * scale),
            constitution: Math.floor((config.baseConstitution || 10) * scale),
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
            health: Math.floor((config.baseHealth || 10) * scale),
            maxHealth: Math.floor((config.baseHealth || 10) * scale),
            armorClass: config.baseArmorClass || 10,
            attack: config.baseAttackMod || 0
        };
    }
    
    /**
     * Добавить предмет в инвентарь
     */
    addItem(item) {
        return this.container ? this.container.addItem(item) : false;
    }
    
    /**
     * Удалить предмет из инвентаря
     */
    removeItem(index) {
        return this.container ? this.container.removeItem(index) : null;
    }
    
    /**
     * Получить инвентарь
     */
    getInventoryItems() {
        return this.container ? this.container.getAllItems() : [];
    }
    /**
     * Забрать все предметы из трупа (доступно только в состоянии corpse)
     * @returns {Object} объект с предметами и экипировкой
     */
    lootAll() {
        if (this.state !== 'corpse') {
            console.warn('NonPlayerCharacter: попытка лутать живого персонажа');
            return { items: [], equipment: {} };
        }
        
        const items = this.container.getAllItems();
        const equipment = this.container.getAllEquipment();
        
        this.container.clear();
        
        // Оповещаем UI об изменении
        if (window.game?.gameState?.eventBus) {
            window.game.gameState.eventBus.emit('inventory:updated', this.container.getInfo());
        }
        
        return { items, equipment };
    }
    /**
     * Забрать конкретный предмет из инвентаря трупа
     * @param {number} index - индекс предмета
     * @returns {Item|null} предмет или null
     */
    lootItem(index) {
        if (this.state !== 'corpse') {
            console.warn('NonPlayerCharacter: попытка лутать живого персонажа');
            return null;
        }
        
        const item = this.container.removeItem(index);
        
        if (item && window.game?.gameState?.eventBus) {
            window.game.gameState.eventBus.emit('inventory:updated', this.container.getInfo());
        }
        
        return item;
    }
    /**
     * Снять предмет экипировки с трупа
     * @param {string} slot - слот экипировки
     * @returns {Item|null} предмет или null
     */
    lootEquipment(slot) {
        if (this.state !== 'corpse') {
            console.warn('NonPlayerCharacter: попытка лутать живого персонажа');
            return null;
        }
        
        const item = this.container.unequip(slot);
        
        if (item && window.game?.gameState?.eventBus) {
            window.game.gameState.eventBus.emit('inventory:updated', this.container.getInfo());
            window.game.gameState.eventBus.emit('player:equipmentChanged', { slot, item: null });
        }
        
        return item;
    }
    /**
     * Поднять труп как предмет (превратить в предмет "Труп")
     * @param {GameState} gameState - состояние игры
     * @returns {Item|null} предмет-труп или null
     */
    pickupCorpse(gameState) {
        if (this.state !== 'corpse') {
            console.warn('NonPlayerCharacter: попытка поднять живого персонажа');
            return null;
        }
        
        // Создаем предмет-труп через фабрику
        const corpseItem = window.itemFactory?.create('corpse', 1, {
            originalCreature: this.getInfo(),
            lootContainer: this.container.toJSON(),
            weight: 5 + this.container.getTotalWeight(),
            name: `Труп ${this.name}`
        });
        
        if (!corpseItem) {
            console.error('NonPlayerCharacter: не удалось создать предмет-труп');
            return null;
        }
        
        // Удаляем труп из комнаты (будет вызвано извне)
        // this.remove() — не вызываем здесь, пусть вызывает ZoneManager
        
        return corpseItem;
    }
}

export { NonPlayerCharacter };
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
 * Не зависят от GameState.а
 */
class NonPlayerCharacter extends Character {
    constructor(dependencies = {}) {
        super(dependencies);
        
        // Инверсия зависимостей
        this.statManager = dependencies.statManager || new StatManager();
        
        // Контейнер для инвентаря и экипировки
        this.container = new EntityContainer();
        this.container.owner = this
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
        this.naturalWeapon = null;
        
        // Боевые формулы
        this.attackFormula = '1d20';
        this.damageFormula = '1d6';
        
        // Респавн и труп
        this.corpseDecay = 300;
        this.respawnTime = 600;
        this.zoneId = null;
        this.roomId = null;
        // Данные для NPC (если это мирный NPC, а не враг)
        this.npcType = null;              // 'npc' для мирных, null для врагов
        this.services = {};               // объект с конфигурациями услуг
        this.dialogueTree = null;         // ID диалога из dialogues.json
        this.greetings = null;  // массив строк с приветствиями
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
        const hitroll = stats.hitroll || 0;
        const damroll = stats.damroll || 0;
        const equipment = this.container ? this.container.getAllEquipment() : {};
        const rightHand = equipment.right_hand;
        
        // ===== 1. ОПРЕДЕЛЯЕМ ФОРМУЛУ УРОНА =====
        let damageFormula = this.damageFormula;
        let attackName = 'атака';

        // Приоритет 1: Оружие в правой руке
        if (rightHand && this._isWeapon(rightHand)) {
            damageFormula = rightHand.damage || this.damageFormula;
            attackName = rightHand.name;
        }
        // Приоритет 2: Природное оружие (когти, клыки)
        else if (this.naturalWeapon) {
            damageFormula = this.naturalWeapon.damageFormula || '1d6';
            attackName = this.naturalWeapon.name || 'природное оружие';
        }
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
            level: this.level || 1
        };
        
        // ===== 3. УПРОЩЕННЫЙ РАСЧЕТ (ЕСЛИ НЕТ DICEROLLER) =====
        if (!this.battleSystem.diceRoller) {
            const playerAC = playerStats.armorClass || 10;
            const attackRoll = Math.floor(Math.random() * 20) + 1 + (stats.attack || 0);
            
            if (attackRoll >= playerAC) {
                const damage = Math.floor(Math.random() * 6) + 1;
                return {
                    damage: Math.max(0, damage),
                    isCritical: false
                };
            }
            return 0;
        }
        
        // ===== 4. ПОЛНЫЙ РАСЧЕТ ЧЕРЕЗ DICEROLLER =====
        try {
            // Рассчитываем totalHitroll с учётом уровня
            const baseHitroll = stats.hitroll || 0;
            const levelHitroll = Math.floor((this.level - 1) * (this.hitrollPerLevel || 0));
            const totalHitroll = baseHitroll + levelHitroll;
            
            const attackFormula = `1d20+${totalHitroll}`;
            const attackResult = this.battleSystem.diceRoller.roll(attackFormula, context);
            const playerAC = playerStats.armorClass ?? 0;
            const naturalRoll = attackResult.rolls[0] || 0;
            // Шанс крита для врагов: базово 20 (5%), при удаче 9+ порог 19 (10%)
            const luckBonus = stats.luckBonus || 0;
            let critThreshold = 20;
            if (luckBonus >= 9) {
                critThreshold = 19;
            }

            const isCritical = naturalRoll >= critThreshold;
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
            damage += damroll;
            // Добавляем бонус урона от уровня (до критического удара)
            const levelDamageBonus = Math.floor((this.level - 1) * (this.damageModPerLevel || 0));

            if (isCritical) {
                const diceTotal = damageResult.rolls.reduce((sum, roll) => sum + roll, 0);
                const modifierTotal = damageResult.total - diceTotal;
                damage = (diceTotal * 2) + modifierTotal + levelDamageBonus + damroll;
            } else {
                damage += levelDamageBonus;
            }
            return {
                damage: Math.max(0, damage),
                isCritical: isCritical
            };
            
        } catch (error) {
            console.error(`NonPlayerCharacter: ошибка при атаке ${this.name}:`, error);
            return 0;
        }
    }
    /**
     * Получить урон
     * @param {number} damage - количество урона
     * @param {Object} options - опции { isCritical: boolean }
     * @returns {Object} результат получения урона
     */
    takeDamage(damage, options = {}) {
        // Вызываем родительский метод с опциями
        const result = super.takeDamage(damage, options);
        
        if (result.isDead) {
            this.die();
            
            // Эмитим событие обновления комнаты
            if (this.eventBus && this.roomId) {
                const game = window.game;
                if (game?.zoneManager) {
                    const entities = game.zoneManager.getRoomEntitiesInfo(this.roomId);
                    this.eventBus.emit('room:entitiesUpdated', {
                        roomId: this.roomId,
                        entities: entities
                    });
                } else {
                    this.eventBus.emit('room:entitiesUpdated', {
                        roomId: this.roomId,
                        entities: []
                    });
                }
            }
        }
        
        return result;
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
            health: stats.health || 0,
            maxHealth: stats.maxHealth || 0,
            armorClass: stats.armorClass || 10,
            attack: stats.attack || 0,
            expReward: this.expReward,
            goldReward: this.goldReward,
            aiType: this.aiType,
            profession: this.profession,
            race: this.race,
            zoneId: this.zoneId,
            roomId: this.roomId,
            inventory: containerInfo.items,
            equipment: containerInfo.equipment,
            inventoryCount: containerInfo.itemCount || 0,
            npcType: this.npcType,
            services: this.services,
            dialogueTree: this.dialogueTree,
            greetings: this.greetings,
            isNPC: this.isNPC()
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
        // Загружаем спрайт и координаты для GraphicsEngine
        this.sprite = config.sprite || null;
        this.gridX = config.gridX || 0;
        this.gridY = config.gridY || 0;
        this.width = config.width || 85;
        this.height = config.height || 85;
        
    // Загружаем базовые статы как есть (без умножения)
    if (config.baseStats) {
        this.statManager.baseStats = {
            ...this.statManager.baseStats,
            ...config.baseStats
        };
            // Добавляем прирост за уровень
            const levelBonus = level - (config.baseLevel || 1);
            if (levelBonus > 0) {
                this.statManager.baseStats.baseHealth += levelBonus * (config.healthPerLevel || 0);
                this.statManager.baseStats.baseMana += levelBonus * (config.manaPerLevel || 0);
                this.statManager.baseStats.baseStamina += levelBonus * (config.staminaPerLevel || 0);
                this.statManager.baseStats.attack += levelBonus * (config.attackPerLevel || 0);
                this.statManager.baseStats.armor += levelBonus * (config.armorPerLevel || 0);
                
                // Сохраняем damageMod для использования в атаке
                this.damageModPerLevel = config.damageModPerLevel || 0;
                this.hitrollPerLevel = config.hitrollPerLevel || 0;
            }
            if (config.experienceReward) {
                this.expReward = Math.floor(config.experienceReward * Math.pow(1.13, level - 1));
            }
            
            this.statManager.needsRecalculation = true;
            const finalStats = this.statManager.getFinalStats();

            // Устанавливаем текущие ресурсы в максимум
            this.statManager.setResource('health', finalStats.maxHealth);
            this.statManager.setResource('mana', finalStats.maxMana);
            this.statManager.setResource('stamina', finalStats.maxStamina);
        }
        // ===== НОВАЯ ЛОГИКА ЗАПОЛНЕНИЯ ИНВЕНТАРЯ =====
        if (config.inventory) {
            // 1. Гарантированный лут
            if (config.inventory.guaranteed) {
                // Получаем удачу игрока для бонуса к золоту
                const player = window.game?.player;
                const playerStats = player?.getStats() || {};
                const luckBonus = Math.min(playerStats.luckBonus || 0, 10);
                const luckMultiplier = 1 + (luckBonus * 0.02); // +2% за очко удачи
                
                Object.entries(config.inventory.guaranteed).forEach(([itemId, value]) => {
                    let count = 1;
                    
                    // Если это объект с min/max (для золота и ресурсов)
                    if (typeof value === 'object' && value.min !== undefined) {
                        const baseMin = value.min;
                        const baseMax = value.max;
                        // Применяем множитель удачи
                        const luckyMin = Math.floor(baseMin * luckMultiplier);
                        const luckyMax = Math.floor(baseMax * luckMultiplier);
                        count = Math.floor(Math.random() * (luckyMax - luckyMin + 1)) + luckyMin;
                    } 
                    // Если это число (фиксированное количество)
                    else if (typeof value === 'number') {
                        count = Math.floor(value * luckMultiplier);
                    }
                    
                    const item = itemFactory.create(itemId, count);
                    if (item) this.addItem(item);
                });
            }
            
            // 2. Шансовый лут (обычные предметы)
            if (config.inventory.chance) {
                // Получаем удачу игрока (того, кто убил врага)
                // Удача врага не влияет на лут, влияет удача игрока
                const player = window.game?.player;
                const playerStats = player?.getStats() || {};
                const luckBonus = Math.min(playerStats.luckBonus || 0, 10); // макс +20% при удаче 10
                const luckMultiplier = 1 + (luckBonus * 0.02); // +2% за очко удачи
                
                Object.entries(config.inventory.chance).forEach(([itemId, chance]) => {
                    const finalChance = Math.min(chance * luckMultiplier, 1.0); // не больше 100%
                    if (Math.random() <= finalChance) {
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
        // ===== СТАРТОВЫЕ ЭФФЕКТЫ =====
        if (config.startingEffects && config.startingEffects.length > 0 && window.game?.effectService) {
            config.startingEffects.forEach(effectId => {
                window.game.effectService.applyEffect(
                    this,
                    effectId,
                    'innate',
                    { durationOverride: 0 }
                );
            });
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
                            const modifierId = `equipment_${slot}_${Date.now()}`;
                            this.statManager.addModifier(modifierId, equipConfig.statsBonus);
                            this.statManager.needsRecalculation = true;
                        }
                    }
                }
            });
        }
        // Природное оружие
        if (config.naturalWeapon) {
            this.naturalWeapon = {
                damageFormula: config.naturalWeapon.damageFormula || '1d6',
                damageType: config.naturalWeapon.damageType || 'slashing',
                attackFormula: config.naturalWeapon.attackFormula || '1d20',
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
        // Приветствия для всплывающих облачков
        this.greetings = config.greetings || null;
        
        // Награды (опыт и золото теперь только для информации, золото в инвентаре)
        this.goldReward = 0; // золото теперь в инвентаре
        
        // AI и поведение
        this.aiType = config.aiType || 'aggressive';
        this.faction = config.faction || null;
        
        // Труп и респавн
        this.corpseDecay = config.corpseDecay || 100;
        this.respawnTime = config.respawnTime || 160;
        
        // Текущие статы
        const finalStats = this.statManager.getFinalStats();
        
        return this;
    }
    /**
     * Загрузить конфигурацию мирного NPC
     * @param {Object} config - конфиг NPC из npcs.json
     * @returns {NonPlayerCharacter}
     */
    loadNPCFromConfig(config) {
        this.name = config.name || 'NPC';
        this.type = config.type || 'humanoid';
        this.npcType = 'npc';
        this.sprite = config.sprite || null;
        this.gridX = config.gridX || 0;
        this.gridY = config.gridY || 0;
        this.width = config.width || 85;
        this.height = config.height || 85;
        this.aiType = config.aiType || 'passive';
        this.faction = config.faction || 'neutral';
        this.services = config.services || {};
        this.dialogueTree = config.dialogueTree || null;
        this.greetings = config.greetings || null;
        
        // Для NPC не нужны боевые статы, но StatManager требует инициализации
        const finalStats = this.statManager.getFinalStats();
        this.statManager.setResource('health', finalStats.maxHealth || 20);
        this.statManager.setResource('mana', finalStats.maxMana || 20);
        this.statManager.setResource('stamina', finalStats.maxStamina || 25);
        
        return this;
    }
    /**
     * Проверить, есть ли у NPC указанная услуга
     * @param {string} serviceName - имя услуги
     * @returns {boolean}
     */
    hasService(serviceName) {
        return this.services && !!this.services[serviceName];
    }

    /**
     * Получить конфигурацию услуги
     * @param {string} serviceName - имя услуги
     * @returns {Object|null}
     */
    getServiceConfig(serviceName) {
        return this.services?.[serviceName] || null;
    }

    /**
     * Проверить, является ли персонаж мирным NPC
     * @returns {boolean}
     */
    isNPC() {
        return this.npcType === 'npc';
    }
    /**
     * Добавить предмет в инвентарь
     */
    addItem(item) {
        return this.container ? this.container.addItem(item) : false;
    }
    /**
     * Удалить предмет из инвентаря по instanceId
     * @param {string} instanceId - уникальный ID экземпляра предмета
     * @returns {Item|null} удаленный предмет
     */
    removeItem(instanceId) {
        if (!instanceId) return null;
        
        // Находим индекс предмета по instanceId
        const items = this.container.getAllItems();
        let foundIndex = -1;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i] && items[i].instanceId === instanceId) {
                foundIndex = i;
                break;
            }
        }
        
        if (foundIndex === -1) return null;
        
        // Используем существующий метод контейнера
        return this.container ? this.container.removeItem(foundIndex) : null;
    }
    
    // Получить инвентарь
    
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
        
        // Получаем предметы из контейнера
        const items = this.container.getAllItems();
        const equipment = this.container.getAllEquipment();
        
        // Очищаем труп
        this.container.clear();
        // Дерегистрируем предметы в глобальном реестре
        if (window.itemRegistry) {
            // Для предметов из инвентаря
            items.forEach(item => {
                if (item && item.instanceId) {
                    window.itemRegistry.unregisterItem(item.instanceId);
                }
            });
            
            // Для предметов из экипировки
            Object.values(equipment).forEach(item => {
                if (item && item.instanceId) {
                    window.itemRegistry.unregisterItem(item.instanceId);
                }
            });
        }
        // Оповещаем UI об изменении
        if (window.game?.gameState?.eventBus && this.roomId) {
            const entities = window.game.zoneManager.getRoomEntitiesInfo(this.roomId);
            window.game.gameState.eventBus.emit('room:entitiesUpdated', {
                roomId: this.roomId,
                entities: entities
            });
        }
        
        return { items, equipment };
    }
    /**
     * Забрать конкретный предмет из инвентаря трупа по instanceId
     * @param {string} instanceId - уникальный ID экземпляра предмета
     * @returns {Item|null} предмет или null
     */
    lootItem(instanceId) {
        if (this.state !== 'corpse') {
            console.warn('NonPlayerCharacter: попытка лутать живого персонажа');
            return null;
        }
        
        // Находим предмет по instanceId
        const items = this.container.getAllItems();
        let foundIndex = -1;
        let foundItem = null;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i] && items[i].instanceId === instanceId) {
                foundIndex = i;
                foundItem = items[i];
                break;
            }
        }
        
        if (foundIndex === -1 || !foundItem) return null;
        
        const item = this.container.removeItem(foundIndex);
        
        if (item && window.game?.gameState?.eventBus) {
            // Дерегистрируем предмет в глобальном реестре
            if (window.itemRegistry && item.instanceId) {
                window.itemRegistry.unregisterItem(item.instanceId);
            }
            
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
            // Дерегистрируем предмет в глобальном реестре
            if (window.itemRegistry && item.instanceId) {
                window.itemRegistry.unregisterItem(item.instanceId);
            }
            
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
    
        return corpseItem;
    }
}

export { NonPlayerCharacter };
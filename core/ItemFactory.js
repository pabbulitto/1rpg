// core/ItemFactory.js
import { ItemData } from './ItemData.js';
import { itemRegistry } from './ItemRegistry.js';
import { ItemDataRegistry } from '../data/ItemDataRegistry.js';
import { Lifetime } from './Lifetime.js';

/**
 * Фабрика для создания предметов.
 * 
 * Отвечает за:
 * - Создание новых экземпляров ItemData
 * - Проверку лимитов перед созданием
 * - Регистрацию в ItemRegistry
 * - Установку срока жизни (Lifetime)
 * - Восстановление предметов из сохранений
 */
class ItemFactory {
    constructor() {
        this.registry = itemRegistry;
    }

    /**
     * Создать новый предмет
     * @param {string} itemId - ID предмета из items.json
     * @param {number} count - количество
     * @param {Object} options - дополнительные параметры
     * @param {string} options.instanceId - принудительный ID (для загрузки)
     * @param {number} options.durability - начальная прочность
     * @param {Array} options.sockets - камни в слотах
     * @param {boolean} options.skipRegistration - не регистрировать в реестре
     * @returns {ItemData|null} - созданный предмет или null
     */
    create(itemId, count = 1, options = {}) {
        // 1. Проверяем существование шаблона
        const template = ItemDataRegistry.get(itemId);
        if (!template && itemId !== 'corpse') { // corpse пока оставляем для совместимости
            console.warn(`ItemFactory: шаблон для ${itemId} не найден`);
            return null;
        }

        // 2. Для лимитированных предметов проверяем возможность создания
        const isLimited = template?.globalLimit > 0 || false;
        if (isLimited && !options.skipRegistration) {
            if (!this.registry.canSpawn(itemId)) {
                console.warn(`ItemFactory: невозможно создать ${itemId}, превышен лимит`);
                return null;
            }
        }

        // 3. Создаем экземпляр ItemData
        const item = new ItemData(itemId, count, {
            instanceId: options.instanceId,
            durability: options.durability,
            sockets: options.sockets
        });

        // 4. Для corpse добавляем специальные поля (временный костыль)
        if (itemId === 'corpse') {
            item.isCorpse = true;
            item.originalCreature = options.originalCreature || null;
            item.lootContainer = options.lootContainer || [];
            item.skinningProducts = options.skinningProducts || [];
            item.decayTime = options.decayTime || 300;
            item.weight = options.weight || 5;
        }

        // 5. Устанавливаем срок жизни, если есть
        if (item.lifetimeDays && item.lifetimeDays > 0) {
            item.lifetime = new Lifetime(
                item.lifetimeDays * 24 * 60, // конвертируем дни в тики (примерно)
                () => this._onItemExpire(item),
                { startPaused: true } // предметы в инвентаре не стареют
            );
        }

        // 6. Регистрируем в реестре (если нужно)
        if (!options.skipRegistration) {
            const registered = this.registry.registerItem(item);
            if (!registered) {
                console.warn(`ItemFactory: не удалось зарегистрировать ${itemId}`);
                return null;
            }
        }

        return item;
    }

    /**
     * Создать предмет из данных сохранения
     * @param {Object} savedData - данные из JSON
     * @returns {ItemData|null}
     */
    createFromSave(savedData) {
        if (!savedData || !savedData.id) return null;

        return this.create(savedData.id, savedData.count || 1, {
            instanceId: savedData.instanceId,
            durability: savedData.durability,
            sockets: savedData.sockets,
            skipRegistration: false, // при загрузке регистрируем заново
            // Для corpse
            originalCreature: savedData.originalCreature,
            lootContainer: savedData.lootContainer,
            skinningProducts: savedData.skinningProducts,
            decayTime: savedData.decayTime,
            weight: savedData.weight
        });
    }

    /**
     * Создать копию предмета
     * @param {ItemData} original - оригинальный предмет
     * @param {Object} options - опции клонирования
     * @returns {ItemData|null}
     */
    clone(original, options = {}) {
        if (!original) return null;

        return this.create(original.id, original.count, {
            instanceId: options.instanceId || `${original.instanceId}_clone`,
            durability: original.durability,
            sockets: original.sockets ? [...original.sockets] : [],
            skipRegistration: options.skipRegistration || false,
            // Копируем corpse-поля, если есть
            originalCreature: original.originalCreature,
            lootContainer: original.lootContainer,
            skinningProducts: original.skinningProducts,
            decayTime: original.decayTime,
            weight: original.weight
        });
    }

    /**
     * Разделить стак
     * @param {ItemData} item - исходный предмет
     * @param {number} amount - количество в новом стаке
     * @returns {ItemData|null} - новый предмет или null
     */
    splitStack(item, amount) {
        if (!item || !item.stackable || amount >= item.count) return null;
        if (item.isLimited) return null; // лимитированные нельзя делить

        // Создаем новый предмет с тем же ID
        const newItem = this.create(item.id, amount, {
            durability: item.durability,
            sockets: item.sockets ? [...item.sockets] : [],
            skipRegistration: false
        });

        if (newItem) {
            // Уменьшаем исходный стак
            item.count -= amount;
        }

        return newItem;
    }

    /**
     * Callback при истечении срока жизни
     * @private
     */
    _onItemExpire(item) {
        if (!item || !item.instanceId) return;

        // Уведомляем через eventBus (будет добавлен позже)
        if (window.game?.eventBus) {
            window.game.eventBus.emit('item:expired', {
                instanceId: item.instanceId,
                itemId: item.id
            });
        }

        // Удаляем из реестра
        this.registry.unregisterItem(item.instanceId);
    }

    /**
     * Обновить состояние предметов (вызывается каждый тик)
     * @param {number} currentTick - текущий тик
     */
    updateItems(currentTick) {
        // В будущем: обновление Lifetime для предметов в мире
        // Предметы в инвентаре не обновляются (lifetime на паузе)
    }
}

// Создаём и экспортируем единственный экземпляр
export const itemFactory = new ItemFactory();
// core/EventTypes.js

/**
 * EventTypes - единый реестр всех событий в игре
 * 
 * Формат: КАТЕГОРИЯ:СОБЫТИЕ
 * Категории: player, battle, combat, inventory, item, corpse, 
 *            zone, time, ui, quest, skill, effect, system
 * 
 * Использование:
 *   import { EventTypes } from './EventTypes.js';
 *   eventBus.emit(EventTypes.PLAYER_STATS_CHANGED, data);
 */
export const EventTypes = {
    // ========== ИГРОК ==========
    /** Игрок изменил характеристики (здоровье, мана, статы) */
    PLAYER_STATS_CHANGED: 'player:statsChanged',
    /** Игрок получил урон */
    PLAYER_DAMAGED: 'player:damaged',
    /** Игрок исцелился */
    PLAYER_HEALED: 'player:healed',
    /** Игрок получил опыт */
    PLAYER_EXP_GAINED: 'player:expGained',
    /** Игрок повысил уровень */
    PLAYER_LEVEL_UP: 'player:levelUp',
    /** Игрок умер */
    PLAYER_DIED: 'player:died',
    /** Игрок изменил экипировку */
    PLAYER_EQUIPMENT_CHANGED: 'player:equipmentChanged',
    /** Игрок изменил золото */
    PLAYER_GOLD_CHANGED: 'player:goldChanged',
    /** Игрок переместился */
    PLAYER_POSITION_CHANGED: 'player:positionChanged',
    
    // ========== БОЙ ==========
    /** Бой начался */
    BATTLE_START: 'battle:start',
    /** Бой закончился (победа/поражение) */
    BATTLE_END: 'battle:end',
    /** Победа в бою */
    BATTLE_VICTORY: 'battle:victory',
    /** Поражение в бою */
    BATTLE_DEFEAT: 'battle:defeat',
    /** Обновление состояния боя */
    BATTLE_UPDATE: 'battle:update',
    
    // ========== КОМБАТ ==========
    /** Игрок совершил действие в бою */
    COMBAT_PLAYER_ACTION: 'combat:playerAction',
    /** Автоатака при AFK */
    COMBAT_AFK_AUTO_ATTACK: 'combat:afkAutoAttack',
    /** Начало раунда */
    COMBAT_ROUND_START: 'combat:roundStart',
    
    // ========== ИНВЕНТАРЬ ==========
    /** Инвентарь обновлён */
    INVENTORY_UPDATED: 'inventory:updated',
    /** Предмет добавлен в инвентарь */
    INVENTORY_ITEM_ADDED: 'inventory:itemAdded',
    /** Предмет удалён из инвентаря */
    INVENTORY_ITEM_REMOVED: 'inventory:itemRemoved',
    /** Предмет использован */
    INVENTORY_ITEM_USED: 'inventory:itemUsed',
    
    // ========== ПРЕДМЕТЫ ==========
    /** Предмет истёк (срок жизни) */
    ITEM_EXPIRED: 'item:expired',
    /** Предмет сломался */
    ITEM_BROKEN: 'item:broken',
    /** Предмет починен */
    ITEM_REPAIRED: 'item:repaired',
    
    // ========== ТРУПЫ ==========
    /** Труп создан */
    CORPSE_CREATED: 'corpse:created',
    /** Труп исчез (распад) */
    CORPSE_DECAYED: 'corpse:decayed',
    /** Труп поднят */
    CORPSE_PICKED_UP: 'corpse:pickedUp',
    /** Труп освежеван */
    CORPSE_SKINNED: 'corpse:skinned',
    /** Все вещи забраны из трупа */
    CORPSE_LOOTED: 'corpse:looted',
    
    // ========== ЗОНЫ И КОМНАТЫ ==========
    /** Комната обновлена */
    ROOM_UPDATED: 'room:updated',
    /** Враги в комнате обновлены */
    ROOM_ENEMIES_UPDATED: 'room:enemiesUpdated',
    /** Трупы в комнате обновлены */
    ROOM_CORPSES_UPDATED: 'room:corpsesUpdated',
    /** Предметы на земле обновлены */
    ROOM_ITEMS_UPDATED: 'room:itemsUpdated',
    
    // ========== МИНИКАРТА ==========
    /** Миникарта обновлена */
    MINIMAP_UPDATE: 'minimap:update',
    /** Принудительное обновление миникарты */
    MINIMAP_REFRESH: 'minimap:refresh',
    
    // ========== ВРЕМЯ ==========
    /** Игровой тик */
    TIME_TICK: 'time:tick',
    /** Смена часа */
    TIME_HOUR_CHANGE: 'time:hourChange',
    /** Смена сезона */
    TIME_SEASON_CHANGE: 'time:seasonChange',
    
    // ========== UI ==========
    /** Добавить запись в лог */
    LOG_ADD: 'log:add',
    /** Добавить несколько записей в лог */
    LOG_BATCH: 'log:batch',
    /** Открыть магазин */
    SHOP_OPEN: 'shop:open',
    /** Закрыть магазин */
    SHOP_CLOSE: 'shop:close',
    /** Показать экран исследования */
    EXPLORATION_SHOW: 'exploration:show',
    /** Показать экран победы */
    VICTORY_SHOW: 'victory:show',
    
    // ========== ПОЯС ==========
    /** Предмет добавлен в пояс */
    BELT_ITEM_ADDED: 'belt:itemAdded',
    /** Предмет удалён из пояса */
    BELT_ITEM_REMOVED: 'belt:itemRemoved',
    /** Предмет использован с пояса */
    BELT_ITEM_USED: 'belt:itemUsed',
    /** Предмет в поясе обновлён (количество) */
    BELT_ITEM_UPDATED: 'belt:itemUpdated',
    /** Количество слотов пояса обновлено */
    BELT_SLOTS_UPDATED: 'belt:slotsUpdated',
    /** Пояс загружен из сохранения */
    BELT_LOADED: 'belt:loaded',
    
    // ========== ЭФФЕКТЫ ==========
    /** Эффект применён */
    EFFECT_APPLIED: 'effect:applied',
    /** Эффект снят */
    EFFECT_REMOVED: 'effect:removed',
    /** Эффект обновлён (тик, стаки) */
    EFFECT_UPDATED: 'effect:updated',
    
    // ========== СИСТЕМНЫЕ ==========
    /** Игра сохранена */
    SYSTEM_SAVED: 'system:saved',
    /** Игра загружена */
    SYSTEM_LOADED: 'system:loaded',
    /** Ошибка */
    SYSTEM_ERROR: 'system:error'
};

/**
 * Вспомогательный объект для обратной совместимости
 * Позволяет использовать EventTypes.PLAYER_STATS_CHANGED и 'player:statsChanged' параллельно
 */
export const LegacyEvents = {
    'player:statsChanged': EventTypes.PLAYER_STATS_CHANGED,
    'player:damaged': EventTypes.PLAYER_DAMAGED,
    'player:healed': EventTypes.PLAYER_HEALED,
    'player:expGained': EventTypes.PLAYER_EXP_GAINED,
    'player:levelUp': EventTypes.PLAYER_LEVEL_UP,
    'player:died': EventTypes.PLAYER_DIED,
    'player:equipmentChanged': EventTypes.PLAYER_EQUIPMENT_CHANGED,
    'player:goldChanged': EventTypes.PLAYER_GOLD_CHANGED,
    'player:positionChanged': EventTypes.PLAYER_POSITION_CHANGED,
    'battle:start': EventTypes.BATTLE_START,
    'battle:end': EventTypes.BATTLE_END,
    'battle:victory': EventTypes.BATTLE_VICTORY,
    'battle:defeat': EventTypes.BATTLE_DEFEAT,
    'battle:update': EventTypes.BATTLE_UPDATE,
    'combat:playerAction': EventTypes.COMBAT_PLAYER_ACTION,
    'combat:afkAutoAttack': EventTypes.COMBAT_AFK_AUTO_ATTACK,
    'combat:roundStart': EventTypes.COMBAT_ROUND_START,
    'inventory:updated': EventTypes.INVENTORY_UPDATED,
    'inventory:itemAdded': EventTypes.INVENTORY_ITEM_ADDED,
    'inventory:itemRemoved': EventTypes.INVENTORY_ITEM_REMOVED,
    'inventory:itemUsed': EventTypes.INVENTORY_ITEM_USED,
    'item:expired': EventTypes.ITEM_EXPIRED,
    'item:broken': EventTypes.ITEM_BROKEN,
    'item:repaired': EventTypes.ITEM_REPAIRED,
    'corpse:created': EventTypes.CORPSE_CREATED,
    'corpse:decayed': EventTypes.CORPSE_DECAYED,
    'corpse:pickedUp': EventTypes.CORPSE_PICKED_UP,
    'corpse:skinned': EventTypes.CORPSE_SKINNED,
    'corpse:looted': EventTypes.CORPSE_LOOTED,
    'room:updated': EventTypes.ROOM_UPDATED,
    'room:enemiesUpdated': EventTypes.ROOM_ENEMIES_UPDATED,
    'room:corpsesUpdated': EventTypes.ROOM_CORPSES_UPDATED,
    'room:itemsUpdated': EventTypes.ROOM_ITEMS_UPDATED,
    'minimap:update': EventTypes.MINIMAP_UPDATE,
    'minimap:refresh': EventTypes.MINIMAP_REFRESH,
    'time:tick': EventTypes.TIME_TICK,
    'time:hourChange': EventTypes.TIME_HOUR_CHANGE,
    'time:seasonChange': EventTypes.TIME_SEASON_CHANGE,
    'log:add': EventTypes.LOG_ADD,
    'log:batch': EventTypes.LOG_BATCH,
    'shop:open': EventTypes.SHOP_OPEN,
    'shop:close': EventTypes.SHOP_CLOSE,
    'exploration:show': EventTypes.EXPLORATION_SHOW,
    'victory:show': EventTypes.VICTORY_SHOW,
    'belt:itemAdded': EventTypes.BELT_ITEM_ADDED,
    'belt:itemRemoved': EventTypes.BELT_ITEM_REMOVED,
    'belt:itemUsed': EventTypes.BELT_ITEM_USED,
    'belt:itemUpdated': EventTypes.BELT_ITEM_UPDATED,
    'belt:slotsUpdated': EventTypes.BELT_SLOTS_UPDATED,
    'belt:loaded': EventTypes.BELT_LOADED,
    'effect:applied': EventTypes.EFFECT_APPLIED,
    'effect:removed': EventTypes.EFFECT_REMOVED,
    'effect:updated': EventTypes.EFFECT_UPDATED,
    'system:saved': EventTypes.SYSTEM_SAVED,
    'system:loaded': EventTypes.SYSTEM_LOADED,
    'system:error': EventTypes.SYSTEM_ERROR
};

export default EventTypes;
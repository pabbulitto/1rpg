// core/Item.js
/**
 * Фасад для системы предметов.
 * 
 * Этот файл:
 * - Сохраняет публичный API для обратной совместимости
 * - Реэкспортирует классы и сервисы
 * - Не содержит новой логики
 * 
 * После полной миграции может быть удалён,
 * а импорты перенаправлены напрямую в нужные модули.
 */

// Реэкспортируем класс данных
import { ItemData } from './ItemData.js';
export { ItemData as Item };

// Реэкспортируем сервисы
import { itemRegistry } from './ItemRegistry.js';
import { itemFactory } from './ItemFactory.js';
export { itemRegistry, itemFactory };

// Для глобального доступа (временный костыль, пока не перепишем все модули)
if (typeof window !== 'undefined') {
    window.Item = ItemData;
    window.itemRegistry = itemRegistry;
    window.itemFactory = itemFactory;
}

// Для совместимости с модулями, которые импортируют класс и используют статические методы
// (в новой архитектуре статических методов нет, но оставляем заглушки)
ItemData.createFromSave = (data) => itemFactory.createFromSave(data);
ItemData.clone = (item, options) => itemFactory.clone(item, options);
ItemData.splitStack = (item, amount) => itemFactory.splitStack(item, amount);
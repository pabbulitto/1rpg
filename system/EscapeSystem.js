// system/EscapeSystem.js

/**
 * EscapeSystem - система для обработки побега из боя
 * 
 * Использует существующие системы через game:
 * - game.zoneManager - для получения информации о комнате и направлениях
 * - game.gameManager - для стоимости перемещения (TERRAIN_COSTS) и самого перемещения
 * - game.gameState.eventBus - для логирования
 */
class EscapeSystem {
    constructor(game) {
        this.game = game;
        this.eventBus = game.gameState?.eventBus;
    }

    /**
     * Проверить, может ли персонаж совершить побег
     * @param {Character} character - персонаж (игрок)
     * @returns {Object} { success: boolean, reason: string }
     */
    canEscape(character) {
        // 1. Проверка блокирующих эффектов
        if (character.hasBlockingEffect && character.hasBlockingEffect()) {
            return { 
                success: false, 
                reason: "Вы не можете бежать из-за текущего эффекта" 
            };
        }

        // 2. Получить текущую комнату через zoneManager
        const zoneManager = this.game.zoneManager;
        if (!zoneManager) {
            return { 
                success: false, 
                reason: "Система перемещения недоступна" 
            };
        }

        const roomInfo = zoneManager.getCurrentRoomInfo();
        if (!roomInfo) {
            return { 
                success: false, 
                reason: "Не удалось определить текущее местоположение" 
            };
        }

        // 3. Проверка наличия направлений
        const directions = roomInfo.directions || {};
        const availableDirections = Object.keys(directions).filter(dir => directions[dir]);
        
        if (availableDirections.length === 0) {
            return { 
                success: false, 
                reason: "Нет путей для отступления" 
            };
        }

        // 4. Проверка стамины
        const staminaCost = this.getEscapeCost(roomInfo);
        const currentStamina = character.getStats().stamina;
        
        if (currentStamina < staminaCost) {
            return { 
                success: false, 
                reason: `Недостаточно выносливости (нужно ${staminaCost})` 
            };
        }

        return { success: true };
    }

    /**
     * Получить стоимость побега в стамине
     * @param {Object} roomInfo - информация о текущей комнате
     * @returns {number} стоимость в стамине
     */
    getEscapeCost(roomInfo) {
        const terrainType = roomInfo.terrain || 'road';
        // Используем статическое поле GameManager.TERRAIN_COSTS
        return this.game.gameManager.constructor.TERRAIN_COSTS[terrainType] || 3;
    }

    /**
     * Получить список доступных направлений для побега с названиями комнат
     * @returns {Array} массив объектов { direction, roomId, roomName }
     */
    getEscapeDestinations() {
        const zoneManager = this.game.zoneManager;
        if (!zoneManager) return [];

        const roomInfo = zoneManager.getCurrentRoomInfo();
        if (!roomInfo) return [];

        const directions = roomInfo.directions || {};
        const destinations = [];

        for (const [direction, target] of Object.entries(directions)) {
            if (!target) continue;

            let roomId = target;
            let roomName = direction;
            const currentZoneId = roomInfo.zoneId;

            // Функция для получения имени комнаты по ID
            const getRoomName = (targetId, zoneId) => {
                // Если переход в другую зону (формат "зона:комната")
                if (targetId.includes(':')) {
                    const [targetZoneId, targetRoomId] = targetId.split(':');
                    const zoneData = zoneManager.loadedZones.get(targetZoneId);
                    return zoneData?.rooms?.[targetRoomId]?.name || targetRoomId;
                } 
                // Если комната с префиксом зоны (формат "зона.комната")
                else if (targetId.includes('.')) {
                    const [targetZoneId, targetRoomId] = targetId.split('.');
                    const zoneData = zoneManager.loadedZones.get(targetZoneId);
                    return zoneData?.rooms?.[targetId]?.name || targetRoomId;
                }
                // Внутри текущей зоны
                else {
                    const zoneData = zoneManager.loadedZones.get(zoneId);
                    return zoneData?.rooms?.[targetId]?.name || targetId;
                }
            };

            roomName = getRoomName(target, currentZoneId);

            destinations.push({
                direction,
                roomId: target,
                roomName
            });
        }

        return destinations;
    }

    /**
     * Рассчитать штраф опыта при побеге
     * @param {PlayerCharacter} character - игрок
     * @returns {number} количество опыта для списания
     */
    calculateExpPenalty(character) {
        // Проверка пассивки "отступление"
        if (character.passiveManager?.hasFlag('retainExpOnFlee')) {
            return 0;
        }

        // 2% от опыта до следующего уровня
        const expForNextLevel = character.getExpForNextLevel();
        return Math.floor(expForNextLevel * 0.02);
    }

    /**
     * Выполнить побег в указанном направлении
     * @param {PlayerCharacter} character - игрок
     * @param {string} direction - направление
     * @returns {Object} результат побега
     */
    async escapeTo(character, direction) {
        // 1. Проверка возможности побега
        const check = this.canEscape(character);
        if (!check.success) {
            return check;
        }

        // 2. Получить информацию о комнате и стоимости
        const roomInfo = this.game.zoneManager.getCurrentRoomInfo();
        const staminaCost = this.getEscapeCost(roomInfo);
        const destinations = this.getEscapeDestinations();
        const target = destinations.find(d => d.direction === direction);

        if (!target) {
            return { success: false, reason: "Направление недоступно" };
        }

        // 4. Рассчитываем и применяем штраф опыта
        const expPenalty = this.calculateExpPenalty(character);
        if (expPenalty > 0) {
            character.exp = Math.max(0, character.exp - expPenalty);
        }

        // 5. Перемещаем игрока через gameManager
        await this.game.gameManager.move(direction);

        // 6. Возвращаем результат
        return {
            success: true,
            destination: target,
            expPenalty,
            staminaCost
        };
    }

    /**
     * Выполнить побег в случайном направлении
     * @param {PlayerCharacter} character - игрок
     * @returns {Object} результат побега
     */
    async escapeRandom(character) {
        // 1. Проверка возможности побега
        const check = this.canEscape(character);
        if (!check.success) {
            return check;
        }

        // 2. Получить доступные направления
        const destinations = this.getEscapeDestinations();
        if (destinations.length === 0) {
            return { success: false, reason: "Нет путей для отступления" };
        }

        // 3. Выбрать случайное направление
        const randomIndex = Math.floor(Math.random() * destinations.length);
        const target = destinations[randomIndex];

        // 4. Выполнить побег в выбранном направлении
        return this.escapeTo(character, target.direction);
    }

    /**
     * Получить информацию о побеге для UI (при наличии пассивки выбора)
     * @param {PlayerCharacter} character - игрок
     * @returns {Object} информация для отображения
     */
    getEscapeInfo(character) {
        const check = this.canEscape(character);
        if (!check.success) {
            return { canEscape: false, reason: check.reason };
        }

        const destinations = this.getEscapeDestinations();
        const staminaCost = this.getEscapeCost(this.game.zoneManager.getCurrentRoomInfo());
        const expPenalty = this.calculateExpPenalty(character);

        return {
            canEscape: true,
            destinations,
            staminaCost,
            expPenalty,
            canChoose: character.passiveManager?.hasFlag('canChooseEscapeDestination') || false
        };
    }
}

export { EscapeSystem };
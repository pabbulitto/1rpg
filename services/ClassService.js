// services/ClassService.js

/**
 * ClassService - сервис для работы с классами (профессиями) и расами
 * Использует данные из DataService, применяет их к персонажам
 */
class ClassService {
    constructor(gameState) {
        this.gameState = gameState;
        this.dataService = gameState.dataService; // предполагается доступ
    }

    /**
     * Применить класс к персонажу
     * @param {PlayerCharacter} character - персонаж
     * @param {string} classId - ID класса (strongman, warlock, thief, healer)
     * @returns {boolean} успех
     */
    applyClassToCharacter(character, classId) {
        const classData = this.dataService.getProfessionData(classId);
        if (!classData) return false;

        character.class = classId;
        
        const statManager = character.getStatManager();
        if (!statManager) return false;

        // Применяем базовые характеристики и прирост
        statManager.applyStatPreset({
            baseStats: classData.baseStats,
            growthPerLevel: classData.growthPerLevel
        });

        // TODO: добавить способности/умения через AbilityService

        return true;
    }

    /**
     * Применить расу к персонажу
     * @param {PlayerCharacter} character - персонаж
     * @param {string} raceId - ID расы (northerner, eastern, southerner, barbarian, western)
     * @returns {Object} результат с информацией о стартовой позиции
     */
    applyRaceToCharacter(character, raceId) {
        const raceData = this.dataService.getRaceData(raceId);
        if (!raceData) return { success: false };

        const statManager = character.getStatManager();
        if (!statManager) return { success: false };

        // Бонусы к характеристикам
        if (raceData.bonuses) {
            statManager.addModifier('race_bonus', raceData.bonuses);
        }

        // Бонусы к регенерации
        if (raceData.regenBonus) {
            statManager.addModifier('race_regen', raceData.regenBonus);
        }

        // Боевые бонусы
        if (raceData.combatBonus) {
            statManager.addModifier('race_combat', raceData.combatBonus);
        }

        return {
            success: true,
            startZone: raceData.startZone || 'village',
            startRoom: raceData.startRoom || 'village_square'
        };
    }

    /**
     * Получить список всех классов
     * @returns {Object} объект с классами
     */
    getAllClasses() {
        return this.dataService.presetsData?.professions || {};
    }

    /**
     * Получить список всех рас
     * @returns {Object} объект с расами
     */
    getAllRaces() {
        return this.dataService.presetsData?.races || {};
    }
}

export { ClassService };
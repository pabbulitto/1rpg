class SaveLoadService {
    constructor(gameState) {
        this.gameState = gameState;
        this.saveKey = 'rpg_save';
    }
    
    saveGame() {
        const saveData = {
            gameState: this.gameState.toJSON(),
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(saveData));
            return { success: true, timestamp: saveData.timestamp };
        } catch (error) {
            console.error('SaveLoadService: ошибка сохранения:', error);
            return { success: false, error: error.message };
        }
    }
    
    loadGame() {
        try {
            const saveData = localStorage.getItem(this.saveKey);
            if (!saveData) {
                return { success: false, error: 'Сохранение не найдено' };
            }
            
            const data = JSON.parse(saveData);
            
            if (data.gameState) {
                this.gameState.fromJSON(data.gameState);
                return { 
                    success: true, 
                    timestamp: data.timestamp,
                    version: data.version || '1.0'
                };
            } else {
                return { success: false, error: 'Некорректные данные сохранения' };
            }
        } catch (error) {
            console.error('SaveLoadService: ошибка загрузки:', error);
            return { success: false, error: error.message };
        }
    }
    
    deleteSave() {
        try {
            localStorage.removeItem(this.saveKey);
            return { success: true };
        } catch (error) {
            console.error('SaveLoadService: ошибка удаления:', error);
            return { success: false, error: error.message };
        }
    }
    
    hasSave() {
        return localStorage.getItem(this.saveKey) !== null;
    }
    
    getSaveInfo() {
        try {
            const saveData = localStorage.getItem(this.saveKey);
            if (!saveData) return null;
            
            const data = JSON.parse(saveData);
            return {
                timestamp: data.timestamp,
                version: data.version || '1.0',
                playerLevel: data.gameState?.player?.level || 1,
                playerName: data.gameState?.player?.name || 'Герой'
            };
        } catch (error) {
            return null;
        }
    }
}

export { SaveLoadService };
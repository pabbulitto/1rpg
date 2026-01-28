import { BattleSystem } from '../BattleSystem.js';
import { Enemy } from '..Enemy.js';

class BattleService {
    constructor(game) {
        this.game = game;
        this.battleSystem = new BattleSystem();
    }
    
    startBattle(enemy) {
        this.game.gameState.updateBattle(enemy, true);
        const battleStart = this.battleSystem.startBattle(this.game.player, enemy);
        this.game.uiManager.showBattleUI(battleStart);
    }
    
    playerAttack() {
        const battle = this.game.gameState.getBattleState();
        if (!battle.inBattle || !battle.currentEnemy) return;
        
        const result = this.battleSystem.playerAttack(
            this.game.player, 
            battle.currentEnemy, 
            this.game.gameState.getStatManager() 
        );
        
        this.game.uiManager.updateBattleLog(result.log);
        
        if (result.enemyDead) {
            this.endBattleVictory();
        } else if (result.playerDead) {
            this.endBattleDefeat();
        } else {
            this.game.uiManager.updateBattleStats(
                this.game.player.getStats(),
                battle.currentEnemy.getInfo()
            );
        }
    }
    
    useDefenseAction() {
        const battle = this.game.gameState.getBattleState();
        if (!battle.inBattle || !battle.currentEnemy) {
            this.game.uiManager.addToLog("Не в бою!", "warning");
            return;
        }
        
        const playerStats = this.game.player.getStats();
        const defenseBonus = Math.floor(playerStats.defense * 0.2);
        
        this.game.gameState.getStatManager().addModifier('temp_defense_buff', {
            defense: defenseBonus
        });
        
        this.game.uiManager.updatePlayerStats(this.game.player.getStats());
        
        const enemyDamage = battle.currentEnemy.attackPlayer(playerStats);
        const playerResult = this.game.player.takeDamage(enemyDamage);
        
        this.game.uiManager.updateBattleLog([
            `${battle.currentEnemy.name} атакует!`,
            `Вы получили ${enemyDamage} урона`
        ]);
        
        this.game.gameState.getStatManager().removeModifier('temp_defense_buff');
        
        if (playerResult.isDead) {
            this.endBattleDefeat();
        }
    }
    
    tryEscape() {
        const battle = this.game.gameState.getBattleState();
        if (!battle.inBattle || !battle.currentEnemy) return;
        
        const result = this.battleSystem.tryEscape(this.game.player, battle.currentEnemy);
        this.game.uiManager.updateBattleLog(result.log);
        
        if (result.success) {
            this.game.gameState.updateBattle(null, false);
            this.game.uiManager.showExplorationUI();
            this.game.uiManager.updateMinimap();
        } else if (result.playerDead) {
            this.endBattleDefeat();
        }
    }
    
    endBattleVictory() {
        const battle = this.game.gameState.getBattleState();
        const result = this.battleSystem.endBattleVictory(
            this.game.player,
            battle.currentEnemy,
            this.game.inventorySystem
        );
        
        this.game.gameState.addGold(result.gold);
        this.game.uiManager.updateBattleLog(result.log);
        this.game.uiManager.showVictoryScreen(result);
        
        setTimeout(() => {
            this.game.gameState.updateBattle(null, false);
            this.game.uiManager.showExplorationUI();
            this.game.uiManager.updatePlayerStats(this.game.player.getStats());
            this.game.uiManager.updateMinimap();
        }, 2000);
    }
    
    endBattleDefeat() {
        this.game.uiManager.addToLog("💀 Вы погибли...", "error");
        
        setTimeout(() => {
            alert("Игра окончена! Начните заново.");
            location.reload();
        }, 1500);
    }
}

export { BattleService };
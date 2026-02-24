// main.js
import { DataService } from './services/DataService.js';
import { GameState } from './core/GameState.js';
import { PlayerCharacter } from './core/PlayerCharacter.js';
import { EnemyService } from './services/EnemyService.js';
import { Item } from './core/Item.js';
import { EquipmentService } from './services/EquipmentService.js';
import { ZoneManager } from './system/ZoneManager.js';
import { BattleSystem } from './system/BattleSystem.js';
import { ShopSystem } from './system/ShopSystem.js';
import { UIManager } from './ui/UIManager.js';
import { GameManager } from './services/GameManager.js';
import { BattleOrchestrator } from './services/BattleOrchestrator.js';
import { BeltSystem } from './system/BeltSystem.js';
import { SaveLoadService } from './services/SaveLoadService.js';
import { DiceRoller } from './system/DiceRoller.js';
import { CombatSystem } from './system/CombatSystem.js';
import { ActionHandler } from './core/ActionHandler.js';
import { AbilityService } from './services/AbilityService.js';
import { itemService } from './services/ItemService.js';
// Импорт всех UI компонентов
import { CharacterCreationUI } from './ui/components/CharacterCreationUI.js';
import { StatsUI } from './ui/components/StatsUI.js';
import { InventoryUI } from './ui/components/InventoryUI.js';
import { EquipmentUI } from './ui/components/EquipmentUI.js';
import { SkillsUI } from './ui/components/SkillsUI.js';
import { TimeUI } from './ui/components/TimeUI.js';
import { LogUI } from './ui/components/LogUI.js';
import { BattleUI } from './ui/components/BattleUI.js';
import { ShopUI } from './ui/components/ShopUI.js';
import { BeltUI } from './ui/components/BeltUI.js';
import { itemRegistry } from './core/ItemRegistry.js';


class Game {
  constructor() {
    this.gameState = new GameState();
    this.dataService = new DataService();
    itemService.init();
    window.itemService = itemService;
    this.abilityService = new AbilityService(this.gameState);
    // 1. Создаем DiceRoller
    this.diceRoller = new DiceRoller();
    
    // 2. Создаем BattleSystem с DiceRoller
    this.battleSystem = new BattleSystem(this.diceRoller);
    
    // 3. Создаем CombatSystem
    this.combatSystem = new CombatSystem(
      this.battleSystem,
      this.gameState.eventBus
    );
    
    // 4. Создаем игрока
    this.player = new PlayerCharacter(this.gameState, {
      eventBus: this.gameState.eventBus,
      equipmentService: null, // будет установлен позже
      abilityService: this.abilityService,
      battleSystem: this.battleSystem
    });
    
    // 5. Создаем ActionHandler с игроком
    this.actionHandler = new ActionHandler(
      this.gameState.eventBus,
      this.combatSystem,
      this.abilityService,
      this.player
    );
    
    this.battleOrchestrator = new BattleOrchestrator(
        this,
        this.battleSystem,
        this.combatSystem
    );
    
    // 6. Остальные системы
    this.zoneManager = new ZoneManager(this.gameState);
    
    this.equipmentService = new EquipmentService(
      this.gameState.eventBus,
      this.gameState.statManager,
      this.gameState
    );
    
    // Устанавливаем equipmentService для игрока
    this.player.equipmentService = this.equipmentService;
    
    // ИНВЕНТАРИСИСТЕМ БОЛЬШЕ НЕ СОЗДАЕМ
    
    this.enemyService = new EnemyService(
        null, 
        this.battleSystem
    );
    
    this.beltSystem = new BeltSystem(
      this.gameState, 
      this.battleOrchestrator,
      this.player  
    );
    
    this.shopSystem = new ShopSystem(this.gameState);
    this.saveLoadService = new SaveLoadService(this.gameState);
    
    const uiComponents = {
      StatsUI,
      InventoryUI,
      EquipmentUI,
      SkillsUI,
      TimeUI,
      LogUI,
      BattleUI,
      ShopUI,
      BeltUI
    };
    
    this.uiManager = new UIManager(this, uiComponents);
    this.gameManager = new GameManager(this);
    
    this.isInitialized = false;
  }
  
  async init() {
    try {
      await this.dataService.loadGameData();

      // Инициализация реестра предметов
      itemRegistry.init();
      
      this.enemyService.enemiesData = this.dataService.enemiesData;
      
      this.abilityService.loadAbilities(
        this.dataService.getAllSpells(),
        this.dataService.getAllSkills()
      );
      
      this.gameState.getTimeSystem().start();
      
      // ИНИЦИАЛИЗАЦИЯ ЗОН
      await this.zoneManager.init();
      const currentRoom = this.gameState.getPosition().room;
      this.zoneManager.addEntity(currentRoom, this.player);      
      this.uiManager.init();
      this.isInitialized = true;
      
      let playerName = "Герой";
      const hasExistingSave = this.saveLoadService.hasSave();
      
      if (!hasExistingSave) {
        // === НОВЫЙ КОД: вызов UI создания персонажа ===
        // Создаем контейнер если его нет
        let creationContainer = document.getElementById('character-creation-container');
        if (!creationContainer) {
          creationContainer = document.createElement('div');
          creationContainer.id = 'character-creation-container';
          document.body.appendChild(creationContainer);
        }
        
        // Создаем промис для ожидания выбора игрока
        const creationResult = await new Promise((resolve) => {
          const creationUI = new CharacterCreationUI({
            container: creationContainer,
            dataService: this.dataService,
            onComplete: (result) => {
              resolve(result);
            }
          });
          
          creationUI.init();
          creationUI.show();
        });
        
        // Применяем результаты выбора
        const { name, classId, raceId, finalStats } = creationResult;
        
        // Устанавливаем имя
        this.player.name = name;
        this.gameState.updatePlayer({ name }); // для обратной совместимости
        
        // Устанавливаем класс и расу
        this.player.class = classId;
        this.player.race = raceId;
        
        // Применяем финальные статы
        this.player.applyFinalStats(finalStats);
        
        // Добавляем стартовые предметы из класса
        const classData = this.dataService.getProfessionData(classId);
        if (classData?.startingItems) {
          Object.entries(classData.startingItems).forEach(([itemId, count]) => {
            const item = itemFactory.create(itemId, count);
            if (item) this.gameState.playerContainer.addItem(item);
          });
        }
        
        // === ДОБАВЛЕНО: врождённые способности ===
        if (classData?.innateAbilities && this.abilityService) {
          classData.innateAbilities.forEach(abilityId => {
            this.abilityService.addAbilityToCharacter(this.player.id, abilityId);
          });
        }
        // Применяем стартовую позицию из расы
        const raceData = this.dataService.getRaceData(raceId);
        if (raceData?.startZone && raceData?.startRoom) {
          this.gameState.updatePosition(raceData.startZone, raceData.startRoom);
        }
            // ЗАГРУЖАЕМ НОВУЮ ЗОНУ
        await this.zoneManager.loadZone(raceData.startZone);
        
        // Обновляем комнату в ZoneManager
        this.zoneManager._initRoom(raceData.startRoom);
        this.zoneManager.addEntity(raceData.startRoom, this.player);
        // Очищаем контейнер UI
        creationContainer.innerHTML = '';
        
        this.uiManager.addToLog(`🏰 Добро пожаловать, ${name}! 🏰`);
        this.uiManager.addToLog("Нажмите 'Исследовать', чтобы начать.");
        
      } else {
        const saveInfo = this.saveLoadService.getSaveInfo();
        playerName = saveInfo?.playerName || "Герой";
        this.player.name = playerName;
        this.loadGame();
      }
      
      this.gameManager.explore();
      
    } catch (error) {
      console.error('Ошибка инициализации:', error);
      this.uiManager.showError("Не удалось загрузить игру");
    }
  }

  saveGame() {
      const result = this.saveLoadService.saveGame();
      if (result.success) {
          this.uiManager.addToLog("Игра сохранена", "success");
      } else {
          this.uiManager.addToLog(`Ошибка сохранения: ${result.error}`, "error");
      }
  }

  loadGame() {
      const result = this.saveLoadService.loadGame();
      if (result.success) {
          // После загрузки GameState, синхронизируем PlayerCharacter
          const savedPlayer = this.gameState.player; // старый объект из сохранения
          
          // Обновляем поля в нашем PlayerCharacter
          this.player.name = savedPlayer.name || this.player.name;
          this.player.class = savedPlayer.class || null;
          this.player.race = savedPlayer.race || null;
          this.player.finalBaseStats = savedPlayer.finalBaseStats || null;
          
          // Применяем финальные статы если они есть
          if (this.player.finalBaseStats) {
              this.player.applyFinalStats(this.player.finalBaseStats);
          }
          
          this.uiManager.addToLog("Игра загружена", "success");
          this.uiManager.updatePlayerStats(this.player.getStats());
          this.gameManager.explore();
      } else {
          this.uiManager.showError(`Ошибка загрузки: ${result.error}`);
      }
  }
}

let gameInstance;

window.addEventListener('DOMContentLoaded', () => {
  gameInstance = new Game();
  gameInstance.init();
  
  window.game = gameInstance;
  
  document.getElementById('save-btn').addEventListener('click', () => {
    gameInstance.saveGame();
  });
  
  document.getElementById('load-btn')?.addEventListener('click', () => {
    gameInstance.loadGame();
  });
});

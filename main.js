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
import { AbilityService } from './services/AbilityService.js';
import { itemRegistry } from './core/ItemRegistry.js';
import { GraphicsEngine } from './ui/GraphicsEngine.js';
import { BattleCanvas } from './ui/BattleCanvas.js';
import { GroundBag } from './core/GroundBag.js';
import { EffectService } from './services/EffectService.js';
import { PassiveAbilityService } from './services/PassiveAbilityService.js';
import { FormulaParser } from './system/FormulaParser.js';
import { EscapeSystem } from './system/EscapeSystem.js';
import { DialogueSystem } from './services/DialogueSystem.js';
import { ContextManager } from './services/ContextManager.js';  
// Импорт всех UI компонентов
import { CharacterCreationUI } from './ui/components/CharacterCreationUI.js';
import { StatsUI } from './ui/components/StatsUI.js';
import { InventoryUI } from './ui/components/InventoryUI.js';
import { EquipmentUI } from './ui/components/EquipmentUI.js';
import { SkillsUI } from './ui/components/SkillsUI.js';
import { PassivesEffectsUI } from './ui/components/PassivesEffectsUI.js';
import { TimeUI } from './ui/components/TimeUI.js';
import { LogUI } from './ui/components/LogUI.js';
import { ShopUI } from './ui/components/ShopUI.js';
import { BeltUI } from './ui/components/BeltUI.js';
import { MapUI } from './ui/components/MapUI.js';
import { EntityActionModal } from './ui/components/EntityActionModal.js';



class Game {
  constructor() {
    this.gameState = new GameState();
    this.dataService = new DataService();
    this.abilityService = new AbilityService(this.gameState);

    this.formulaParser = new FormulaParser();
    this.passiveAbilityService = new PassiveAbilityService(
      this.gameState.eventBus,
      this.formulaParser
    );

    this.effectService = new EffectService(
      this.gameState.eventBus,
      this.formulaParser
    );

    this.contextManager = new ContextManager(this, this.gameState.eventBus);
    this.contextManager.init();
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
    
    this.battleOrchestrator = new BattleOrchestrator(
        this,
        this.battleSystem,
        this.combatSystem
    );

    this.escapeSystem = new EscapeSystem(this);

    this.dialogueSystem = new DialogueSystem(this);
    this.dialogueSystem.EntityActionModal = EntityActionModal;
    // 6. Остальные системы
    this.zoneManager = new ZoneManager(this.gameState);
    this.graphicsEngine = new GraphicsEngine('game-canvas', this);
    this.battleCanvas = new BattleCanvas('battle-canvas', this, this.beltSystem);

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
      PassivesEffectsUI,  
      TimeUI,
      LogUI,
      ShopUI,
      BeltUI,
      MapUI,
      EntityActionModal
    };
    
    this.uiManager = new UIManager(this, uiComponents, this.graphicsEngine, this.battleCanvas);
    this.gameManager = new GameManager(this);
    // Пояс в инвентаре
    const inventoryBeltContainer = document.getElementById('inventory-belt-container');
    if (inventoryBeltContainer) {
        this.inventoryBeltUI = new BeltUI(inventoryBeltContainer, this.gameState.eventBus, this.beltSystem);
        this.inventoryBeltUI.init();
    }
        
    this.isInitialized = false;
  }
  
  async init() {
    try {
      await this.dataService.loadGameData();
      // Инициализация реестра предметов
      itemRegistry.init();
      // Загружаем пассивные способности
      const passiveData = await this.dataService.loadJson('data/passive-abilities.json');
      this.passiveAbilityService.loadPassives(passiveData);
      
      const effectsData = await this.dataService.loadJson('data/effects.json');
      this.effectService.loadEffects(effectsData);

      this.enemyService.enemiesData = this.dataService.enemiesData;
      
      this.abilityService.loadAbilities(
        this.dataService.getAllSpells(),
        this.dataService.getAllSkills()
      );
      
      this.gameState.getTimeSystem().start();
      
      // ИНИЦИАЛИЗАЦИЯ ЗОН
      await this.zoneManager.init();
      this.graphicsEngine.init();
      const currentRoom = this.gameState.getPosition().room;
      this.zoneManager.addEntity(currentRoom, this.player);      
      this.isInitialized = true;
      
      let playerName = "Герой";
      const hasExistingSave = this.saveLoadService.hasSave();
      
      if (!hasExistingSave) {
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
        // Устанавливаем спрайт в зависимости от класса
        this.player.sprite = `assets/sprites/player/${classId}.png`;
        this.player.portrait = `assets/portraits/${classId}.png`;
        // Применяем финальные статы
        this.player.applyFinalStats(finalStats);
        
        this.player.container.owner = this.player;
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
                // Добавляем тестовые способности
        if (this.abilityService) {
            this.abilityService.addAbilityToCharacter(this.player.id, 'kick');
            this.abilityService.addAbilityToCharacter(this.player.id, 'magic_missile');
        }
        // Применяем стартовую позицию из расы
        const raceData = this.dataService.getRaceData(raceId);
        if (raceData?.startZone && raceData?.startRoom) {
            // Сохраняем в игроке для возрождения
            this.player.startZone = raceData.startZone;
            this.player.startRoom = raceData.startRoom;
            
            // Обновляем позицию в GameState
            this.gameState.updatePosition(raceData.startZone, raceData.startRoom);
            
        // ЗАГРУЖАЕМ ЗОНУ И ДОБАВЛЯЕМ ИГРОКА
            await this.zoneManager.loadZone(raceData.startZone);
            this.zoneManager._initRoom(raceData.startRoom);
            // УСТАНАВЛИВАЕМ НАЧАЛЬНЫЕ КООРДИНАТЫ
            this.player.gridX = 4;
            this.player.gridY = 2;
            this.zoneManager.addEntity(raceData.startRoom, this.player);
            
            // ПРИНУДИТЕЛЬНО ОБНОВЛЯЕМ GRAPHICS ENGINE
            const roomEntities = this.zoneManager.getRoomEntities(raceData.startRoom);
            this.graphicsEngine.entities = roomEntities.map(entity => ({
                id: entity.id,
                type: entity.type,
                sprite: entity.sprite,
                gridX: entity.gridX,
                gridY: entity.gridY,
                width: entity.width || 68,
                height: entity.height || 68,
                state: entity.state,
                data: entity.getInfo ? entity.getInfo() : entity
            }));
            this.graphicsEngine.render();
        }

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
      //инициализируем UI
      this.uiManager.init();
      
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

  async loadGame() {
      const result = this.saveLoadService.loadGame();
      if (!result.success) {
          this.uiManager.showError(`Ошибка загрузки: ${result.error}`);
          return;
      }
      
      // ===== 1. Обновляем ссылку на контейнер (самое важное!) =====
      this.player.container = this.gameState.playerContainer;
      
      // ===== 2. Синхронизируем PlayerCharacter с загруженными данными =====
      const savedPlayer = this.gameState.player;
      
      this.player.name = savedPlayer.name || this.player.name;
      this.player.class = savedPlayer.class || null;
      this.player.race = savedPlayer.race || null;
      this.player.finalBaseStats = savedPlayer.finalBaseStats || null;
      
      if (this.player.finalBaseStats) {
          this.player.applyFinalStats(this.player.finalBaseStats);
      }
      
      // ===== 3. Перезагружаем текущую зону =====
      const position = this.gameState.getPosition();
      if (!position.zone || !position.room) {
          console.error('loadGame: некорректная позиция в сохранении', position);
          this.uiManager.showError('Ошибка загрузки: некорректная позиция');
          return;
      }
      
      try {
          await this.zoneManager.loadZone(position.zone);
          this.zoneManager._initRoom(position.room);
          
          // Добавляем игрока в комнату (на случай, если его там нет)
          this.zoneManager.addEntity(position.room, this.player);
          
          // Проверяем, что комната загрузилась
          const roomInfo = this.zoneManager.getCurrentRoomInfo();
          if (!roomInfo) {
              console.error('loadGame: не удалось загрузить комнату', position);
              this.uiManager.showError('Ошибка загрузки: комната не найдена');
              return;
          }
          
          // ===== 4. Обновляем UI =====
          this.uiManager.addToLog("Игра загружена", "success");
          this.uiManager.updateAll();  // обновить все компоненты UI
          
          // ===== 5. Показываем текущую комнату =====
          this.gameManager.explore();
          
      } catch (error) {
          console.error('loadGame: ошибка загрузки зоны', error);
          this.uiManager.showError(`Ошибка загрузки зоны: ${error.message}`);
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
  document.getElementById('new-game-btn')?.addEventListener('click', () => {
    if (confirm('Начать новую игру? Весь прогресс будет потерян.')) {
      localStorage.removeItem('rpg_save');
      location.reload();
    }
  });
});
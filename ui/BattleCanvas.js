// ui/BattleCanvas.js
/**
 * BattleCanvas - графический движок для боя
 * Полностью независимый компонент, заменяет BattleUI
 * 
 * Размер: 900×507
 * Центральная область: ячейки 85×85 для спрайтов (8×3)
 * Нижняя панель: сетка 50×50 (18×3 ячейки) для умений/пояса
 */
import { BeltUI } from './components/BeltUI.js';

class BattleCanvas {
    constructor(canvasId, game, beltSystem) {
        this.game = game;
        this.beltSystem = beltSystem;
        this.eventBus = game.gameState?.eventBus;
        this.combatSystem = game.combatSystem;
        this.battleOrchestrator = game.battleOrchestrator;
        
        // Canvas setup
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = canvasId;
        }
        this.canvas.width = 900;
        this.canvas.height = 507;
        this.ctx = this.canvas.getContext('2d');
        
        // Размеры элементов интерфейса
        this.topBarHeight = 100;
        this.bottomBarHeight = 150;
        this.sideColumnWidth = 110;
        this.centerWidth = 900 - (this.sideColumnWidth * 2); // 680px
        this.centerHeight = 507 - this.topBarHeight - this.bottomBarHeight; // 257px
        
        // Параметры сетки для спрайтов
        this.spriteCellSize = 85;
        this.spriteCols = 8;  // 680 / 85 = 8
        this.spriteRows = 3;   // 257 / 85 = 3 (с остатком, но помещается)
        
        // Параметры сетки для умений (нижняя панель)
        this.abilityCellSize = 50;
        this.abilityCols = 18; // 900 / 50
        this.abilityRows = 3;   // 150 / 50
        // Пояс
        this.beltContainer = null;
        // Состояние боя
        this.currentBattle = null;
        this.playerTeam = [];    // массив участников команды игрока
        this.enemyTeam = [];     // массив врагов
        this.abilities = [];     // доступные умения/заклинания
        this.beltSlots = [];     // предметы пояса
        this.selectedTarget = null;
        this.selectedAction = null;
        
        // Анимации
        this.animations = new Map(); // entityId -> { type, timer, data }
        
        // Кэш для изображений
        this.backgrounds = new Map();
        this.sprites = new Map();
        
        // Флаги
        this.isVisible = false;
        this.isInitialized = false;
        
        // Привязка методов
        this.handleClick = this.handleClick.bind(this);
        this.render = this.render.bind(this);
        this.startAnimationLoop = this.startAnimationLoop.bind(this);
        this.onBattleStart = this.onBattleStart.bind(this);
        this.onBattleUpdate = this.onBattleUpdate.bind(this);
        this.onBattleEnd = this.onBattleEnd.bind(this);
        
        // Инъекция стилей
        this.injectStyles();
    }
    
    injectStyles() {
        const styleId = 'battle-canvas-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .battle-canvas-container {
                position: relative;
                width: 900px;
                height: 507px;
                margin: 0 auto;
            }
            .corpse-loot-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #2a2a2a;
                border: 2px solid #666;
                border-radius: 8px;
                padding: 15px;
                z-index: 2000;
                min-width: 250px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            }
            .corpse-loot-modal h3 {
                margin: 0 0 10px 0;
                color: #ffaa44;
                border-bottom: 1px solid #444;
                padding-bottom: 5px;
            }
            .corpse-loot-modal button {
                display: block;
                width: 100%;
                margin: 8px 0;
                padding: 8px;
                background: #444;
                color: white;
                border: 1px solid #666;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                text-align: left;
            }
            .corpse-loot-modal button:hover {
                background: #555;
            }
            .corpse-loot-modal .close-btn {
                margin-top: 15px;
                background: #333;
                text-align: center;
            }
        `;
        document.head.appendChild(style);
    }
    
    init() {
        if (this.isInitialized) return;
        
        // Подписка на события боя
        if (this.eventBus) {
            this.eventBus.on('battle:start', this.onBattleStart);
            this.eventBus.on('battle:update', this.onBattleUpdate);
            this.eventBus.on('battle:end', this.onBattleEnd);
        }
        
        // Обработчик кликов
        this.canvas.addEventListener('click', this.handleClick);;
        // Запускаем анимационный цикл
        this.startAnimationLoop();
                
        this.eventBus.on('battle:roundComplete', (results) => {
            this.showRoundResults(results);
        });
    
        // Создаем контейнер для пояса
        this.beltContainer = document.createElement('div');
        this.beltContainer.id = 'battle-belt-container';
        this.beltContainer.style.position = 'absolute';
        this.beltContainer.style.bottom = '0';
        this.beltContainer.style.right = '0';
        this.beltContainer.style.width = '200px';
        this.beltContainer.style.height = '150px';
        this.beltContainer.style.pointerEvents = 'auto';
        this.beltContainer.style.display = 'none'; // скрыт по умолчанию
        this.beltContainer.style.zIndex = '10';

        this.canvas.parentNode.style.position = 'relative';
        this.canvas.parentNode.style.width = '900px';
        this.canvas.parentNode.style.height = '507px';
        this.canvas.parentNode.style.margin = '0 auto';
        // Добавляем в родительский контейнер канваса
        this.canvas.parentNode.style.position = 'relative';
        this.canvas.parentNode.appendChild(this.beltContainer);
        // Создаем BeltUI и передаем ему этот контейнер
        this.beltUI = new BeltUI(this.beltContainer, this.eventBus, this.game.beltSystem);
        this.beltUI.init();

        this.isInitialized = true;
        console.log('BattleCanvas: инициализирован');
        return this;
    }
    
    startAnimationLoop() {
        const loop = () => {
            if (this.isVisible) {
                this.updateAnimations();
                this.render();
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
    
    show() {
        this.canvas.style.display = 'block';
        this.isVisible = true;
        if (this.beltContainer) {
            this.beltContainer.style.display = 'block';
        }
        this.render();
    }
    
    hide() {
        this.canvas.style.display = 'none';
        this.isVisible = false;
        if (this.beltContainer) {
            this.beltContainer.style.display = 'none';
        }
    }
    
    // ========== АНИМАЦИИ ==========
    
    triggerDamage(targetId, damageType) {
        // Определяем цвет в зависимости от типа урона
        let color;
        if (damageType === 'critical') {
            color = '#540202'; // темно-красный для критического урона
        } else if (damageType === 'physical') {
            color = '#ff0000'; // красный для физического урона
        } else if (damageType === 'magical') {
            color = '#864383'; // синий для магического урона
        } else {
            color = '#ff0000'; // по умолчанию красный
        }
        
        if (!this.animations.has(targetId)) {
            this.animations.set(targetId, []);
        }
        
        const anims = this.animations.get(targetId);
        if (Array.isArray(anims)) {
            anims.push({
                type: 'damage',
                timer: 12,
                data: { color, shake: true }
            });
        } else {
            // Если вдруг там не массив — перезаписываем
            this.animations.set(targetId, [{
                type: 'damage',
                timer: 12,
                data: { color, shake: true }
            }]);
        }
    }
    
    triggerBlock(targetId) {
        if (!this.animations.has(targetId)) {
            this.animations.set(targetId, []);
        }
        this.animations.get(targetId).push({
            type: 'block',
            timer: 10
        });
    }
    
    triggerEvade(targetId) {
        if (!this.animations.has(targetId)) {
            this.animations.set(targetId, []);
        }
        this.animations.get(targetId).push({
            type: 'evade',
            timer: 55,
            data: { 
                offsetY: (Math.random() > 0.5 ? 1 : -1) * 30
            }
        });
    }
    
    triggerMassDamage(targetIds, damageType) {
        targetIds.forEach(id => this.triggerDamage(id, damageType));
    }
    
    updateAnimations() {
        for (const [id, anims] of this.animations.entries()) {
            if (!Array.isArray(anims)) {
                // Если вдруг там не массив — удаляем
                this.animations.delete(id);
                continue;
            }
            
            const activeAnims = anims.filter(anim => {
                anim.timer--;
                return anim.timer > 0;
            });
            
            if (activeAnims.length > 0) {
                this.animations.set(id, activeAnims);
            } else {
                this.animations.delete(id);
            }
        }
    }
    /**
     * Показать результаты раунда (анимации)
     * @param {Object} results - результаты раунда из CombatSystem
     */
    showRoundResults(results) {
        // Анимации атак игрока (урон или уклонение врага)
        results.playerAttacks?.forEach(attack => {
            if (attack.result && attack.result.damage > 0) {
                // Попадание — урон по врагу
                this.triggerDamage(attack.target, attack.result.damageType || 'physical');
            } else {
                // Промах — уклонение врага
                this.triggerEvade(attack.target);
            }
        });
        
        // Анимации атак врагов (урон или уклонение игрока)
        results.enemyAttacks?.forEach(attack => {
            if (attack.damage > 0) {
                // Попадание — урон по игроку
                this.triggerDamage(this.game.player.id, attack.isCritical ? 'critical' : 'physical');
            } else {
                // Промах — уклонение игрока
                this.triggerEvade(this.game.player.id);
            }
        });
        
        // Очищаем выбранное действие
        this.selectedAction = null;
    }
    // ========== УПРАВЛЕНИЕ БОЕМ ==========
    
    onBattleStart(data) {
        this.currentBattle = this.combatSystem?.currentBattle;
        if (!this.currentBattle) return;
        
        // Формируем команды с распределением по ячейкам
        this.playerTeam = this.formatPlayerTeam();
        this.enemyTeam = this.formatEnemyTeam();
        
        // Получаем доступные умения
        this.updateAbilities();
        this.selectedAction = null;
        // Показываем канвас
        this.show();
    }
    
    onBattleUpdate(data) {
        if (this.currentBattle) {
            this.updateTeams();
        }
    }
    
    onBattleEnd() {
        this.currentBattle = null;
        this.playerTeam = [];
        this.enemyTeam = [];
        this.abilities = [];
        this.beltSlots = [];
        this.selectedAction = null;
        this.selectedTarget = null;
        this.animations.clear();
        this.hide();
    }
    
    // ========== ФОРМИРОВАНИЕ КОМАНД ==========
    
    formatPlayerTeam() {
        const team = [];
        const player = this.game.player;
        
        // Основной игрок
        team.push({
            id: player.id,
            sprite: player.sprite,
            name: player.name,
            health: player.getStats().health,
            maxHealth: player.getStats().maxHealth,
            isPlayer: true,
            isCorpse: false
        });
        
        // TODO: добавить спутников/петов
        
        // Распределяем по ячейкам
        return this.assignPositions(team, true);
    }
    
    formatEnemyTeam() {
        const team = [];
        if (!this.currentBattle?.enemies) return team;
        
        this.currentBattle.enemies.forEach(enemy => {
            team.push({
                id: enemy.id,
                sprite: enemy.sprite,
                name: enemy.name,
                health: enemy.getStats().health,
                maxHealth: enemy.getStats().maxHealth,
                isEnemy: true,
                isCorpse: enemy.state === 'corpse'
            });
        });
        
        return this.assignPositions(team, false);
    }
    
    /**
     * Распределение по ячейкам с приоритетом: центр → верх → низ
     */
    assignPositions(team, isPlayerTeam) {
        if (team.length === 0) return team;
        
        // Порядок заполнения: сначала все центральные (Y=1), потом верхние (Y=0), потом нижние (Y=2)
        const order = [];
        for (let col = 0; col < 4; col++) {
            order.push({ col, row: 1 }); // центр
        }
        for (let col = 0; col < 4; col++) {
            order.push({ col, row: 0 }); // верх
        }
        for (let col = 0; col < 4; col++) {
            order.push({ col, row: 2 }); // низ
        }
        
        // Назначаем позиции по порядку
        team.forEach((member, index) => {
            if (index < order.length) {
                member.gridX = order[index].col;
                member.gridY = order[index].row;
            } else {
                // Если не хватило ячеек, ставим в последнюю
                member.gridX = 3;
                member.gridY = 2;
            }
        });
        
        return team;
    }
    
    updateTeams() {
        // Обновляем здоровье и состояние игрока
        this.playerTeam = this.playerTeam.map(p => {
            if (p.id === this.game.player.id) {
                return {
                    ...p,
                    health: this.game.player.getStats().health,
                    maxHealth: this.game.player.getStats().maxHealth,
                    isCorpse: this.game.player.state === 'corpse'
                };
            }
            return p;
        });
        
        // Обновляем врагов
        if (this.currentBattle?.enemies) {
            this.enemyTeam = this.enemyTeam.map((e, index) => {
                const enemy = this.currentBattle.enemies[index];
                if (enemy) {
                    return {
                        ...e,
                        health: enemy.getStats().health,
                        maxHealth: enemy.getStats().maxHealth,
                        isCorpse: enemy.state === 'corpse'
                    };
                }
                return e;
            });
        }
    }
    
    updateAbilities() {
        const abilityService = this.game.abilityService;
        if (!abilityService) return;
        
        const player = this.game.player;
        this.abilities = abilityService.getCharacterAbilities(player.id);
    }

    // ========== ЗАГРУЗКА РЕСУРСОВ ==========
    
    async loadBackground() {
        const roomInfo = this.game.zoneManager?.getCurrentRoomInfo();
        if (!roomInfo) return null;
        
        const terrain = roomInfo.terrain || 'road';
        const key = `battle_${terrain}`;
        
        if (this.backgrounds.has(key)) return this.backgrounds.get(key);
        
        const src = `assets/backgrounds/battle/${terrain}.jpg`;
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.backgrounds.set(key, img);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`BattleCanvas: фон для ${terrain} не найден`);
                resolve(null);
            };
            img.src = src;
        });
    }
    
    async loadSprite(src) {
        if (!src) return null;
        if (this.sprites.has(src)) return this.sprites.get(src);
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.sprites.set(src, img);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`BattleCanvas: спрайт не найден ${src}`);
                resolve(null);
            };
            img.src = src;
        });
    }
    // ========== ОТРИСОВКА ==========
    async render() {
        if (!this.isVisible) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        await this.drawBackground();
        // Союзники (исключая игрока)
        const allies = this.playerTeam.filter(m => !m.isPlayer);
                        // Левая верхняя
        this.ctx.fillStyle = 'rgba(30, 30, 46, 0.8)';
        this.ctx.fillRect(0, 0, 450, this.topBarHeight);
        
        // Правая верхняя
        this.ctx.fillStyle = 'rgba(46, 30, 30, 0.8)';
        this.ctx.fillRect(450, 0, 450, this.topBarHeight);
        
        // Левая боковая
        this.ctx.fillStyle = 'rgba(30, 30, 46, 0.8)';
        this.ctx.fillRect(0, this.topBarHeight, this.sideColumnWidth, this.centerHeight);
        
        // Правая боковая
        this.ctx.fillStyle = 'rgba(46, 30, 30, 0.8)';
        this.ctx.fillRect(790, this.topBarHeight, this.sideColumnWidth, this.centerHeight);
        
        // Враги
        const enemies = this.enemyTeam;
        // Левая верхняя (союзники, первые 8)
        await this.drawEntityBlocks(0, 0, allies.slice(0, 8), 4, 2);
        // Левая боковая (союзники, остальные)
        await this.drawEntityBlocks(0, this.topBarHeight, allies.slice(8), 1, 5);
        // Правая верхняя (враги, первые 8)
        await this.drawEntityBlocks(450, 0, enemies.slice(0, 8), 4, 2);
        // Правая боковая (враги, остальные)
        await this.drawEntityBlocks(790, this.topBarHeight, enemies.slice(8), 1, 5);

        await this.drawCenterSprites();
        this.drawTargetHighlight();
        await this.drawBottomPanel();
    }
    
    async drawBackground() {
        const background = await this.loadBackground();
        if (background) {
            this.ctx.drawImage(background, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = '#1a1a2e';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    async drawCenterSprites() {
        const startX = this.sideColumnWidth;
        const startY = this.topBarHeight;
        
        // Рисуем игроков (левая половина, колонки 0-3)
        for (const member of this.playerTeam) {
            if (!member.gridX === undefined) continue;
            
            const x = startX + (member.gridX * this.spriteCellSize);
            const y = startY + (member.gridY * this.spriteCellSize);
            
            await this.drawEntityWithAnimations(member, x, y);
            this.drawHealthBar(x, y - 8, member.health, member.maxHealth);
        }
        
        // Рисуем врагов (правая половина, колонки 4-7)
        for (const enemy of this.enemyTeam) {
            if (enemy.gridX === undefined) continue;
            
            const x = startX + ((enemy.gridX + 4) * this.spriteCellSize);
            const y = startY + (enemy.gridY * this.spriteCellSize);
            
            await this.drawEntityWithAnimations(enemy, x, y);
            this.drawHealthBar(x, y - 8, enemy.health, enemy.maxHealth);
        }
    }
    
    async drawEntityWithAnimations(entity, x, y) {
        const anims = this.animations.get(entity.id) || []; 
        let drawX = x;
        let drawY = y;
        let spriteToDraw = entity.sprite;
        
        // Применяем анимации (встряска, смещение)
        for (const anim of anims) {
            switch (anim.type) {
                case 'damage':
                    // Встряхивание
                    if (anim.data.shake) {
                        drawX += (Math.random() * 8) - 4;
                        drawY += (Math.random() * 8) - 4;
                    }
                    break;
                    
                case 'evade':
                    // Вертикальное смещение
                    drawY += anim.data.offsetY;
                    break;
            }
        }
        
        // Рисуем спрайт
        if (entity.isCorpse) {
            const corpseSprite = 'assets/sprites/items/corpse1.png'; 
            const sprite = await this.loadSprite(corpseSprite);
            if (sprite) {
                this.ctx.drawImage(sprite, drawX, drawY, this.spriteCellSize, this.spriteCellSize);
            } else {
                // заглушка если спрайт не загрузился
                this.ctx.fillStyle = '#666666';
                this.ctx.fillRect(drawX + 10, drawY + 10, 65, 65);
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(drawX + 20, drawY + 20);
                this.ctx.lineTo(drawX + 70, drawY + 70);
                this.ctx.moveTo(drawX + 70, drawY + 20);
                this.ctx.lineTo(drawX + 20, drawY + 70);
                this.ctx.stroke();
            }
        } else {
            const sprite = await this.loadSprite(entity.sprite);
            if (sprite) {
                this.ctx.drawImage(sprite, drawX, drawY, this.spriteCellSize, this.spriteCellSize);
            } else {
                this.ctx.fillStyle = entity.isPlayer ? '#44ff44' : '#ff4444';
                this.ctx.fillRect(drawX + 10, drawY + 10, 65, 65);
            }
        }
        
        // Рисуем ВСЕ вспышки урона
        for (const anim of anims) {
            if (anim.type === 'damage') {
                const centerX = drawX + this.spriteCellSize / 2;
                const centerY = drawY + this.spriteCellSize / 2;
                const outerRadius = this.spriteCellSize * 0.4;
                const innerRadius = outerRadius * 0.4;
                const spikes = 5;
                
                this.ctx.fillStyle = anim.data.color;
                this.ctx.globalAlpha = 0.6;
                
                // Рисуем звезду
                this.ctx.beginPath();
                let rot = Math.PI / 2 * 3;
                const step = Math.PI / spikes;
                
                for (let i = 0; i < spikes; i++) {
                    let x = centerX + Math.cos(rot) * outerRadius;
                    let y = centerY + Math.sin(rot) * outerRadius;
                    this.ctx.lineTo(x, y);
                    rot += step;
                    
                    x = centerX + Math.cos(rot) * innerRadius;
                    y = centerY + Math.sin(rot) * innerRadius;
                    this.ctx.lineTo(x, y);
                    rot += step;
                }
                
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.globalAlpha = 1.0;
            }
        }
        
        // Рисуем щит при блоке (только один, так как блок не накладывается)
        const blockAnim = anims.find(anim => anim.type === 'block');
        if (blockAnim) {
            this.ctx.fillStyle = '#888888';
            this.ctx.fillRect(drawX + 15, drawY + 15, 55, 55);
            this.ctx.strokeStyle = '#cccccc';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(drawX + 15, drawY + 15, 55, 55);
            this.ctx.fillStyle = '#dddddd';
            this.ctx.font = '40px "Font Awesome 6 Free"';
            this.ctx.fillText('🛡️', drawX + 25, drawY + 65);
        }
    }
    
    drawHealthBar(x, y, current, max) {
        const width = this.spriteCellSize;
        const height = 5;
        const percent = max > 0 ? (current / max) * 100 : 0;
        
        // Рамка
        this.ctx.fillStyle = '#333333';
        this.ctx.fillRect(x, y, width, height);
        
        // Здоровье (всегда красное)
        const healthWidth = (width * percent) / 100;
        this.ctx.fillStyle = '#ff3333';
        this.ctx.fillRect(x, y, healthWidth, height);
    }
    
    async drawEntityBlock(x, y, entity) {
        const blockWidth = 110;
        const blockHeight = 50;
        
        // Рамка блока
        this.ctx.strokeStyle = '#444';
        this.ctx.strokeRect(x, y, blockWidth, blockHeight);
        
        // Спрайт 50×50
        if (entity.sprite) {
            const sprite = await this.loadSprite(entity.sprite);
            if (sprite) {
                this.ctx.drawImage(sprite, x + 5, y + 2, 46, 46);
            }
        }
        
        // Текст HP в две строки
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = 'bold 16px monospace';
        this.ctx.textAlign = 'right';
        
        // Максимальное здоровье (сверху)
        this.ctx.fillText(`${entity.maxHealth}`, x + 100, y + 20);
        
        // Текущее здоровье (снизу)
        this.ctx.fillText(`${entity.health}`, x + 100, y + 40);
    }

    async drawEntityBlocks(startX, startY, entities, maxCols, maxRows) {
        const blockWidth = 110;
        const blockHeight = 50;
        
        for (let row = 0; row < maxRows; row++) {
            for (let col = 0; col < maxCols; col++) {
                const index = row * maxCols + col;
                if (index >= entities.length) return;
                
                const x = startX + (col * blockWidth);
                const y = startY + (row * blockHeight);
                
               await this.drawEntityBlock(x, y, entities[index]);
            }
        }
    }

    async drawBottomPanel() {
        const y = this.canvas.height - this.bottomBarHeight;
        
        // Фон нижней панели
        this.ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
        this.ctx.fillRect(0, y, this.canvas.width, this.bottomBarHeight);
        
        // Портрет игрока (слева, 100×150)
        const player = this.game.player;

        // Фон под портретом (всегда)
        this.ctx.fillStyle = '#2f1239';
        this.ctx.fillRect(0, y, 100, this.bottomBarHeight);
        this.ctx.strokeStyle = '#666';
        this.ctx.strokeRect(0, y, 100, this.bottomBarHeight);

        // Портрет поверх фона (если есть)
        if (player && player.portrait) {
            const img = await this.loadSprite(player.portrait);
            if (img) {
                this.ctx.drawImage(img, 0, y, 100, this.bottomBarHeight);
            }
        }
        
        // ===== 3. СЕТКА СПОСОБНОСТЕЙ (посередине, 12×3) =====
        const startX = 100; // начинаем после портрета
        const abilityCols = 12;
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 1;
        
        for (let row = 0; row < this.abilityRows; row++) {
            for (let col = 0; col < abilityCols; col++) {
                const x = startX + (col * this.abilityCellSize);
                const cellY = y + (row * this.abilityCellSize);
                
                this.ctx.strokeRect(x, cellY, this.abilityCellSize, this.abilityCellSize);
                
                const abilityIndex = row * abilityCols + col;
                if (this.abilities[abilityIndex]) {
                    const ability = this.abilities[abilityIndex];
                    if (ability.icon) {
                     const img = await this.loadSprite(ability.icon);
                        if (img) {
                            this.ctx.drawImage(img, x, cellY, 50, 50);
                        } else {
                            // Заглушка
                            this.ctx.fillStyle = '#3949ab';
                            this.ctx.fillRect(x + 5, cellY + 5, 40, 40);
                        }
                    } else {
                        // Заглушка
                        this.ctx.fillStyle = '#3949ab';
                        this.ctx.fillRect(x + 5, cellY + 5, 40, 40);
                    } 
                    const canUse = ability.canUse(this.game.player);
                    if (!canUse.success) {
                        // Затемнение поверх ячейки
                        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                        this.ctx.fillRect(x, cellY, 50, 50);
                    }  
                    // Кулдаун
                    if (ability.currentCooldown > 0) {
                        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                        this.ctx.fillRect(x, cellY, this.abilityCellSize, this.abilityCellSize);
                        this.ctx.fillStyle = '#ffaa44';
                        this.ctx.font = 'bold 16px monospace';
                        this.ctx.fillText(
                            ability.currentCooldown,
                            x + 18, cellY + 35
                        );
                    }
                }
            }
        }
        
        // ===== 4. ПОДСВЕТКА ВЫБРАННОЙ СПОСОБНОСТИ (с учетом сдвига) =====
        if (this.selectedAction && this.selectedAction.type === 'ability') {
            const ability = this.selectedAction.data;
            const index = this.abilities.indexOf(ability);
            
            if (index !== -1) {
                const row = Math.floor(index / 12);
                const col = index % 12;
                const x = startX + (col * this.abilityCellSize);
                const cellY = y + (row * this.abilityCellSize);
                
                // Заливка желтым с прозрачностью
                this.ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                this.ctx.fillRect(x, cellY, this.abilityCellSize, this.abilityCellSize);
            }
        }
    }
    
    drawTargetHighlight() {
        if (!this.selectedTarget) return;
        
        const startX = this.sideColumnWidth;
        const startY = this.topBarHeight;
        
        const target = this.playerTeam.find(p => p.id === this.selectedTarget) ||
                      this.enemyTeam.find(e => e.id === this.selectedTarget);
        
        if (!target || target.gridX === undefined) return;
        
        const x = startX + (target.gridX * this.spriteCellSize) + 
                 (target.isEnemy ? 4 * this.spriteCellSize : 0);
        const y = startY + (target.gridY * this.spriteCellSize);
        
        // Пульсирующая рамка
        const pulse = Math.sin(Date.now() / 200) * 2 + 2;
        this.ctx.strokeStyle = '#ffaa44';
        this.ctx.lineWidth = pulse;
        this.ctx.strokeRect(x, y, this.spriteCellSize, this.spriteCellSize);
    }
    
    // ========== ОБРАБОТКА КЛИКОВ ==========
    
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;
       
        if (canvasY < this.topBarHeight) {
            this.handleTopBarClick(canvasX, canvasY);
        } else if (canvasY > this.canvas.height - this.bottomBarHeight) {
            this.handleBottomClick(
                canvasX, 
                canvasY - (this.canvas.height - this.bottomBarHeight)
            );
        } else if (canvasX < this.sideColumnWidth || 
                   canvasX > this.canvas.width - this.sideColumnWidth) {
            this.handleSideClick(
                canvasX - (canvasX < this.sideColumnWidth ? 0 : this.canvas.width - this.sideColumnWidth),
                canvasY - this.topBarHeight
            );
        } else {
            this.handleCenterClick(
                canvasX - this.sideColumnWidth,
                canvasY - this.topBarHeight
            );
        }
    }
    
    handleCenterClick(offsetX, offsetY) {
        const col = Math.floor(offsetX / this.spriteCellSize);
        const row = Math.floor(offsetY / this.spriteCellSize);
        
        if (col < 0 || col >= 8 || row < 0 || row >= 3) return;
        
        let clickedEntity = null;
        
        if (col < 4) {
            // Левая половина - игроки
            clickedEntity = this.playerTeam.find(p => p.gridX === col && p.gridY === row);
        } else {
            // Правая половина - враги
            clickedEntity = this.enemyTeam.find(e => e.gridX === col - 4 && e.gridY === row);
        }
        
        if (!clickedEntity) return;
        
        if (clickedEntity.isCorpse) {
            // Показываем модалку для трупа
            this.showCorpseLootModal(clickedEntity.id);
            return;
        }
        
        this.selectedTarget = clickedEntity.id;
               
        this.render();
    }
    
    handleBottomClick(offsetX, offsetY) {
        const startX = 100;
        const adjustedX = offsetX - startX;
        console.log('offsetX =', offsetX, 'adjustedX =', adjustedX);
        if (adjustedX < 0) return;
        
        const col = Math.floor(adjustedX / this.abilityCellSize);  
        const row = Math.floor(offsetY / this.abilityCellSize);
        
        if (col < 0 || col >= 12 || row < 0 || row >= this.abilityRows) return;
            
        const index = row * 12 + col;
        if (this.abilities[index]) {
            const ability = this.abilities[index];
            if (ability.currentCooldown === 0) {
                this.selectedAction = {
                    type: 'ability',
                    data: ability
                };
                this.eventBus?.emit('log:add', {
                    message: `🎯 Вы приготовили ${ability.name}`,
                    type: 'info'
                });
                
                // Отправляем выбранное действие в CombatSystem
                this.eventBus?.emit('combat:playerSelectedAction', {
                    action: this.selectedAction
                });
            }
        }
        
        this.render();
    }
    
    handleTopBarClick(x, y) {
        // TODO: опционально
    }
    
    handleSideClick(x, y) {
        // TODO: опционально
    }
    
    showCorpseLootModal(corpseId) {
        // Создаем модалку
        const modal = document.createElement('div');
        modal.className = 'corpse-loot-modal';
        modal.innerHTML = `
            <h3>Труп</h3>
            <button class="loot-all-btn">📦 Взять всё</button>
            <button class="pickup-corpse-btn">🎒 Поднять труп</button>
            <button class="close-btn">✕ Закрыть</button>
        `;
        
        document.body.appendChild(modal);
        
        // Обработчики
        modal.querySelector('.loot-all-btn').addEventListener('click', () => {
            this.eventBus?.emit('corpse:lootAll', { corpseId });
            modal.remove();
        });
        
        modal.querySelector('.pickup-corpse-btn').addEventListener('click', () => {
            this.eventBus?.emit('corpse:pickup', { corpseId });
            modal.remove();
        });
        
        modal.querySelector('.close-btn').addEventListener('click', () => {
            modal.remove();
        });
        
        // Закрытие по клику вне модалки
        setTimeout(() => {
            document.addEventListener('click', function closeHandler(e) {
                if (!modal.contains(e.target)) {
                    modal.remove();
                    document.removeEventListener('click', closeHandler);
                }
            });
        }, 10);
    }
    
    destroy() {
        if (this.eventBus) {
            this.eventBus.off('battle:start', this.onBattleStart);
            this.eventBus.off('battle:update', this.onBattleUpdate);
            this.eventBus.off('battle:end', this.onBattleEnd);
        }
        
        this.canvas.removeEventListener('click', this.handleClick);
        this.backgrounds.clear();
        this.sprites.clear();
        this.animations.clear();
    }
}

export { BattleCanvas };
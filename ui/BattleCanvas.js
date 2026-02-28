// ui/BattleCanvas.js
/**
 * BattleCanvas - графический движок для боя
 * Полностью независимый компонент, заменяет BattleUI
 * 
 * Размер: 900×507
 * Центральная область: ячейки 85×85 для спрайтов (8×3)
 * Нижняя панель: сетка 50×50 (18×3 ячейки) для умений/пояса
 */

class BattleCanvas {
    constructor(canvasId, game) {
        this.game = game;
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
        this.onPlayerAction = this.onPlayerAction.bind(this);
        
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
        this.render();
    }
    
    hide() {
        this.canvas.style.display = 'none';
        this.isVisible = false;
    }
    
    // ========== АНИМАЦИИ ==========
    
    triggerAttack(attackerId) {
        this.animations.set(attackerId, {
            type: 'attack',
            timer: 12, 
            data: { offsetX: 0, offsetY: 0 }
        });
    }
    
    triggerDamage(targetId, damageType) {
        // Определяем цвет в зависимости от типа урона
        let color;
        if (damageType === 'critical') {
            color = '#8b0000'; // темно-красный для критического урона
        } else if (damageType === 'physical') {
            color = '#ff0000'; // красный для физического урона
        } else if (damageType === 'magical') {
            color = '#0066ff'; // синий для магического урона
        } else {
            color = '#ff0000'; // по умолчанию красный
        }
        
        // Добавляем анимацию
        this.animations.set(targetId, {
            type: 'damage',
            timer: 12,
            data: { 
                color: color,
                shake: true 
            }
        });
    }
    
    triggerBlock(targetId) {
        this.animations.set(targetId, {
            type: 'block',
            timer: 10, // 10 кадров = ~0.5 сек при 60fps
        });
    }
    
    triggerEvade(targetId) {
        this.animations.set(targetId, {
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
        for (const [id, anim] of this.animations.entries()) {
            anim.timer--;
            if (anim.timer <= 0) {
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
        this.selectedAbility = null;
        this.selectedAction = null;
        this.selectedTarget = null;
        this.animations.clear();
        this.hide();
    }
    
    onPlayerAction(data) {
        if (data.actionType === 'attack' && data.result) {
            const result = data.result;
            
            // Анимация атаки для игрока
            this.triggerAttack(this.game.player.id);
            
            // Анимация для цели
            if (result.hit) {
                if (result.blocked) {
                    this.triggerBlock(result.targetId);
                } else if (result.evaded) {
                    this.triggerEvade(result.targetId);
                } else {
                    this.triggerDamage(result.targetId, result.damageType || 'physical');
                }
            }
        }
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
        this.abilities = abilityService.getAvailableAbilitiesForCharacter(player);
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
        this.drawTopBar();
        this.drawLeftColumn();
        this.drawRightColumn();
        await this.drawCenterSprites();
        this.drawBottomPanel();
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
    
    drawTopBar() {
        const barY = 0;
        
        // Левая часть (информация об игроке)
        this.ctx.fillStyle = 'rgba(30, 30, 46, 0.8)';
        this.ctx.fillRect(0, barY, 450, this.topBarHeight);
        
        // Правая часть (информация о врагах)
        this.ctx.fillStyle = 'rgba(46, 30, 30, 0.8)';
        this.ctx.fillRect(450, barY, 450, this.topBarHeight);
        
        // Разделитель
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(450, barY);
        this.ctx.lineTo(450, barY + this.topBarHeight);
        this.ctx.stroke();
    }
    
    drawLeftColumn() {
        const x = 0;
        const y = this.topBarHeight;
        
        this.ctx.fillStyle = 'rgba(30, 30, 46, 0.8)';
        this.ctx.fillRect(x, y, this.sideColumnWidth, this.centerHeight);
        
        // TODO: статы игрока
    }
    
    drawRightColumn() {
        const x = this.canvas.width - this.sideColumnWidth;
        const y = this.topBarHeight;
        
        this.ctx.fillStyle = 'rgba(46, 30, 30, 0.8)';
        this.ctx.fillRect(x, y, this.sideColumnWidth, this.centerHeight);
        
        // TODO: информация о врагах (количество, уровень)
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
        const anim = this.animations.get(entity.id);
        let drawX = x;
        let drawY = y;
        let spriteToDraw = entity.sprite;
        
        // Применяем анимации
        if (anim) {
            switch (anim.type) {
                    
                case 'damage':
                    // Вспышка + встряхивание
                    if (anim.data.shake) {
                        drawX += (Math.random() * 8) - 4;
                        drawY += (Math.random() * 8) - 4;
                    }
                    // Вспышка будет применена после отрисовки спрайта
                    break;
                    
                case 'evade':
                    // Вертикальное смещение
                    drawY += anim.data.offsetY;
                    break;
                    
                case 'block':
                    // Будет нарисован щит после спрайта
                    break;
            }
        }
        
        // Рисуем спрайт
        if (entity.isCorpse) {
            // Для трупов рисуем крест или специальный спрайт
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
        } else {
            const sprite = await this.loadSprite(entity.sprite);
            if (sprite) {
                this.ctx.drawImage(sprite, drawX, drawY, this.spriteCellSize, this.spriteCellSize);
            } else {
                // Заглушка
                this.ctx.fillStyle = entity.isPlayer ? '#44ff44' : '#ff4444';
                this.ctx.fillRect(drawX + 10, drawY + 10, 65, 65);
            }
        }
        
        // Применяем вспышку урона
        if (anim && anim.type === 'damage') {
            this.ctx.fillStyle = anim.data.color;
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();
            this.ctx.arc(drawX + this.spriteCellSize/2, drawY + this.spriteCellSize/2, 
                        this.spriteCellSize/2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
        }
        
        // Рисуем щит при блоке
        if (anim && anim.type === 'block') {
            this.ctx.fillStyle = '#888888';
            this.ctx.fillRect(drawX + 15, drawY + 15, 55, 55);
            this.ctx.strokeStyle = '#cccccc';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(drawX + 15, drawY + 15, 55, 55);
            // Рисуем символ щита
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
    
    async drawBottomPanel() {
        const y = this.canvas.height - this.bottomBarHeight;
        
        // Фон нижней панели
        this.ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
        this.ctx.fillRect(0, y, this.canvas.width, this.bottomBarHeight);
        
        // Портрет игрока (слева, 100×150)
        const player = this.game.player;
        if (player && player.portrait) {
            const img = await this.loadSprite(player.portrait);
            if (img) {
                this.ctx.drawImage(img, 0, y, 100, this.bottomBarHeight);
            } else {
                // Заглушка
                this.ctx.fillStyle = '#2a2a2a';
                this.ctx.fillRect(0, y, 100, this.bottomBarHeight);
                this.ctx.strokeStyle = '#666';
                this.ctx.strokeRect(0, y, 100, this.bottomBarHeight);
            }
        } else {
            // Заглушка
            this.ctx.fillStyle = '#2a2a2a';
            this.ctx.fillRect(0, y, 100, this.bottomBarHeight);
            this.ctx.strokeStyle = '#666';
            this.ctx.strokeRect(0, y, 100, this.bottomBarHeight);
        }
        
        // ===== 2. ОБЛАСТЬ ПОЯСА (справа, 200×150) =====
        const beltX = this.canvas.width - 200;
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(beltX, y, 200, this.bottomBarHeight);
        // TODO: сюда потом вставим готовый BeltUI
        
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
                const row = Math.floor(index / abilityCols);
                const col = index % abilityCols;
                const x = startX + (col * this.abilityCellSize);
                const cellY = y + (row * this.abilityCellSize);
                
                this.ctx.strokeStyle = '#ffaa44';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(x, cellY, this.abilityCellSize, this.abilityCellSize);
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
        
        // Определяем зону клика
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
        const col = Math.floor(offsetX / this.abilityCellSize);
        const row = Math.floor(offsetY / this.abilityCellSize);
        
        if (col < 0 || col >= 12 || row < 0 || row >= this.abilityRows)  return;
            
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
                    
                this.eventBus?.emit('combat:playerSelectedAction', {
                    action: this.selectedAction
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
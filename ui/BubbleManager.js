// ui/BubbleManager.js

/**
 * BubbleManager - управляет всплывающими облачками с текстом над сущностями
 * Используется для приветствий NPC, эмоций врагов и других временных сообщений
 */
class BubbleManager {
    constructor(graphicsEngine) {
        this.graphicsEngine = graphicsEngine;
        this.canvas = graphicsEngine?.canvas;
        this.activeBubbles = new Map(); // entityId -> { element, timer, entity }
        this.bubbleContainer = null;
        
        this.injectStyles();
        this.createContainer();
    }
    
    /**
     * Создать контейнер для облачков
     */
    createContainer() {
        this.bubbleContainer = document.createElement('div');
        this.bubbleContainer.id = 'bubble-container';
        this.bubbleContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 5000;
        `;
        
        // Добавляем контейнер в родителя canvas
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.style.position = 'relative';
            this.canvas.parentNode.appendChild(this.bubbleContainer);
        } else {
            document.body.appendChild(this.bubbleContainer);
        }
    }
    
    /**
     * Внедрить стили для облачков
     */
    injectStyles() {
        const styleId = 'bubble-manager-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .entity-bubble {
                position: absolute;
                max-width: 200px;
                padding: 8px 12px;
                border-radius: 16px;
                font-family: 'Segoe UI', sans-serif;
                font-size: 14px;
                font-weight: bold;
                line-height: 1.4;
                text-align: center;
                word-wrap: break-word;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                pointer-events: none;
                z-index: 5001;
                transform: translateX(-50%);
                animation: bubbleFadeIn 0.2s ease-out;
                transition: opacity 0.3s ease-out, transform 0.2s ease-out;
            }
            
            .entity-bubble.fading {
                opacity: 0;
                transform: translateX(-50%) translateY(-5px);
            }
            
            .entity-bubble::after {
                content: '';
                position: absolute;
                bottom: -8px;
                left: 50%;
                transform: translateX(-50%);
                width: 0;
                height: 0;
                border-left: 8px solid transparent;
                border-right: 8px solid transparent;
                border-top: 8px solid;
                filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.2));
            }
            
            /* Стиль для NPC (дружелюбные) */
            .entity-bubble.npc-bubble {
                background: rgba(30, 40, 60, 0.95);
                color: #4ecdc4;
                border: 1px solid #4ecdc4;
            }
            
            .entity-bubble.npc-bubble::after {
                border-top-color: #4ecdc4;
            }
            
            /* Стиль для врагов (агрессивные) */
            .entity-bubble.enemy-bubble {
                background: rgba(60, 30, 30, 0.95);
                color: #ffffff;
                border: 1px solid #ff6b6b;
            }
            
            .entity-bubble.enemy-bubble::after {
                border-top-color: #ff6b6b;
            }
            
            @keyframes bubbleFadeIn {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Показать облачко с текстом над сущностью
     * @param {Object} entity - сущность (NPC или враг)
     * @param {string} text - текст для отображения
     * @param {number} duration - длительность в мс (по умолчанию 4000)
     */
    showBubble(entity, text, duration = 3000) {
        if (!entity || !text) return;
        if (!this.bubbleContainer) this.createContainer();
        
        // Удаляем старое облачко для этой сущности
        this.hideBubble(entity.id);
        
        // Определяем тип облачка
        const isNPC = entity.isNPC && entity.isNPC();
        const bubbleClass = isNPC ? 'entity-bubble npc-bubble' : 'entity-bubble enemy-bubble';
        
        // Создаем элемент
        const bubble = document.createElement('div');
        bubble.className = bubbleClass;
        bubble.textContent = text;
        
        // Получаем позицию
        const position = this.getEntityScreenPosition(entity);
        if (!position) return;
        
        // Устанавливаем позицию (временно скрыто, чтобы измерить высоту)
        bubble.style.visibility = 'hidden';
        this.bubbleContainer.appendChild(bubble);
        
        const bubbleHeight = bubble.offsetHeight;
        
        // Позиционируем над спрайтом
        bubble.style.left = position.x + 'px';
        bubble.style.top = (position.y - bubbleHeight - 48) + 'px';
        bubble.style.visibility = 'visible';
        
        // Сохраняем
        const timer = setTimeout(() => {
            this.hideBubble(entity.id);
        }, duration);
        
        this.activeBubbles.set(entity.id, {
            element: bubble,
            timer: timer,
            entity: entity
        });
    }
    
    /**
     * Показать случайное приветствие из массива greetings
     * @param {Object} entity - сущность с полем greetings
     */
    showGreeting(entity) {
        if (!entity || !entity.greetings) return;
        
        let greeting = null;
        if (Array.isArray(entity.greetings) && entity.greetings.length > 0) {
            const randomIndex = Math.floor(Math.random() * entity.greetings.length);
            greeting = entity.greetings[randomIndex];
        } else if (typeof entity.greetings === 'string') {
            greeting = entity.greetings;
        }
        
        if (greeting) {
            this.showBubble(entity, greeting, 5000);
        }
    }
    
    /**
     * Получить экранные координаты сущности
     * @param {Object} entity - сущность с gridX и gridY
     * @returns {Object|null} { x, y } или null
     */
    getEntityScreenPosition(entity) {
        if (!this.canvas) {
            console.warn('BubbleManager: canvas не найден');
            return null;
        }
        
        // Получаем позицию из GraphicsEngine если есть метод
        if (this.graphicsEngine && typeof this.graphicsEngine.getEntityScreenPosition === 'function') {
            return this.graphicsEngine.getEntityScreenPosition(entity);
        }
        
        // Fallback: вычисляем сами
        const cellSize = this.graphicsEngine?.cellSize || 85;
        const gridX = entity.gridX ?? 0;
        const gridY = entity.gridY ?? 0;
        const width = entity.width || 85;
        const height = entity.height || 85;
        
        // Координаты внутри canvas
        const offsetX = (cellSize - width) / 2;
        const canvasX = gridX * cellSize + offsetX + width / 2;
        const canvasY = gridY * cellSize;
        
        // Конвертируем в экранные координаты
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / this.canvas.width;
        const scaleY = rect.height / this.canvas.height;
        
        const screenX = rect.left + canvasX * scaleX;
        const screenY = rect.top + canvasY * scaleY;
        
        return { x: screenX, y: screenY };
    }
    
    /**
     * Скрыть облачко для конкретной сущности
     * @param {string} entityId - ID сущности
     */
    hideBubble(entityId) {
        const bubbleData = this.activeBubbles.get(entityId);
        if (!bubbleData) return;
        
        clearTimeout(bubbleData.timer);
        
        // Плавное исчезновение
        bubbleData.element.classList.add('fading');
        setTimeout(() => {
            if (bubbleData.element.parentNode) {
                bubbleData.element.remove();
            }
        }, 100);
        
        this.activeBubbles.delete(entityId);
    }
    
    /**
     * Скрыть все облачка (мгновенно, для смены комнаты)
     */
    hideAllBubbles() {
        for (const [entityId, bubbleData] of this.activeBubbles) {
            clearTimeout(bubbleData.timer);
            if (bubbleData.element.parentNode) {
                bubbleData.element.remove();  // мгновенное удаление
            }
        }
        this.activeBubbles.clear();
    }
    
    /**
     * Показать приветствия для всех сущностей в комнате
     * @param {Array} entities - массив сущностей
     */
    showGreetingsForRoom(entities) {
        if (!entities || entities.length === 0) return;
        
        // Показываем с небольшой задержкой между облачками
        let delay = 0;
        for (const entity of entities) {
            if (entity.greetings) {
                setTimeout(() => {
                    this.showGreeting(entity);
                }, delay);
                delay += 300; // 300ms между облачками
            }
        }
    }
    
    /**
     * Обновить позиции всех активных облачков (при ресайзе/скролле)
     */
    updatePositions() {
        for (const [entityId, bubbleData] of this.activeBubbles) {
            const position = this.getEntityScreenPosition(bubbleData.entity);
            if (!position) continue;
            
            const bubble = bubbleData.element;
            const bubbleHeight = bubble.offsetHeight;
            
            bubble.style.left = position.x + 'px';
            bubble.style.top = (position.y - bubbleHeight - 10) + 'px';
        }
    }
    
    /**
     * Уничтожить менеджер
     */
    destroy() {
        this.hideAllBubbles();
        if (this.bubbleContainer && this.bubbleContainer.parentNode) {
            this.bubbleContainer.remove();
        }
        this.bubbleContainer = null;
    }
}

export { BubbleManager };
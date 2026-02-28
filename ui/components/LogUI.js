// ui/components/LogUI.js
/**
 * LogUI - улучшенная версия с иконками как в старом UIManager
 */
class LogUI {
    constructor(container, eventBus, maxEntries = 150) {
        this.container = container;
        this.eventBus = eventBus;
        this.maxEntries = maxEntries;
        this.unsubscribeFunctions = [];
    }
    
    init() {
        this.render();
        this.subscribeToEvents();
        return this;
    }
    
    subscribeToEvents() {
        const logAdd = this.eventBus.on('log:add', (data) => this.addEntry(data.message, data.type));
        const logBatch = this.eventBus.on('log:batch', (messages) => this.addBatch(messages));
        this.unsubscribeFunctions.push(logAdd, logBatch);
    }
    
    getLogIcon(type) {
        const icons = {
            'info': '📝',
            'battle': '⚔️',
            'error': '❌',
            'warning': '⚠️',
            'success': '✅',
            'system': '⚙️',
            'directions': '📍',
            'victory': '🏆',
            'defeat': '💀',
            'time': '🕒'
        };
        return icons[type] || '📝';
    }
    
    addEntry(message, type = 'info') {
        if (!this.container || !message) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        
        const icon = this.getLogIcon(type);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        entry.innerHTML = `
            <span class="log-time">[${time}]</span>
            <span class="log-icon">${icon}</span>
            <span class="log-message">${this.escapeHtml(message)}</span>
        `;
        
        this.container.appendChild(entry);
        this.scrollToBottom();
        
        const entries = this.container.querySelectorAll('.log-entry');
        if (entries.length > this.maxEntries) {
            entries[0].remove();
        }
    }
    
    addBatch(messages) {
        if (!Array.isArray(messages)) return;
        
        const fragment = document.createDocumentFragment();
        
        messages.forEach(msg => {
            const entry = document.createElement('div');
            const type = msg.type || 'info';
            const icon = this.getLogIcon(type);
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            entry.className = `log-entry log-${type}`;
            entry.innerHTML = `
                <span class="log-time">[${time}]</span>
                <span class="log-icon">${icon}</span>
                <span class="log-message">${this.escapeHtml(msg.message || msg)}</span>
            `;
            
            fragment.appendChild(entry);
        });
        
        this.container.appendChild(fragment);
        this.scrollToBottom();
        
        const entries = this.container.querySelectorAll('.log-entry');
        if (entries.length > this.maxEntries) {
            const toRemove = entries.length - this.maxEntries;
            for (let i = 0; i < toRemove; i++) {
                entries[i].remove();
            }
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    scrollToBottom() {
        if (this.container) {
            this.container.scrollTop = this.container.scrollHeight;
        }
    }
    
    render() {
        if (!this.container) return;
        this.container.innerHTML = '';
    }
    
    destroy() {
        this.unsubscribeFunctions.forEach(fn => fn && fn());
        if (this.container) this.container.innerHTML = '';
    }
}

export { LogUI };
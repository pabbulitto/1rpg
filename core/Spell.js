import { AbilityBase } from './AbilityBase.js';

class Spell extends AbilityBase {
    constructor(id, data) {
        super(id, {
            ...data,
            type: 'spell'
        });
        this.school = data.school || 'arcane';
        this.spellLevel = data.spellLevel || 1;
    }
}

export { Spell };
import { AbilityBase } from './AbilityBase.js';

class Skill extends AbilityBase {
    constructor(id, data) {
        super(id, {
            ...data,
            type: 'skill'
        });
        this.skillType = data.skillType || 'combat';
    }
}

export { Skill };
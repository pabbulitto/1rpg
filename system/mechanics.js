// system/mechanics.js
export const mechanics = {
    
    dodge: {
        activate(combatSystem, ability, player) {
            const abilityService = window.game?.abilityService;
            if (!abilityService) return;
            
            const params = ability.mechanicParams;
            if (!params) return;
            
            const mastery = abilityService.getMastery(player.id, ability.id) || 0;
            const stats = player.getStats();
            
            const formulaParser = window.game?.formulaParser;
            if (!formulaParser) return;
            
            const context = { mastery, dexterity: stats.dexterity };
            
            const maxDodges = Math.floor(formulaParser.evaluate(params.charges, context));
            const dodgeChance = Math.min(95, formulaParser.evaluate(params.chance, context));
            
            combatSystem.dodgeState = {
                active: true,
                remaining: maxDodges,
                chance: dodgeChance,
                successThisRound: false,
                ability: ability 
            };
            
            combatSystem.playerAction = null;
        },
        
        processAttack(combatSystem, attacker, target) {
            const state = combatSystem.dodgeState;
            if (!state?.active || state.remaining <= 0) return false;
            
            const roll = Math.random() * 100;
            if (roll < state.chance) {
                state.remaining--;
                state.successThisRound = true;
                
                combatSystem.eventBus?.emit('log:add', {
                    message: `✨ Вы уклонились от атаки ${attacker.name}!`,
                    type: 'success'
                });
                
                return true;
            }
            
            return false;
        },
        
        endRound(combatSystem) {
            const state = combatSystem.dodgeState;
            if (!state) return;
            
            if (state.successThisRound && state.ability) {
                state.ability.currentCooldown = 1;
            }
            
            combatSystem.dodgeState = null;
        }
    },
    
    leftHandStrike: {
        modifyAttacks(character, attacks, abilityService) {
            if (!abilityService) return;
            
            const hasSkill = abilityService.getCharacterAbilities(character.id)
                .some(a => a.id === 'удар_левой_рукой');
            
            if (!hasSkill) return;
            
            const mastery = abilityService.getMastery(character.id, 'удар_левой_рукой') || 0;
            
            const secondChance = 30 + mastery;
            let thirdChance = 0;
            if (mastery > 100) {
                thirdChance = Math.floor((mastery - 100) / 3);
            }
            
            const originalLength = attacks.length;
            
            if (Math.random() * 100 < secondChance) {
                attacks.push({
                    hand: 'left',
                    isExtra: true,
                    isSecond: true,
                    isUnarmed: true,
                    isMain: false,
                    isOffhand: true,
                    weapon: null,
                    damageFormula: '1d4',
                    name: 'Удар левой рукой'
                });
                
                if (thirdChance > 0 && Math.random() * 100 < thirdChance) {
                    attacks.push({
                        hand: 'left',
                        isExtra: true,
                        isThird: true,
                        isUnarmed: true,
                        isMain: false,
                        isOffhand: true,
                        weapon: null,
                        damageFormula: '1d4',
                        name: 'Удар левой рукой'
                    });
                }
            }
            
            if (attacks.length > originalLength) {
                abilityService.addMastery(character.id, 'удар_левой_рукой', 0.03);
            }
        }
    }
};
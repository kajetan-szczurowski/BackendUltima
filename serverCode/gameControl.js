const auth = require('./auth.js');
const character = require('./characterManagement.js');

const initiative = [];
let activeInitiativeElement = 0;
const hpList = [];

exports.handleInitiative = function(io, socket){
    socket.on('initiative-entry', entry => {
        if (entry.charAt(0) === '/') {
            initiativeManipulation(entry, io);
            return;
        }
        const id = initiative.length + 1;
        initiative.push({id: id, value: entry});
        io.emit('initiative-order', initiative);

    })

    socket.on('give-me-initiative', () => socket.emit('initiative-order', initiative));
    socket.on('give-me-active-ini', () => {socket.emit('active-initiative-element', activeInitiativeElement)})

    socket.on('initiative-command', payload => {
        const command = payload.command;
        const userID = payload.userID;
        if (!auth.isGM(userID)) return;
        
        switch (command) {
            case 'next': {
                activeInitiativeElement++;
                if (activeInitiativeElement > initiative.length) activeInitiativeElement = 0;
                break;
            }

            case 'previous': {
                activeInitiativeElement--;
                if (activeInitiativeElement < 0) activeInitiativeElement = initiative.length;
                break;
            }
        }
        io.emit('active-initiative-element', activeInitiativeElement);
    })
}

exports.handleCombat = function (io, socket) {
    socket.on('get-hps', () =>{
        socket.emit('update-hps', hpList);
    })

    socket.on('toogle-hp-bar', payload => {
        const {userID, characterID} = {...payload};
        if (!auth.isGM(userID)) return;
        const index = hpList.findIndex(c => c.id === characterID);
        if (index === -1){
            const newHP = character.getHP(characterID);
            hpList.push(newHP);
        }
        else  removeCharacterHP(index);

        io.emit('update-hps', hpList);

    })

    socket.on('change-hp', payload => {
        const {value, max, userID, characterID} = payload;
        if (!auth.checkAuth(userID, characterID)) return;
        if (typeof value !== 'number' || typeof max !== 'number') return;
        if (max < 0 || value < 0 || value > max) return;
        const toChange = hpList.find(hp => hp.id === characterID);
        if (!toChange) return;
        toChange.maxHP = max;
        toChange.currentHP = value;
        io.emit('update-hps', hpList);

    })
}

function removeCharacterHP(arrayIndex){
    const currentCharacter = hpList[arrayIndex];
    character.setHP(currentCharacter.id, {maxHP: currentCharacter.maxHP, currentHP: currentCharacter.currentHP});
    hpList.splice(arrayIndex, 1);
}

function initiativeManipulation(textValue, io){
    if (textValue === '/clear'){
        initiative.splice(0, initiative.length);
        io.emit('initiative-order', initiative);
        return;
    }
    const idToChange = textValue.slice(1, textValue.indexOf('@'));
    const newValue = textValue.slice(textValue.indexOf('@') + 1).trim();
    if (initiative.length < idToChange) return;
    initiative[idToChange - 1] = {id: idToChange, value: newValue};
    io.emit('initiative-order', initiative);
}
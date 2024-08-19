const auth = require('./auth.js');
const character = require('./characterManagement.js');
const crypto = require("crypto");

const initiative = [];
let activeInitiativeElement = 0;
const characterBars = [];
const clocks = [];

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
    socket.on('get-character-bars', () =>{
        socket.emit('character-bars', characterBars);
    })

    socket.on('get-clocks', () =>{
        socket.emit('clocks-data', clocks);
    })

    socket.on('toogle-character-bar', payload => {
        const {userID, characterID} = {...payload};
        if (!auth.isGM(userID)) return;
        const index = characterBars.findIndex(c => c.id === characterID);
        if (index === -1){
            const newBar = character.getCharacterBar(characterID);
            characterBars.push(newBar);
        }
        else  removeCharacterBar(index);

        io.emit('character-bars', characterBars);

    })

    socket.on('change-character-bar', payload => {
        const {value, max, section, userID, characterID} = payload;
        if (section !== 'HP' && section !== 'PM' && section !== 'EP') return;
        if (!auth.checkAuth(userID, characterID)) return;
        if (typeof value !== 'number' || typeof max !== 'number') return;
        if (max < 0 || value < 0 || value > max) return;
        const toChange = characterBars.find(bar => bar.id === characterID);
        if (!toChange) return;
        toChange[section].max = max;
        toChange[section].current = value;
        character.setBars(characterID, exportSavingPayload(toChange));
        io.emit('character-bars', characterBars);
    })

    socket.on('clock-order', payload => {
        const {userID, clockID, order, newLabel, newSegments} = payload;
        if (!auth.isGM(userID)) return;
        if (order === 'append') {addClock(newLabel, newSegments); io.emit('clocks-data', clocks); return};
        const currentClockIndex = clocks.findIndex(cl => cl.id === clockID);
        if (!currentClockIndex && currentClockIndex !== 0) return;
        if (order === 'plus') increaseClock(currentClockIndex);
        if (order === 'minus') decreaseClock(currentClockIndex);
        if (order === 'delete') clocks.splice(currentClockIndex, 1); 
        io.emit('clocks-data', clocks);
    });

}

function exportSavingPayload(barsData){
   return   {maxHP: barsData.HP.max,
            currentHP: barsData.HP.current,
            maxMagic: barsData.PM.max,
            currentMagic: barsData.PM.current,
            maxEP: barsData.EP.max,
            currentEP: barsData.EP.current
            }
}

function addClock(clockLabel, segments){
    const newClock = {
        segments: segments,
        completedSegments: 0,
        id: crypto.randomBytes(8).toString("hex"),
        label: clockLabel
    }

    clocks.push(newClock);
}

function increaseClock(arrayID){
    const currentClock = clocks[arrayID];
    if (currentClock.completedSegments >= currentClock.segments) return;
    currentClock.completedSegments++;
    return;
}

function decreaseClock(arrayID){
    const currentClock = clocks[arrayID];
    if (currentClock.completedSegments <= 0) return;
    currentClock.completedSegments--;
    return;
}

function removeCharacterBar(arrayIndex){
    // const currentCharacter = characterBars[arrayIndex];
    // character.setHP(currentCharacter.id, {maxHP: currentCharacter.maxHP, currentHP: currentCharacter.currentHP});
    characterBars.splice(arrayIndex, 1);
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
const fs = require('fs');
const db = require('./database')
const auth = require('./auth');
const crypto = require("crypto");

const characters = [];
let charactersMap;
characterManagerInitialization();

const charactersToSave = [];
const SAVE_CHARACTERS_INTERVAL_SECONDS = 30;
const MAX_INPUT_LENGTH = 30;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_LABEL_LENGTH = 100;


setInterval(saveCharactersManager, SAVE_CHARACTERS_INTERVAL_SECONDS * 1000)

async function characterManagerInitialization(){
  // console.log('dzienDobry');
  charactersMap = await getCharactersIDMapLocal();
  // console.log(charactersMap)
  await initialLoadCharacters();
  // const ahaID = await findDBid('420');
  // const dataBaseID = await findDBid('420');
  // enqueueCharacterToSave(dataBaseID, miron);
  // db.saveCharacter(ahaID, miron)
}

function saveCharactersManager(){
  const toDelete = [];

  charactersToSave.forEach(character => {
    // if (character.order = 'save-to-db') db.saveCharacter(character.id, character.data);
    toDelete.push(character.id);
  });

  toDelete.forEach(id => {
    deleteCharacterSaveOrder(id);
  });

}

function deleteCharacterSaveOrder(id){
  const index = charactersToSave.findIndex(c => c.id === id);
  charactersToSave.splice(index, 1);
}

function enqueueCharacterToSave(id, data){
  while (charactersToSave.find(character => character.id === id)) deleteCharacterSaveOrder(id);
  charactersToSave.push({order: 'save-to-db', id: id, data: data});

}

async function getCharactersIDMapLocal(){

    // DEVELOPEMENT MODE:
    const defaultData = [
      {name: 'Linan',   _id: '420', id: '420'},
      {name: 'Kuka',   _id: '69', id: '69'},
      {name: 'Profesor',   _id: '1312', id: '1312'},
      {name: 'Kokuen',   _id: '666', id: '666'}
    ];

    return defaultData;
  

  const data = await db.getCharactersMap();
  if (!data) return defaultData;
  if (!Array.isArray(data)) return defaultData;
  const fromData = data[0];
  if (!fromData.hasOwnProperty('map')) return defaultData;
  return fromData.map;
}

exports.getCharactersIDMap = async function(){

  if (charactersMap) return charactersMap;

  const data = await getCharactersIDMapLocal();
  if(data) return data;
  return [];

}

exports.getHP = function(id){
  const currentCharacter = characters.find(c => c.id === id);
  if (!currentCharacter) return;
  const thumbnail = currentCharacter.thumbnail? currentCharacter.thumbnail : currentCharacter.about.graphic;
  const maxHP = currentCharacter.maxHP? currentCharacter.maxHP : 37;
  const currentHP = currentCharacter.currentHP? currentCharacter.currentHP : 21;
  return {id: id, graphicUrl: thumbnail, maxHP: maxHP, currentHP: currentHP, name: currentCharacter.name};
}

exports.setHP = function(characterID, hpPaylaod){
  const currentCharacter = characters.find(c => c.id === characterID);
  if (!currentCharacter) return;
  currentCharacter.maxHP = hpPaylaod.maxHP;
  currentCharacter.currentHP = hpPaylaod.currentHP;
  saveCharacter(characterID, currentCharacter);
}

exports.characterMiddleware = function(){
    //Check credentials
  //Check user's autherizations
  return true;
}

exports.getCharacter =  function(id){ // was (id, tokens)
  if (characters.length === 0) initialLoadCharacters();
  return characters.find(c => c.id === id);
}

exports.handleCharactersEdits = function(socket, auth){
  // socket.on('delete-character-attribute', payload => {
  //   const {userID, characterID, attribute, value} = {...payload};
  //   if (!auth.checkAuth(userID, characterID)) return;
  //   const characterToChange = characters.find(c => c.id === characterID || `"${c.id}"` === characterID);
  //   const id = characterToChange.rolls.findIndex(el => el.name === attribute);
  //   characterToChange.rolls.splice(id, 1);
  //   const idToSave = characterID.replaceAll('"', '');
  //   characterToChange.timeStamp = Date.now();
  //   saveCharacter(idToSave, characterToChange);
  //   socket.emit('trigger-refresh');
  //   //TODO: merger with edit-character, delete code duplication

  // })

  socket.on('edit-character-attribute', payload => {
    // const {success, arrayID, value, group, toChange, section} = characterEditMiddleware(payload);
    // console.log(payload)
    const {success, arrayID, value, toChange, section} = characterEditMiddleware(payload);
    // console.log(success, arrayID, value, toChange, section)
    // return
    // const {success, arrayID, value, group, toChange, section} = characterEditMiddleware(payload);
    if (!success) return;
    toChange[arrayID][section] = value;
    console.log(toChange[arrayID])
    socket.emit('trigger-refresh');
  })

  socket.on('delete-character-attribute', payload => {
    const {success, arrayID, toChange} = characterEditMiddleware(payload);
    if (!success) return;
    toChange.splice(arrayID, 1);
    socket.emit('trigger-refresh');
  })

  socket.on('new-character-attribute', payload => {
    console.log(payload)
    const {userID, characterID, attributesGroup, value, label} = {...payload};
    if (!auth.checkAuth(userID, characterID)) return;
    if (!attributesGroup || !value || !label) return;
    const currentCharacter = characters.find(c => c.id === characterID);
    if (!currentCharacter) return;
    const newID = crypto.randomBytes(8).toString("hex");
    const newAttribute = {label: label.substring(0, MAX_LABEL_LENGTH), description: value.substring(0, MAX_DESCRIPTION_LENGTH), id: newID};
    if (attributesGroup === 'skills') newAttribute['investedPoints'] = 0;
    currentCharacter[attributesGroup].push(newAttribute);
    socket.emit('trigger-refresh');
    

  })

  socket.on('update-invested-points', payload => {
    const {userID, characterID, order, assetID} = {...payload};
    // return;
    if (!auth.checkAuth(userID, characterID)) return;
    const currentCharacter = characters.find(c => c.id === characterID);
    if (!currentCharacter) return;
    const currentSkill = currentCharacter.skills.find(skill => skill.id === assetID);
    currentSkill.investedPoints = calculateInvestedPoints(currentSkill.investedPoints, order)
    currentCharacter.timeStamp = Date.now();
    // saveCharacter(characterID, currentCharacter);
    socket.emit('trigger-refresh');
  })



  socket.on('new-roll', payload => { //to delete
    const {label, value, family, userID, characterID} = newRollMiddleware(payload);
    if (!auth.checkAuth(userID, characterID)) return;
    const currentCharacter = characters.find(c => c.id === characterID);
    if (!currentCharacter) return;
    const foundRoll = currentCharacter.rolls.find(roll => roll.name.toLowerCase() === label.toLowerCase() && roll.family === family.toLowerCase());
    if (foundRoll){
       foundRoll.value = value;
       foundRoll.family = family.toLowerCase();
    }
    else currentCharacter.rolls.push({name: label, value: value, family: family.toLowerCase()});
    currentCharacter.timeStamp = Date.now();
    saveCharacter(characterID, currentCharacter);

  })

  socket.on('refresh-character', () => socket.emit('trigger-refresh'));
}

function newRollMiddleware(payload){
  const {label, value, family, userID, characterID} = payload;
  return {
   label: label.substring(0, MAX_INPUT_LENGTH),
   value: value.substring(0, MAX_INPUT_LENGTH),
   family: family.substring(0, MAX_INPUT_LENGTH),
   userID: userID,
   characterID: characterID
  }
}

async function findDBid(characterID){
  const map = await getCharactersIDMapLocal();
  const character = map.find(c => c.id === characterID);
  if (!character) return;
  if (!character.hasOwnProperty('_id')) return;
  return character._id;
}

async function saveCharacter(characterID, characterData){
  //fs.writeFileSync(`./serverCode/data/characters/char-${characterID}.json`, JSON.stringify(characterData));
  const dataBaseID = await findDBid(characterID);
  enqueueCharacterToSave(dataBaseID, characterData);
}

async function initialLoadCharacters(){
  if (!charactersMap) process.exit();
  charactersMap.forEach(character => {
    loadCharacter(character._id);
  });



}

async function loadCharacter(id){
  // const newCharacter = await db.getCharacter(id) ?? loadPlaceholderCharacter(id);
  const newCharacter = loadPlaceholderCharacter(id);
  if (!newCharacter) return;
  characters.push(newCharacter);
  if (newCharacter.name === 'Ercor') console.log(newCharacter.rolls[4])
}

function loadPlaceholderCharacter(id){
  const charactersPath = './serverCode/data/characters';
  const character = JSON.parse(fs.readFileSync(`${charactersPath}/char-${id}.json`, 'utf8'));
  return character;

  // const charactersFiles = fs.readdirSync(charactersPath);
  // charactersFiles.forEach(file => {
    // const character = JSON.parse(fs.readFileSync(charactersPath + '/' + file, 'utf8'));
  // })
}

function characterEditMiddleware(payload){
  const {userID, characterID, value, attributesGroup, attributeID, attributeSection}  = {...payload};
  // console.log(auth.checkAuth(userID, characterID));
  if (!auth.checkAuth(userID, characterID)) return wrongCall();
  const characterToChange = characters.find(c => c.id === characterID || `"${c.id}"` === characterID);
  if (!characterToChange) return wrongCall();
  // console.log('1')
  if (!attributesGroup || !attributeID || !attributeSection) return wrongCall();
  // console.log('2')
  if (!characterToChange.hasOwnProperty(attributesGroup)) return wrongCall();
  // console.log('3')
  const id = characterToChange[attributesGroup].findIndex(el => el.id === attributeID);
  if (!id) if (id !== 0) return wrongCall();
  // console.log('4')
  const newValue = prepareCharacterEditValue(value, attributeSection);

  return {success: true, arrayID: id, value: newValue, group: attributesGroup, toChange: characterToChange[attributesGroup], section: attributeSection};

}
function wrongCall(){
  return {success: false, arrayID: '', value: '', group: '', toChange: null, section: null};
}

function prepareCharacterEditValue(rawValue, section){
  if (!rawValue);
  if (typeof rawValue != 'string');
  if (section === 'description') return rawValue.substring(0, MAX_DESCRIPTION_LENGTH);
  if (section === 'label') return rawValue.substring(0, MAX_LABEL_LENGTH);
  return rawValue;
}

// function compileCharacterEditOrder(order){
//   const splited = order.split('/');
//   if (splited.length < 3) return {group: null, attributeID: null, section: null};
//   return {group: splited[0], attributeID: splited[1], section: splited[2]};
// }

function calculateInvestedPoints(currentPoints, order){
  const DECREASE_ORDER = 'decrease';
  const INCREASE_ORDER = 'increase';
  if (!Number.isInteger(currentPoints)) return 0;
  if (order === DECREASE_ORDER && currentPoints == 0) return 0;
  if (order === DECREASE_ORDER) return currentPoints - 1;
  if (order === INCREASE_ORDER) return currentPoints + 1;
  return currentPoints;
}
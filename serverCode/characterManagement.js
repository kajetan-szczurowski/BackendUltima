const fs = require('fs');
const db = require('./database')
const auth = require('./auth');
const crypto = require("crypto");

const characters = [];
let charactersMap;
characterManagerInitialization();

const charactersToSave = [];
const SAVE_CHARACTERS_INTERVAL_SECONDS = 5;
const MAX_INPUT_LENGTH = 30;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_LABEL_LENGTH = 100;


setInterval(saveCharactersManager, SAVE_CHARACTERS_INTERVAL_SECONDS * 1000)

async function characterManagerInitialization(){
  // console.log('dzienDobry');
  charactersMap = await getCharactersIDMapLocal();
  await initialLoadCharacters();
  // const ahaID = await findDBid('420');
  // const dataBaseID = await findDBid('420');
  // enqueueCharacterToSave(dataBaseID, miron);
  // db.saveCharacter(ahaID, miron)
}

function saveCharactersManager(){
  const toDelete = [];

  charactersToSave.forEach(character => {
    if (character.order = 'save-to-db') db.saveCharacter(character.id, character.data);
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
    // const defaultData = [
    //   {name: 'Linan',   _id: '420', id: '420'},
    //   {name: 'Kuka',   _id: '69', id: '69'},
    //   {name: 'Profesor',   _id: '1312', id: '1312'},
    //   {name: 'Kokuen',   _id: '666', id: '666'}
    // ];

    // return defaultData;
  

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

exports.getCharacterBar = function(id){
  const currentCharacter = characters.find(c => c.id === id);
  if (!currentCharacter) return;
  const thumbnail = currentCharacter.thumbnail? currentCharacter.thumbnail : currentCharacter.graphicUrl;
  const HP = {max: currentCharacter.maxHP? currentCharacter.maxHP : 37, current: currentCharacter.currentHP? currentCharacter.currentHP : 21};
  const PM = {max: currentCharacter.maxMagic? currentCharacter.maxMagic : 37, current: currentCharacter.currentMagic? currentCharacter.currentMagic : 21};
  const EP = {max: currentCharacter.maxEP? currentCharacter.maxEP : 37, current: currentCharacter.currentEP? currentCharacter.currentEP : 21};

  return {id: id, graphicUrl: thumbnail, name: currentCharacter.name, HP: HP, PM: PM, EP: EP};
}

exports.setBars = function(characterID, barsPayload){
  const currentCharacter = characters.find(c => c.id === characterID);
  if (!currentCharacter) return;
  currentCharacter.maxHP = barsPayload.maxHP;
  currentCharacter.currentHP = barsPayload.currentHP;
  currentCharacter.maxEP = barsPayload.maxEP;
  currentCharacter.currentEP = barsPayload.currentEP;
  currentCharacter.maxMagic = barsPayload.maxMagic;
  currentCharacter.currentMagic = barsPayload.currentMagic;
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

  socket.on('edit-character-attribute', payload => {
    // const {success, arrayID, value, group, toChange, section} = characterEditMiddleware(payload);
    // console.log(payload)
    const {success, arrayID, value, toChange, section, characterID, currentCharacter} = characterEditMiddleware(payload);
    // console.log(success, arrayID, value, toChange, section)
    // return
    // const {success, arrayID, value, group, toChange, section} = characterEditMiddleware(payload);
    if (!success) return;
    toChange[arrayID][section] = value;
    // console.log(toChange[arrayID])
    saveCharacter(characterID, currentCharacter);
    socket.emit('trigger-refresh');
  })

  socket.on('delete-character-attribute', payload => {
    const {success, arrayID, toChange, characterID, currentCharacter, group} = characterEditMiddleware(payload);
    if (!arrayID) return;
    if (group === 'about') 
      if (checkDeletionAllowance(toChange[arrayID]?.label)) return;
    if (!success) return;
    toChange.splice(arrayID, 1);
    saveCharacter(characterID, currentCharacter);
    socket.emit('trigger-refresh');
  })

  socket.on('new-character-attribute', payload => {
    const {userID, characterID, attributesGroup, value, label} = {...payload};
    if (!auth.checkAuth(userID, characterID)) return;
    if (!attributesGroup || !value || !label) return;
    const currentCharacter = characters.find(c => c.id === characterID);
    if (!currentCharacter) return;
    const newID = crypto.randomBytes(8).toString("hex");

    const newAttribute = attributesGroup === 'relations'? 
      {label: label.substring(0, MAX_LABEL_LENGTH), id: newID, emotions: [0,0,0]}:
      {label: label.substring(0, MAX_LABEL_LENGTH), description: value.substring(0, MAX_DESCRIPTION_LENGTH), id: newID};

    if (attributesGroup === 'skills') newAttribute['investedPoints'] = 0;
    if (attributesGroup === 'spells'){
      newAttribute['magicCost'] = '???';
      newAttribute['duration'] = '???';
      newAttribute['target'] = '???';
    }

    currentCharacter[attributesGroup]? currentCharacter[attributesGroup].push(newAttribute): currentCharacter[attributesGroup] = [newAttribute];
    saveCharacter(characterID, currentCharacter);
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
    saveCharacter(characterID, currentCharacter);
    socket.emit('trigger-refresh');
  })

  socket.on('new-graphic', payload => {
    const {userID, characterID, value} = {...payload};
    if (!auth.checkAuth(userID, characterID)) return;
    if (!value) return;
    if (value.length > 1000) return;
    const currentCharacter = characters.find(c => c.id === characterID);
    if (!currentCharacter) return;
    currentCharacter.graphicUrl = value;
    saveCharacter(characterID, currentCharacter);
    socket.emit('trigger-refresh');
  })

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
  await Promise.all(charactersMap.map(char => loadCharacter(char._id)));
  // charactersMap.forEach(character => {
  //   loadCharacter(character._id);
  // });



}

async function loadCharacter(id){
  const newCharacter = await db.getCharacter(id) ?? loadPlaceholderCharacter(id);
  // const newCharacter = loadPlaceholderCharacter(id);
  if (!newCharacter) return;
  characters.push(newCharacter);
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

  return {success: true, arrayID: id, value: newValue, group: attributesGroup, toChange: characterToChange[attributesGroup], section: attributeSection, characterID: characterID, currentCharacter: characterToChange};

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



function calculateInvestedPoints(currentPoints, order){
  const DECREASE_ORDER = 'decrease';
  const INCREASE_ORDER = 'increase';
  if (!Number.isInteger(currentPoints)) return 0;
  if (order === DECREASE_ORDER && currentPoints == 0) return 0;
  if (order === DECREASE_ORDER) return currentPoints - 1;
  if (order === INCREASE_ORDER) return currentPoints + 1;
  return currentPoints;
}

function checkDeletionAllowance(sectionName){
  const editBlocked = [['pronounce', 'identity', 'origin', 'theme'], ['level', 'classes'], 
  ['agility', 'power', 'will', 'inside'], ['fabulaPoints', 'initiative', 'armor', 'magicalDefence'] ].flat();
  return editBlocked.includes(sectionName);
}
const axios = require('axios');
require('dotenv').config()

//Mongo DB Actions Endpoints

const READ_ACTION = "find";
const WRITE_ACTION = "insertOne";
const UPDATE_ACTION = "updateOne";
const DELETE_ACTION = "deleteOne";
const actions = [READ_ACTION, WRITE_ACTION, UPDATE_ACTION, DELETE_ACTION];



//DataBase constants

const database = "Lets-Roll-One-15";
const dataSource = "LetsRollOne";
const dbURL = "https://data.mongodb-api.com/app/data-sqxht/endpoint/data/v1/action/";

const dbApiKey = process.env.DB_API_KEY;
const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Request-Headers': '*',
    'api-key': dbApiKey
  };

// Let's roll one constants
const MAP_DB_ID = '641651dcf7086793b9a0c6c9';
const ASSETS_DB_ID = '64165385f7086793b9a0c6ca';
const LRO_MECHANICS_DB_ID = '66c0fca4907af41084c3cf06';
const MAP_URLs_COLLECTION = 'grafiki';
const LRO_MECHANICS_DB_COLLECTION = 'FABULA-ULTIMA-mechanics';



async function databaseRequestMiddleware(action, parameters){
    try{
        const loaded = await databaseRequest(action, parameters);
        return loaded.data.documents;
    }catch(e){
            console.log('error while loading')
            return null;
    }
}

async function readOneDocument(id, collection){
    try {
        const document = await databaseRequest(READ_ACTION, {'_id': id, collection: collection});
        if (!document) return;
        if (!document.hasOwnProperty('data')) return;
        if (!document.data.hasOwnProperty('documents')) return;
        return document.data.documents;
    }catch(e){
        console.log('error while loading')
        return null;
}


}


exports.getCharactersMap = async function(){
    return await databaseRequestMiddleware(READ_ACTION, {'_id': '66c0d1f2907af410848430a0', collection: 'characterStates'});
}

exports.saveCharacter = async function(id, data){
    //Wydobądź _id na podstawie id
    //Dopisz wartości
    // console.log(id, data);
    const toSave = {...data};
    delete toSave['_id'];
    try{
    await databaseRequest(UPDATE_ACTION, {'_id': id, data: toSave, collection: 'characterStates'});
    }catch(error){
        console.log(error)
    }
    // const sent = await databaseRequestMiddleware(UPDATE_ACTION, {'_id': id, data: data, collection: 'characterStates'});
    // console.log(sent);
}

exports.getCharacter = async function(id){
    const character = await readOneDocument(id, 'characterStates');
    if (!character) return;
    return character[0];
}

// exports.getCharactersIDs = async function (){
//     const charactersIDs = await databaseRequest(READ_ACTION, {'_id': IDsSource, collection: 'grafiki'});
//     return charactersIDs;
// }

exports.getMapURLs = async function(order){
    let downloaded;
    switch(order){

        case 'maps':
            downloaded = await readOneDocument(MAP_DB_ID, MAP_URLs_COLLECTION);
            break;
        
        case 'assets':
            downloaded = await readOneDocument(ASSETS_DB_ID, MAP_URLs_COLLECTION);
            break;

        default: return;
    }

    if (!downloaded) return;
    delete downloaded[0]['_id'];
    return downloaded[0];
}

exports.saveMapURLs = async function(order, data){
    switch(order){
        case'maps':
            databaseRequest(UPDATE_ACTION, {'_id': MAP_DB_ID, data: data, collection: MAP_URLs_COLLECTION});
            break;
        
        case 'assets':
            databaseRequest(UPDATE_ACTION, {'_id': ASSETS_DB_ID, data: data, collection: MAP_URLs_COLLECTION});
            break;

        default: return;
    }
}

exports.getAuthorizationData = async function(){
    const downloaded = await readOneDocument(LRO_MECHANICS_DB_ID, LRO_MECHANICS_DB_COLLECTION);
    if (!downloaded) return;

    delete downloaded[0]['_id'];
    return downloaded[0];

}

// exports.getMaps = async function(){
//     const maps = await 
//     delete maps[0]['_id'];
//     return maps[0]
// }

// exports.getAssets = async function(){
//     const maps = await readOneDocument(MAP_DB_ID, 'grafiki');
//     delete maps[0]['_id'];
//     return maps[0]
// }

// exports.getMailsDictionary = async function (){
//     const charactersIDs = await databaseRequest(READ_ACTION, mailsSource);
//     return charactersIDs;
// }

// exports.addNewCharacter = async function(characterData){
//     characterData._id = IDsSource._id;
//     characterData.collection = IDsSource.collection;
//     await databaseRequest(UPDATE_ACTION);
//     return true;
// }

function databaseRequest(order, requestData){
    if (!actions.includes(order)) return;
    if (!requestData.collection) return;

    const data = {
        "collection": requestData.collection,
        "database": database,
        "dataSource": dataSource
}

    let requestURL;
    switch(order){
        case READ_ACTION:
            requestURL = dbURL.concat(READ_ACTION);
            if (requestData.hasOwnProperty("name")) data["filter"] = {"name": requestData.name};
            if (requestData.hasOwnProperty("_id"))  data["filter"] = {"_id": { "$oid": requestData._id} };
            break;

        case DELETE_ACTION:
            requestURL = dbURL.concat(DELETE_ACTION);
            data["filter"] = {"_id": { "$oid": requestData._id} };
            break;

        case WRITE_ACTION:
            requestURL = dbURL.concat(WRITE_ACTION);
            data["document"] = requestData.data;
            break;

        case UPDATE_ACTION:
            requestURL = dbURL.concat(UPDATE_ACTION);
            data["filter"] = {"_id": { "$oid": requestData._id} };
            data["update"] = requestData.data;
            break;
    }

    const config = {
        method: 'post',
        url: requestURL, 
        headers: headers,
        data: data
    };
    
    // const aha = await axios(config);
    // console.log(aha)
    // console.log('co tam')
    // console.log('co')
    return axios(config);
}

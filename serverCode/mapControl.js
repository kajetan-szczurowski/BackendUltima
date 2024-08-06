const auth = require('./auth.js');
const db = require('./database.js');
const crypto = require('crypto');
const fs = require('fs');


let mapAssets = [];
let maps = {};
let assetsGraphics = {};
let currentMapURL = '';
const mapAuthorizations = {};
initGraphics();


exports.handleMap = function(io, socket){
    socket.on('move-proposition', (args) => handleMove(args, io));
    socket.on('get-maps', () => sendMaps(socket))
    socket.on('change-map', (payload) => {
        const {userID, mapURL} = {...payload};
        currentMapURL = mapURL;
        if (!auth.isGM(userID)) return;
        io.emit('map-control', {controlWord: 'change-map', args: [mapURL]});
    })

    socket.on('add-to-map', payload => {
        const {userID, assetURL, size, name, x ,y} = {...payload};
        if (!auth.isGM(userID)) return;
        mapAssets.push({id: crypto.randomUUID(), x: x, y: y, graphicUrl: assetURL, size: size, name: name});
        io.emit('map-control', {controlWord: 'map-assets', args: mapAssets});
    })

    socket.on('delete-asset', payload => {
        const {assetID, userID} = {...payload};
        if (!auth.isGM(userID)) return;
        mapAssets = mapAssets.filter(asset => asset.id !== assetID);
        removeMapAuthorization(assetID);
        io.emit('map-control', {controlWord: 'map-assets', args: mapAssets});
    })

    socket.on('send-me-assets', () =>{
        socket.emit('map-control', {controlWord: 'map-assets', args: mapAssets});
        if (currentMapURL != '') socket.emit('map-control', {controlWord: 'change-map', args: [currentMapURL]});
    })

    socket.on('get-maps', userID => {
        if (!auth.isGM(userID)) return;
        socket.emit('maps', prepareGraphicsForFrontEnd(maps));
    })

    socket.on('get-assets', userID => {
        if (!auth.isGM(userID)) return;
        socket.emit('assets', prepareGraphicsForFrontEnd(assetsGraphics));
    })

    socket.on('new-assets', payload => {
        if (!auth.isGM(payload.userID)) return;
        if (payload.maps.length > 0) prepareGraphicsForDataBase(payload.maps, maps);
        if (payload.maps.length > 0) db.saveMapURLs('maps', maps);
        if (payload.assets.length > 0 ) prepareGraphicsForDataBase(payload.assets, assetsGraphics);
        if (payload.assets.length > 0) db.saveMapURLs('assets', assetsGraphics);

        socket.emit('maps', prepareGraphicsForFrontEnd(maps));
        socket.emit('assets', prepareGraphicsForFrontEnd(assetsGraphics));
    })

    socket.on('get-map-auths', userID => {
        if (!auth.isGM(userID)) return;
        authData = prepareAuthorizationData();
        socket.emit('map-auths', authData);
    })

    socket.on('map-new-authorization', payload => {
        const {playerID, senderID, assetOnMapID} = payload;
        if (!auth.isGM(senderID)) return;
        if (playerID === senderID){
            removeMapAuthorization(assetOnMapID);
            return;
        }
        if (mapAuthorizations[playerID]){
            mapAuthorizations[playerID] = [...mapAuthorizations[playerID], assetOnMapID];
            takeMapAuthorizationFromUsersOtherThan(assetOnMapID, playerID);
            return;
        }
        mapAuthorizations[playerID] = [assetOnMapID];
        takeMapAuthorizationFromUsersOtherThan(assetOnMapID, playerID);

    })
}

function removeMapAuthorization(assetOnMapID){
    const keys = Object.keys(mapAuthorizations);
    keys.forEach(key => {
        if (mapAuthorizations[key].includes(assetOnMapID)) mapAuthorizations[key] = mapAuthorizations[key].filter(id => id !== assetOnMapID); 
        if (mapAuthorizations[key].length === 0) delete mapAuthorizations[key];
    })
}

function takeMapAuthorizationFromUsersOtherThan(mapAssetId, userID){
    const keys = Object.keys(mapAuthorizations);
    keys.forEach(key => {
        if (key== userID) return;
        mapAuthorizations[key] = mapAuthorizations[key].filter(id => id!== mapAssetId);
        if (mapAuthorizations[key].length === 0) delete mapAuthorizations[key];
    });
}

function prepareAuthorizationData(){
    const idMap = auth.getIDsMap();
    const assetsOnMap = mapAssets.map(asset => {return {name: asset.name, id: asset.id}})
    return {nameIdsMap: idMap, assets: assetsOnMap, authorizationMap: mapAuthorizations};
}

function moveAuthorised(assetID, userID){
    if (auth.isGM(userID)) return true;
    if (mapAuthorizations[userID] && mapAuthorizations[userID].includes(assetID)) return true;
    return false;
}

function handleMove(moveObject, io){
    const {id, x, y, userID} = {...moveObject};
    if (!moveAuthorised(id, userID)) return;
    const toMove = mapAssets.find(ass => ass.id === id);
    toMove.x = x;
    toMove.y = y;
    io.emit('map-control', {controlWord: 'move-order-input', args: [id, x, y]});
}

function sendMaps(socket){
    //db get Maps
    // socket.emit('map-list', maps from db)
}

async function initGraphics(){
    assetsGraphics = await db.getMapURLs('assets');
    maps = await db.getMapURLs('maps');

    //OBSOLETE:
    // const graphicsPath = './serverCode/data/graphics';
    // const mapsFileName = 'maps.json';
    // const assetsFileName = 'assets.json';
    // const mapPath = graphicsPath + '/' + mapsFileName;
    // const assetPath = graphicsPath + '/' + assetsFileName;
    // maps = JSON.parse(fs.readFileSync(mapPath));
    // assetsGraphics = JSON.parse(fs.readFileSync(assetPath));
}

function prepareGraphicsForFrontEnd(graphicsSource){
    if (!graphicsSource) return [];
    const keys = Object.keys(graphicsSource);
    const result = keys.map(k => {return {'label': k, 'url': graphicsSource[k]}});
    return result;
}

function prepareGraphicsForDataBase(graphicsData, graphicsSource){
    graphicsData.forEach(graphic => {
        graphicsSource[graphic.label] = graphic.url;
    })
}
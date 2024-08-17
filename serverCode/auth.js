const characters = require('./characterManagement.js');
const db = require('./database.js');

//DEVELOPEMENT MODE:
// let auth = getDummyAuth();
// let nameIDsMap = {
//     "1": "Kajos",
//     "2": "Beata i Miłosz",
//     "3": "pan Mareczek",
//     "4": "RaV",
//     "5": "Kinga"
// }

// let GM_ID = "1";


function getDummyAuth(){
    const auth = {
        "1" : ["420", "69", "2137", "1312", "666"],
        "2": ["420", "1312"],
        "3": ["2137"],
        "4": ["69"],
        "5": ["666"]
    };

    return auth;
}

function getDummyNameIdsMap(){
    return {
    "1": "Kajos",
    "2": "Beata i Miłosz",
    "3": "pan Mareczek",
    "4": "RaV",
    "5": "Kinga"
    }
}


getAuthorization();

let auth;
let nameIDsMap;
let GM_ID;


async function getAuthorization(){
    // if (OFFLINE_MODE) auth = getDummyAuth();
    // if (OFFLINE_MODE) return;
    const authorization = await db.getAuthorizationData();
    if (!authorization) {
        auth = getDummyAuth();
        GM_ID = '1';
        nameIDsMap = getDummyNameIdsMap();
        return;

    }
    auth = authorization.auth;
    GM_ID = authorization.GM_ID;
    nameIDsMap = authorization.nameIDsMap;
    // console.log(GM_ID)
}



function authorizationMiddleware(userID){
    if (!auth) auth = getDummyAuth();
    const authValue = auth[userID];
    if(!authValue) return {authorizationStateOK: false};
    if (!Array.isArray(authValue)) return {authorizationStateOK: false};
    return {authorizationStateOK: true, auth: authValue};
}

function filterAuthorizations(charactersMap, authorization){
    // const result = {};
    // Object.keys(charactersMap).forEach(character => {
    //     if (authorization.includes(charactersMap[character])) result[character] = charactersMap[character];
    // })
    const rawResult = charactersMap.filter(character => authorization.includes(character.id));
    const fullResult = {};
    rawResult.forEach(function(rest){
        fullResult[rest.name] = rest.id;
        })
    return fullResult;
}

exports.handleAuth = async function(socket){
    const map = await characters.getCharactersIDMap();
    socket.on('login', userID => {
        const auths = getAuths(userID);
        if (!auths){
            socket.emit('wrong-password');
            return;
        }
        const isGM = isUserGM(userID);
        const idsMap = isGM? nameIDsMap: {};
        socket.emit('login-succes', {authorization: filterAuthorizations(map, auths), userName: nameIDsMap[userID], isGM: isGM,
            nameIDsMap: idsMap
        });
    })

    socket.on('am-i-gm', (userID) => socket.emit('are-you-gm', isUserGM(userID)));
}

exports.isGM = function(userID){
    return isUserGM(userID);
}

exports.getIDsMap = function() {return nameIDsMap};

function isUserGM(userID){
    return GM_ID === userID;
}

exports.checkAuth = function(userID, characterID){
    if (!userID || !characterID) return false;
    if (GM_ID == userID) return true;
    const {authorizationStateOK, auth} = {...authorizationMiddleware(userID)};
    if (!authorizationStateOK) return false;
    return auth.some(a => a == characterID || `"${a}"` == characterID);
}

function getAuths(userID){
    const {authorizationStateOK, auth} = {...authorizationMiddleware(userID)};
    if (!authorizationStateOK) return;
    return auth;
}


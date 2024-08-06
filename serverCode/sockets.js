const chat = require('./chat.js');
const auth = require('./auth.js');
const map = require('./mapControl.js');
const characters = require('./characterManagement.js');
const game = require('./gameControl.js');

exports.handleSockets = function (io){

    io.on('connection', (socket) => {
        chat.sendStartingMessages(socket);

        chat.handleSocketChat(io, socket);
        auth.handleAuth(socket);
        map.handleMap(io, socket);
        characters.handleCharactersEdits(socket, auth);
        game.handleInitiative(io, socket);
        game.handleCombat(io, socket);

    });
}

const rolls = require('./rolls.js');
const auth = require('./auth.js');
const crypto = require("crypto");
const messages = [];
const MAX_NUMBER_OF_MESSAGES = 50;

exports.sendStartingMessages = function(socket){
    socket.emit('messages', messages);
}

exports.handleSocketChat = function(io, socket){
    socket.on('chat-message', (payload) => {
        const processed = handleChat(payload);
        if (!processed) return;
        io.emit('messages', processed);
    })
}

function handleChat(payload){
    const processed = processChatMessage(payload);
    if (!processed) return;
    const toAppend = {...processed};
    if (payload.color) toAppend.color = payload.color;
    appendMessage(toAppend);
    return messages;
}

function appendMessage(newMessage){
    if (!newMessage) return;
    if (messages.length >= MAX_NUMBER_OF_MESSAGES) messages.shift();
    messages.push(newMessage);
}

function processChatMessage(input){
    const payload = input.value;
    const userID = input.userID;
    const sender = auth.isGM(userID)? 'GM' : input.sender !== '*characters*'? input.sender: 'Spy';
    if (typeof payload !== 'string') return null;
    const message = payload.trim();
    if (message.charAt(0) === '#') return rolls.handleRoll(message, sender);
    return handleMessage(message, sender);
}

function handleMessage(message, sender){
    return{
        id: crypto.randomBytes(8).toString("hex"),
        messageTypeName: 'message',
        text: message,
        sender: sender || "Spy"
    }
}

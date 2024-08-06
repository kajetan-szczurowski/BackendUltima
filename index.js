const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"]
  }
});
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({limit: '50mb'}));
app.use(cors({origin: true, credentials:true}));

const socket = require('./serverCode/sockets.js');
const characters = require('./serverCode/characterManagement.js');

app.get('/', (req, res) => {
    res.write(`<h1>HEJ! Socket IO Start on Port : ${PORT}</h1>`);
    res.end();
});

app.get('/character/:characterID', (req, res) => {
  if (!characters.characterMiddleware()) {res.status(401); return;}
  const id = req.params.characterID;
  res.send(JSON.stringify(characters.getCharacter(id)));
})

app.get('/charactersIDMap', (req, res) => {
  if (!characters.characterMiddleware()) {res.status(401); return;}
  res.send(JSON.stringify(characters.getCharactersIDMap()));
})

socket.handleSockets(io);


server.listen(PORT, () => {
    console.log('listening on ', PORT);
});





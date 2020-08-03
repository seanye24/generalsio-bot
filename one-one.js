require('dotenv').config();
const Player = require('./Player');

// only for the first time
// set username for bot
// socket.emit("set_username", user_id, username);

// main.js
const io = require('socket.io-client');
const socket = io('http://botws.generals.io');

// define user id and username
const user_id = process.env.USER_ID;
const username = process.env.USERNAME;
const custom_game_id = process.env.GAME_ID;

socket.on('disconnect', () => {
  //  console.error('Disconnected from server.');
  // process.exit(1);
  setTimeout(() => { socket.connect(); }, 10000);
});

socket.on('connect', () => {
  socket.emit("set_username", user_id, username);
  console.log('Connected to server.');
  socket.emit('join_1v1', user_id);

  setTimeout(() => {
    setInterval(() => { socket.emit('set_force_start', custom_game_id, true); },
                1000);
  }, 3000);
});

// game data
let player;

socket.on('game_start', (data) => {
  player = new Player(socket, data.playerIndex);
  let replay_url =
      `http://bot.generals.io/replays/${encodeURIComponent(data.replay_id)}`;
  console.log(`Game starting! The replay will be available after the game at ${
      replay_url}`);
});

socket.on('game_update', (data) => {
  console.log(`on turn ${data.turn}`);
  player.play(data);
});

leaveGame = () => {
  socket.emit('leave_game');
  console.log('left game');
  socket.disconnect();
};

socket.on('game_lost', (data) => {
  console.log(`defeated by player ${data.killer}`);
  leaveGame();
});
socket.on('game_won', (data) => {
  console.log(`congrats on winning!`);
  leaveGame();
});

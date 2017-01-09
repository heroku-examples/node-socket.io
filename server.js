'use strict';

const express = require('express');
const socketIO = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');
const CURRENT_PATH = '/dff/event/challenge/90/get_battle_init_data';
//const CURRENT_PATH = '/dff/event/suppress/2025/single/get_battle_init_data';

const server = express()
	.use(bodyParser.json())
	.use(bodyParser.json(bodyParser.urlencoded({ extended: true })))
	.get('/', function (req, res) {
    res.sendFile(INDEX);
  })
  .post('/tick', function (req, res) {
    res.send('GET request to the homepage');
  })
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));
  

const io = socketIO(server);

io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('disconnect', () => {
  	console.log('Client disconnected');
  });

  socket.on('sessionId', function (sessionId, fn) {

  	var options = {
  	  host: 'ffrk.denagames.com',
  	  port: 80,
  	  path: CURRENT_PATH,
  	  headers: {'Cookie': 'http_session_sid='+sessionId}
  	};


  	var req = http.get(options, function(resp){
  		var message = {};
  		var data = "";

  	  resp.on('data', function(chunk) {
  	    data += chunk;
  	  });

  	  resp.on("end", function() {
  	  	try {
  	  		var json = JSON.parse(data);	
  	  	} catch(e) {
  	  		json = {};
  	  	}
  	  	
  	  	var drops = [];

  	  	if(!json.success) {
  	  		message.error = "Not in battle";
  	  		io.emit(sessionId, message);
  	  		return;
  	  	}


  	  	json.battle.rounds.forEach(function(round) {

  	  		round.drop_item_list.forEach(function(drop) {
  	  			drops.push(drop);
  	  		});

  	  		round.enemy.forEach(function(enemy) {
  	  			enemy.children.forEach(function(child) {
  	  				child.drop_item_list.forEach(function(drop) {
  	  					drops.push(drop);
  	  				});
  	  			});
  	  		});
  	  	});

  	  	message.drops = drops;


  	  	io.emit(sessionId, message);
  	  	
  	  });
  	}).on("error", function(e){
  	  message = "Got an error: " + e.message;
  	});


  	req.end();

    fn('woot!');
  });
});

setInterval(() => io.emit('time', new Date().toTimeString()), 1000);

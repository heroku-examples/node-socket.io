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

const itemMap = {
	"40000004": "Greater Power Orb",
	"40000005": "Major Power Orb",

	"40000009": "Greater White Orb",
	"40000010": "Major White Orb",

	"40000014": "Greater Black Orb",
	"40000015": "Major Black Orb",

	"40000024": "Greater Summon Orb",
	"40000025": "Major Summon Orb",

	"40000029": "Greater Non Elemental Orb",
	"40000030": "Major Non Elemental Orb",

	"40000034": "Greater Fire Orb",
	"40000035": "Major Fire Orb",

	"40000039": "Greater Ice Orb",
	"40000040": "Major Ice Orb",

	"40000044": "Greater Lightning Orb",
	"40000045": "Major Lightning Orb",

	"40000049": "Greater Earth Orb",
	"40000050": "Major Earth Orb",

	"40000054": "Greater Wind Orb",
	"40000055": "Major Wind Orb",

	"40000059": "Greater Holy Orb",
	"40000060": "Major Holy Orb",

	"40000064": "Greater Dark Orb",
	"40000065": "Major Dark Orb",

	"40000066": "Power Crystal",
	"40000067": "White Crystal",
	"40000068": "Black Crystal",
	"40000070": "Summon Crystal",
	"40000071": "Non Elemental Crystal",
	"40000072": "Fire Crystal",
	"40000073": "Ice Crystal",
	"40000074": "Lightning Crystal",
	"40000075": "Earth Crystal",
	"40000076": "Wind Crystal",
	"40000077": "Holy Crystal",
	"40000078": "Dark Crystal",
};

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
  		var message = "";
  		var data = "";

  	  resp.on('data', function(chunk) {
  	    data += chunk;
  	  });

  	  resp.on("end", function() {
  	  	var json = JSON.parse(data);
  	  	var drops = [];

  	  	if(!json.success) {
  	  		message = "You're probably not in battle. If you are in battle, you probably need to re-paste your session cookie";
  	  		io.emit(sessionId, message);
  	  		return;
  	  	}

  	  	message = "";

  	  	json.battle.rounds.forEach(function(round) {

  	  		round.drop_item_list.forEach(function(drop) {
  	  			if (itemMap[drop.item_id]) {
  	  				if(parseInt(drop.num) > 1) {
  	  					drops.push(drop.num + ' ' + itemMap[drop.item_id] + 's');
  	  				} else {
  	  					drops.push(itemMap[drop.item_id]);
  	  				}
  	  			} else {
  	  				drops.push(drop);
  	  			}
  	  		});

  	  		round.enemy.forEach(function(enemy) {
  	  			enemy.children.forEach(function(child) {
  	  				child.drop_item_list.forEach(function(drop) {
  	  					if (itemMap[drop.item_id]) {
  			  				if(parseInt(drop.num) > 1) {
  			  					drops.push(drop.num + ' ' + itemMap[drop.item_id] + 's');
  			  				} else {
  			  					drops.push(itemMap[drop.item_id]);
  			  				}
  			  			} else {
  			  				drops.push(drop);
  			  			}
  	  				});
  	  			});
  	  		});
  	  	});

  	  	if(drops.length > 1) {
  	  		message += drops.join("<br />")
  	  	} else if(drops.length == 1) {
  	  		message += drops.join("")
  	  	} else {
  	  		message += "...nothing.";
  	  	}


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

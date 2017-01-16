'use strict';

try {
  require('dotenv').config()
} catch(e) {
  // ignore it
}

const express = require('express');
const socketIO = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');
const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const getDropInfo = require('./drops.js');
const automation = require('./automation.js');

// automation.begin();


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

  socket.on('notify', function(arr, fn) {
    let drop = arr[0];
    let email = arr[1];
    let phone = arr[2];
    let message = `Your drop: ${drop.name} x${drop.num}`;

    if(email) {
      let helper = require('sendgrid').mail;
      let from_email = new helper.Email('no-reply@ffrk-creeper.herokuapp.com');
      let to_email = new helper.Email(email);
      let subject = message;
      let content = new helper.Content('text/plain', 'Brought to you by Gunner Technology');
      let mail = new helper.Mail(from_email, subject, to_email, content);

      let sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
      let request = sg.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: mail.toJSON(),
      });

      sg.API(request, function(error, response) {
        console.log(response.statusCode);
        console.log(response.body);
        console.log(response.headers);

        fn('email sent!');
      });
    }

    if(phone) {
      ///Strip out any non numeric characters
      phone = phone.toString().replace(/\D/g,'');

      if(phone.length >= 11 && phone.indexOf('+') == -1) {
        phone = `+${phone}`;
      } else if(phone.length < 11) {
        phone = `+1${phone}`; //ASSUME IT'S A US NUMBER
      }

      twilio.sendMessage({
        to: phone,
        from: process.env.TWILIO_PHONE_NUMBER,
        body: message

      }, function(err, responseData) { 

        if (!err) {
          console.log(responseData.from);
          console.log(responseData.body);
        } else {
          console.log(err)
        }

        fn('SMS sent!');
      });
    }
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

      // console.log(resp);

  	  resp.on('data', function(chunk) {
  	    data += chunk;
  	  });

  	  resp.on("end", function() {

  	  	var json = {};
  	  	try {
  	  		 json = JSON.parse(data);	
  	  	} catch(e) { }
  	  	
  	  	var drops = [];
        console.log(data.length);
        if(data.length === 0) {
          message.error = "Session Id Expired: Your session id no longer valid!";
          io.emit(sessionId, message);
          return;
        } else if(!json.success) {
  	  		message.error = "Not in Battle: Go join a battle to see your drops!";
  	  		io.emit(sessionId, message);
  	  		return;
  	  	}

        console.log(json)


  	  	json.battle.rounds.forEach(function(round) {

  	  		round.drop_item_list.forEach(function(drop) {
  	  			drops.push(getDropInfo(drop));
  	  		});

  	  		round.enemy.forEach(function(enemy) {
  	  			enemy.children.forEach(function(child) {
  	  				child.drop_item_list.forEach(function(drop) {
  	  					drops.push(getDropInfo(drop));
  	  				});
  	  			});
  	  		});
  	  	});

  	  	console.log(drops);

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

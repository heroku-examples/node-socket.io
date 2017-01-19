'use strict';

try {
  require('dotenv').config();
} catch(e) {
  // ignore it
}

const express = require('express');
const socketIO = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');
const util = require('util');
const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const mongoose = require('mongoose');
const Promise = require('bluebird');
const lodash = require('lodash');

require('./config/mongoose.js').setup(mongoose);

const automation = require('./automation.js');
const User = require('./models/user.js');





// automation.begin();


const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');




const server = express()
	.use(bodyParser.json())
	.use(bodyParser.json(bodyParser.urlencoded({ extended: true })))
  .use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV == 'production' ? 86400000 : 0
  }))
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

  socket.on('signin', (data, fn) => {
    User.findOne({'dena.sessionId': data.sessionId})
    .then((user) => {
      console.log(user);
      if(user) {
        return Promise.resolve(user);
      } else {
        return User.create({'dena.sessionId': data.sessionId});
      }
    })
    .then((user) => {

      return User.update({'dena.sessionId': data.sessionId}, {phone: data.phone, email: data.email});
    })
  });
});



setInterval(() => io.emit('time', new Date().toTimeString()), 1000);
setInterval(() => { User.schema.statics.doDropCheck(io) }, 3000);

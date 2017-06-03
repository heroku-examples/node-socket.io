'use strict';

const express = require('express');
const socketIO = require('socket.io');
//const path = require('path');

const PORT = process.env.PORT || 3000;
//const INDEX = path.join(__dirname, 'index.html');

const server = express()
    //.use((req, res) => res.sendFile(INDEX) )
    .listen(PORT, () => console.log(`Listening on ${ PORT }`));











var connections = [];
const io = socketIO(server);

io.on('connection', (socket) => {
    console.log('Client connected');
    io.on('message', function(msg) {

        //status = "War is imminent!";
        if (connections !== null) {
            io.send(connections);
            console.log(connections);
        }
        connections.add(this.msg);
        console.log(this.msg);
        //io.sockets.emit('status', { status: status });

    });
    io.on('disconnect', () => console.log('Client disconnected'));

});

//setInterval(() => io.emit('time', new Date().toTimeString()), 1000);
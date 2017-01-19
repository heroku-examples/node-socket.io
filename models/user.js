"use strict";

try {
    require('dotenv').config();
} catch (e) {
    // ignore it
}

const http = require('http');
const util = require('util');
const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const mongoose = require('mongoose');
const Promise = require('bluebird');
const lodash = require('lodash');
const request = require('request');

const CURRENT_PATH = '/dff/event/challenge/90/get_battle_init_data';
//const CURRENT_PATH = '/dff/event/suppress/2025/single/get_battle_init_data';

const Drop = require('./drop.js');
const Battle = require('./battle.js');

const getDropInfo = require('../drops.js');

// Drop.find({ denaItemId: { $eq: null } }).remove().exec();

const schema = new mongoose.Schema({
    email: String,
    phone: String,
    dena: {
        sessionId: String,
        userId: String,
        accessToken: String
    },
    hasValidSessionId: {
        type: Boolean,
        default: true
    },
    inBattle: {
        type: Boolean,
        default: true
    },
    drops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Drop' }]
});

schema.pre('save', function (next) {
    if (this.phone) {
        ///Strip out any non numeric characters
        this.phone = this.phone.toString().replace(/\D/g, '');

        if (this.phone.length >= 11 && this.phone.indexOf('+') == -1) {
            this.phone = `+${this.phone}`;
        } else if (this.phone.length < 11) {
            this.phone = `+1${this.phone}`; //ASSUME IT'S A US NUMBER
        }
    }
    next();
});

schema.statics.doDropCheck = (io) => {
    return mongoose.model('User', schema).find({ 'dena.sessionId': { $ne: null }, hasValidSessionId: true })
        .then((users) => {
            return Promise.each(users, (user) => {
                return user.checkForDrops()
                    .then((message) => {
                        io.emit(`/drops/${user.dena.sessionId}`, message); /// Send it to the browser

                        message.drops.forEach((drop) => {
                            let message = `Your drop: ${drop.name} x${drop.num}`;
                            if (user.email) {
                                user.sendEmail(message);
                            };

                            if (user.phone) {
                                user.sendSms(message);
                            }
                        });
                    })
                    .catch((error) => {
                        if (error.notify) {
                            io.emit(`/drops/${user.dena.sessionId}`, error); /// Send it to the browser
                            if (user.email) {
                                user.sendEmail(error.message)
                            }

                            if (user.phone) {
                                user.sendSms(error.message)
                            }
                        }
                    })
            }).return(users);
        })
        .then((users) => {
            console.log(`notifications sent to ${users.length} users!`)
        });
}

schema.methods.sendEmail = function (message) {
    let helper = require('sendgrid').mail;
    let from_email = new helper.Email('no-reply@ffrk-creeper.herokuapp.com');
    let to_email = new helper.Email(this.email);
    let subject = message;
    let content = new helper.Content('text/plain', 'Brought to you by Gunner Technology');
    let mail = new helper.Mail(from_email, subject, to_email, content);

    let sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
    let request = sg.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: mail.toJSON(),
    });

    return new Promise((resolve, reject) => {
        sg.API(request, (error, response) => {
            if (error) {
                reject(error);
            } else {
                resolve(response);
            }
        });
    })
};

schema.methods.sendSms = function (message) {
    var self = this;

    return new Promise((resolve, reject) => {
        twilio.sendMessage({
            to: self.phone,
            from: process.env.TWILIO_PHONE_NUMBER,
            body: message
        }, (err, responseData) => {
            if (!err) {
                resolve(responseData)
            } else {
                reject(err);
            }
        });
    });
};

schema.methods.checkForDrops = function () {
    var self = this;

    var options = {
        url: 'http://ffrk.denagames.com/' + CURRENT_PATH,
        proxy: process.env.PROXY_URL,
        headers: {
            'Cookie': 'http_session_sid=' + this.dena.sessionId
        }
    };

    return new Promise((resolve, reject) => {
        // var req = http.get(options, function (resp) {
        request.get(options, function (e, r, data) {
            if (e) return reject(e)
            var message = {};
            var json = {};
            var drops = [];

            try {
                json = JSON.parse(data);
            } catch (e) { }

            // self.inBattle = false;

            if (data && data.length === 0) {
                const proxiedError = new Error();
                proxiedError.message = "Session Id Expired: Your session id no longer valid! Please reset it.";
                proxiedError.name = 'Session Error';
                proxiedError.notify = true;

                self.hasValidSessionId = false;
                self.save().then(() => reject(proxiedError));
                return;
            } else if (!json.success) {
                const proxiedError = new Error();
                proxiedError.message = "Not in Battle: Go join a battle to see your drops!";
                proxiedError.name = 'Drop Error';
                proxiedError.notify = self.inBattle; /// we don't want to keep notifying them.

                self.inBattle = false;
                self.save().then(() => reject(proxiedError));
                return;
            } else if (self.inBattle) {
                const proxiedError = new Error();
                proxiedError.message = "Already Recroded this drop";
                proxiedError.name = 'Drop Error';
                proxiedError.notify = false;

                reject(proxiedError);
                return;
            }

            self.inBattle = true;
            self.save()
                .then(function () {
                    json.battle.rounds.forEach(function (round) {
                        round.drop_item_list.forEach(function (drop) {
                            drops.push(getDropInfo(drop));
                        });

                        round.enemy.forEach(function (enemy) {
                            enemy.children.forEach(function (child) {
                                child.drop_item_list.forEach(function (drop) {
                                    drops.push(getDropInfo(drop));
                                });
                            });
                        });
                    });

                    Battle.findOne({ denaBattleId: json.battle.battle_id })
                        .then(function (battle) {
                            if (battle) {
                                return Promise.resolve(battle);
                            } else {
                                return Battle.create({
                                    denaBattleId: json.battle.battle_id,
                                    denaDungeonId: json.battle.dungeon.dungeon_id,
                                    eventId: json.battle.event.event_id,
                                    eventType: json.battle.event.event_type,
                                    dropRates: {}
                                });
                            }
                        })
                        .then(function (battle) {
                            return Promise.each(drops, (d) => {
                                if (d.item_id) {
                                    return Drop.create({
                                        battle: battle._id,
                                        user: self._id,
                                        denaItemId: d.item_id,
                                        qty: d.num,
                                        rarity: d.rarity
                                    })
                                }

                                return Promise.resolve(null);
                            });
                        })
                        .then(() => {
                            return Battle.findOne({ denaBattleId: json.battle.battle_id }); /// the battle will now have the drops, let's get the drop rate;
                        })
                        .then((battle) => {
                            message.notify = false;

                            drops.forEach((d) => {
                                if (d.item_id && battle.dropRates && battle.dropRates[d.item_id]) {
                                    d.dropRate = battle.dropRates[d.item_id];
                                    message.notify = true;
                                }
                            });
                            message.drops = drops;
                            resolve(message);
                        });
                });
        })
    });
};

module.exports = mongoose.model('User', schema);
'use strict';

try {
  require('dotenv').config()
} catch(e) {
  // ignore it
}


const querystring = require('querystring');
const http = require('http');
const rp = require('request-promise');
const Promise = require('bluebird');

function getSessionId(userId, accessToken) {
  return new Promise(function(resolve, reject) {

    var post_data = querystring.stringify({
      userId: userId,
      accessToken: accessToken
    });

    var req = http.request({
        host: 'ffrk.denagames.com',
        port: 80,
        path: "/dff/_api_create_session",
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(post_data)
        }
    }, function(res) {
      res.setEncoding('utf8');
      var sessionId = null;
      res.rawHeaders.forEach((header) => {
        if(header.match(/http_session_sid=/)) {
          sessionId = header.match(/http_session_sid=([^;]+)/)[1];
        }
      });
      resolve(sessionId);
    });

    req.write(post_data);
    req.end();
  });
}

function getBrowserData(sessionId) {
  return new Promise(function(resolve, reject) {

    var req = http.request({
        host: 'ffrk.denagames.com',
        port: 80,
        path: "/dff/",
        method: 'GET',
        headers: {
          'Cookie': 'http_session_sid='+sessionId
        }
    }, function(res) {
      res.setEncoding('utf8');

      var data = "";

      res.on('data', (chunk) => { data += chunk; });

      res.on("end", () => {
        var csrfToken = data.match(/FFEnv\.csrfToken="([^"]+)";/)[1];
        var beginBattleToken = data.match(/"begin_battle_token":"([^"]+)"/)[1];
        resolve({
          csrfToken: csrfToken,
          beginBattleToken: beginBattleToken
        });
      });

    });

    req.end();
  });
}

function getUserSessionKey(sessionId, csrfToken) {
  return new Promise(function(resolve, reject) {

    var post_data = JSON.stringify({});

    var req = http.request({
        host: 'ffrk.denagames.com',
        port: 80,
        path: "/dff/update_user_session",
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Cookie': 'http_session_sid='+sessionId
        }
    }, function(res) {
      var data = "";

      res.on('data', (chunk) => { data += chunk; });

      res.on("end", () => {
        var json = JSON.parse(data); 

        resolve(json.user_session_key);
      });
    });

    req.write(post_data);
    req.end();
  });
}

function doSimplePost(path, json, userSessionKey, sessionId, csrfToken) {
  sessionId = sessionId || _g.sessionId;
  userSessionKey = userSessionKey || _g.userSessionKey;
  csrfToken = csrfToken || _g.csrfToken;

  return new Promise(function(resolve, reject) {

    var post_data = JSON.stringify(json);

    var req = http.request({
        host: 'ffrk.denagames.com',
        port: 80,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Session': userSessionKey,
          'Cookie': 'http_session_sid='+sessionId,
          'X-CSRF-Token': csrfToken
        }
    }, function(res) {
      var data = "";

      res.on('data', (chunk) => { data += chunk; });

      res.on("end", () => {
        var json = JSON.parse(data); 

        resolve(json);
      });
    });

    req.write(post_data);
    req.end();
  });
}

function doSimpleGet(path, userSessionKey, sessionId) {
  sessionId = sessionId || _g.sessionId;
  userSessionKey = userSessionKey || _g.userSessionKey;

  return new Promise(function(resolve, reject) {
    var req = http.request({
        host: 'ffrk.denagames.com',
        port: 80,
        path: path,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Session': userSessionKey,
          'Cookie': 'http_session_sid='+sessionId
        }
    }, function(res) {
      var data = "";

      res.on('data', (chunk) => { data += chunk; });

      res.on("end", () => {
        var json = JSON.parse(data); 

        resolve(json);
      });
    });

    req.end();
  });
}

function doEnterDungeon(challengeId, json) {
  return doSimplePost(userSessionKey, sessionId, csrfToken, "/dff/event/challenge/"+challengeId+"/enter_dungeon", json);
}

function doBeginBattle(challengeId, battleId) {
  return doSimplePost("/dff/event/challenge/"+challengeId+"/begin_battle_session", {battle_id: battleId, begin_token: _g.beginBattleToken})
  .then((json) => {
    return doSimplePost("/dff/event/challenge/"+challengeId+"/begin_battle", {battle_id: battleId, session_key: json.session_key})
  })
}

function getRootData() {
  return doSimpleGet("/dff/get_root_data");
}

function getWorldBattles() {
  return doSimpleGet("/dff/world/battles");
}

function getFriendFollowModalInfo() {
  return doSimpleGet("/dff/mo/multi/world/get_friend_follow_modal_info");
}

function getChallengeData(challengeId) {
  return doSimpleGet("/dff/event/challenge/"+challengeId+"/get_data");
}

function getWorldDungeonData(worldId) {
  return doSimpleGet("/dff/world/dungeons?world_id="+worldId); 
}

function getDetailedFellowListing() {
  return doSimpleGet("/dff/relation/detailed_fellow_listing"); 
}

function getBattleInitDataForEventId(eventId) {
  return doSimpleGet("/dff/event/challenge/"+eventId+"/get_battle_init_data");  
}

function getBattleInitDataForSuppressId(suppressId) {
  return doSimpleGet("/dff/event/suppress/"+suppressId+"/single/get_battle_init_data");  
}

var _g = {
  sessionId: null,
  userSessionKey: null,
  csrfToken: null,
  beginBattleToken: null
}

function begin(userId, accessToken) {
  getSessionId(
    (userId || process.env.DENA_USER_ID),
    (accessToken || process.env.DENA_ACCESS_TOKEN)
  )
  .then((sessionId) => {
    return [sessionId, getBrowserData(sessionId)];
  })
  .spread((sessionId, browserData) => {
    return [sessionId, browserData, getUserSessionKey(sessionId, browserData.csrfToken)];
  })
  .spread((sessionId, browserData, userSessionKey) => {
    _g.sessionId = sessionId;
    _g.csrfToken = browserData.csrfToken;
    _g.beginBattleToken = browserData.beginBattleToken;
    _g.userSessionKey = userSessionKey;

    return [
      getBattleInitDataForSuppressId(2028),
      // getBattleInitDataForEventId(92),
      // getRootData(),
      // getFriendFollowModalInfo(),
      // getChallengeData(92),
      // getWorldDungeonData(113092),
      // getDetailedFellowListing(),
      // getWorldBattles()
      // doBeginBattle(92, 1130920135)
      // doEnterDungeon(92, { 
      //   dungeon_id: 11309214,
      //   fellow_user_id: null
      // })
    ];
  })
  .spread(function() {
    console.log(arguments[0].battle.rounds)
  })
  // .spread((battleData) => {
  //   console.log("~~~~~~ SUPPORTER ~~~~~~~~")
  //   console.log(battleData.battle.supporter)
  //   console.log("~~~~~~ BUDDY ~~~~~~~~")
  //   console.log(battleData.battle.buddy)
  // })
  .catch(console.log)
}


module.exports = {
  begin: begin
};
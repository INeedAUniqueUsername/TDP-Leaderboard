'use strict';
const http = require('http');
var port = process.env.PORT || 1337;
port = 8125
const url = require('url');
const fs = require('fs');
const maps = require('./maps.js');
const Game = require('./game.js');
let recordsFile;
try { recordsFile = require('./records.js') } catch (e) { }
let recordsByLevel = {};
if (recordsFile) {
  recordsByLevel = JSON.parse(recordsFile);
} else {
  Object.keys(maps).forEach(title => recordsByLevel[title] = []);
}
http.createServer(function (req, res) {
  function reject(reply) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end(reply || 'Invalid Request');
  };
  function accept(response) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(response));
  }
  const u = url.parse(req.url, true);
  if (u.pathname == '/submit-score' && req.method === 'GET') {
    let level = u.query.level;
    if (!level) {
      reject('Invalid level ' + level);
      return;
    }
    let map = maps[level];
    if (!map) {
      reject('Invalid level ' + level);
      return;
    }
    map = {
      grid: map
    }

    let replayString = u.query.replayString;
    if (!replayString) {
      reject('Invalid replay string ' + replayString);
      return;
    }

    let g = new Game(map, replayString);
    let timer = 0;
    while (!g.finish && timer < 1000) {
      g.stepPlayer();
      timer++;
    }
    if (!g.finish) {
      reject('Replay does not finish within the time limit');
      return;
    }

    let username = u.query.username;
    if (!username) {
      reject('Invalid username ' + username);
      return;
    }
  } else if (u.pathname == '/top-ten' && req.method === 'GET') {
    let level = u.query.level;
    if (!level) {
      reject('Invalid level ' + level);
      return;
    }
    let records = recordsByLevel[level];
    if (!records) {
      reject('Invalid level ' + level);
      return;
    }
    accept(JSON.stringify(records.slice(0, 10)));
  } else if (u.pathname == '/neighbor-times' && req.method === 'GET') {
    let level = u.query.level;
    if (!level) {
      reject('Invalid level ' + level);
      return;
    }
    let records = recordsByLevel[level];
    if (!records) {
      reject('Invalid level ' + level);
      return;
    }

  } else {
    reject();
  }
}).listen(port);
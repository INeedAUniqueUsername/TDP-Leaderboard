'use strict';
const http = require('http');
var port = process.env.PORT || 1337;
port = 8125
const url = require('url');
const fs = require('fs');
const maps = require('./maps.js');
const Game = require('./game.js');
const Leaderboard = require('./Leaderboard.js');
function binarySearchRight(array, value) {
  let index = Math.floor(array.length / 2);
  let jump = Math.floor(1 + index / 2);
  while (jump > 0) {
    if (value < array[index]) {
      if (index === 0) {
        return index;
      } else if (value < array[index - 1]) {
        index -= jump;
      }
    } else {
      if (index === array.length) {
        return index;
      } else {
        index += jump;
      }
      
    }
    jump = Math.floor(jump / 2);
  }
  while (index < array.length && value >= array[index]) {
    index++;
  }
  while (index > 0 && value < array[index - 1]) {
    index--;
  }
  return index;
}
class Record {
  constructor(username, replayString, time) {
    this.username = username;
    this.level = level;
    this.replayString = replayString;
    this.time = time;
  }
}
let leaderboard = new Leaderboard();
if (fs.existsSync('./records.json')) {
  leaderboard = new Leaderboard(JSON.parse(fs.readFileSync('./records.json')));
} else {
  Object.keys(maps).forEach(title => leaderboard.recordsByLevel[title] = []);
}
let dataChanged = false;
let backupInterval = 1000 * 60;
function backup() {
  if (dataChanged) {
    function name(i) {
      return './records' + i + '.json';
    }
    function rename(f1, f2) {
      if (fs.existsSync(f1)) {
        fs.renameSync(f1, f2);
      }

    }
    for (let i = 4; i > -1; i--) {
      rename(name(i), name(i + 1));
    }
    rename('./records.json', name(0));
    fs.writeFileSync('./records.json', JSON.stringify(leaderboard.recordsByLevel));
  }
  setTimeout(backup, backupInterval);
}
setTimeout(backup, backupInterval);

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
  if (u.pathname == '/submit-score' && req.method === 'POST') {
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
    let username = u.query.username;
    if (!username) {
      reject('Invalid username ' + username);
      return;
    }

    let replayString = u.query.replayString;
    if (!replayString) {
      reject('Invalid replay string ' + replayString);
      return;
    }

    let g = new Game(map, replayString);
    let time = 0;
    while (!g.finish && time < 1000) {
      g.stepPlayer();
      time++;
    }
    if (!g.finish) {
      reject('Replay does not finish within the time limit');
      return;
    }
    let index = leaderboard.addRecord(level, new Record(username, replayString, time));
    accept(JSON.stringify({
      accepted: true,
      index: index,
      time: time
    }));
    dataChanged = true;
  } else if (u.pathname == '/top-ten' && req.method === 'GET') {
    let level = u.query.level;
    if (!level) {
      reject('Invalid level ' + level);
      return;
    }
    let records = leaderboard.recordsByLevel[level];
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
    let records = leaderboard.recordsByLevel[level];
    if (!records) {
      reject('Invalid level ' + level);
      return;
    }
    let time = parseInt(u.query.time);
    if (!time) {
      reject('Invalid time ' + u.query.time);
      return;
    }
    /*
    records = records.filter((value, index, self) => {
      return self.findIndex(r => r.time === value.time) === index;
    });
    */
    let index = binarySearchRight(records.map(r => r.time), time);
    if (index < 4) {
      accept(JSON.stringify({
        topRank: 0,
        index: index,
        above: records.slice(0, index),
        below: records.slice(index, 4),
      }));
    } else {
      accept(JSON.stringify({
        topRank: index - 4,
        index: index,
        above: records.slice(index - 4, index),
        below: records.slice(index, 4),
      }));
    }
  } else {
    reject();
  }
}).listen(port);
'use strict';
const http = require('http');
var port = process.env.PORT || 1337;
port = 8125
const url = require('url');
const fs = require('fs');
const crypto = require('crypto');
const maps = require('./maps.js');
const Game = require('./game.js');
class Leaderboard {
  constructor(records) {
    this.records = [];
    this.recordsByLevel = {};
    this.recordsById = {};
    Object.keys(maps).forEach(level => this.recordsByLevel[level] = []);
    if (records) {
      this.addAllRecords(records);
    }
  }
  addSorted(recordSet, record) {
    if (recordSet.length === 0) {
      recordSet.push(record);
      return 0;
    } else {
      let times = recordSet.map(r => r.time)
      let index = binarySearchRight(times, record.time);
      if (index === times.length) {
        recordSet.push(record);
      } else {
        recordSet.splice(index, 0, record);
      }
      return index;
    }
  }
  addAllRecords(records) {
    records.forEach(record => {
      record = new Record(record);
      this.records.push(record);
      this.recordsById[record.id] = record;
      this.addSorted(this.recordsByLevel[record.level], record)
    });
  }
  addRecord(record) {
    this.records.push(record);
    this.recordsById[record.id] = record;
    let levelIndex = this.addSorted(this.recordsByLevel[record.level], record);
    return levelIndex;
  }
}
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
  constructor(from) {
    this.username = from.username;
    this.level = from.level;
    this.replayString = from.replayString;
    this.time = from.time;
    this.frames = from.frames;
    this.id = from.id || crypto.randomBytes(16).toString('hex');
  }
}
let leaderboard = new Leaderboard();
if (fs.existsSync('./records.json')) {
  leaderboard = new Leaderboard(JSON.parse(fs.readFileSync('./records.json')));
}
let dataChanged = false;
let backupInterval = 1000 * 60 / 60;
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
    fs.writeFileSync('./records.json', JSON.stringify(leaderboard.records));
  }
  dataChanged = false;
  setTimeout(backup, backupInterval);
}
setTimeout(backup, backupInterval);

http.createServer(function (req, res) {

  function reject(response) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    response = response || 'Invalid Request'
    res.end(response);
    console.log('Response sent: ' + response);
  };
  function accept(response) {
    res.statusCode = 200;
    response = JSON.stringify(response);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(response);
    console.log('Response sent: ' + response);
  }
  const u = url.parse(req.url, true);
  console.log('Request received: ' + req.method + ' ' + req.url);

  https://gist.github.com/nilcolor/816580
  if (req.method === 'OPTIONS') {
    console.log('!OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, access-control-allow-origin");
    //res.setHeader("Access-Control-Allow-Headers", req.headers);
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Credentials", false);
    res.setHeader("Access-Control-Max-Age", '86400'); // 24 hours
    res.statusCode = 204;
    res.end();

    console.log(req.headers);
  } else if (u.pathname == '/submit-score' && req.method === 'POST') {
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
    let frames = 0;
    while (!g.finish && frames < 1000) {
      g.stepPlayer();
      frames++;
    }
    if (!g.finish) {
      reject('Replay does not finish within the time limit');
      return;
    }
    let time = g.timer;

    let levelIndex = leaderboard.addRecord(new Record({
      username: username,
      level: level,
      replayString: replayString,
      time: time,
      frames: frames
    }));
    accept(JSON.stringify({
      accepted: true,
      levelIndex: levelIndex,
      time: time,
      frames: frames
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
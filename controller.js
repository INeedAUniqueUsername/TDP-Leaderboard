var http = require('http');
var fs = require('fs');
var path = require('path');

http.createServer(function (request, response) {
  console.log('request ', request.url);
}).listen(8125);
console.log('Server running at http://127.0.0.1:8125/');
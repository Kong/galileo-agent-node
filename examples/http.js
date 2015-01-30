var http = require('http');

var analytics = require('apianalytics');
var agent = analytics('SERVICE_TOKEN');

var server = http.createServer(function (req, res) {
  agent(req, res);
  res.writeHead(200, {"Content-Type": "text/plain"});
  res.end('Hello World!');
});

server.listen(3000);
console.log("Server running at http://127.0.0.1:3000/");

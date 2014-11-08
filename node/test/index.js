require('should');
var express = require('express');
var http = require('http');
var io = require('socket.io');
var request = require('supertest');
var agent = require('../lib');
var package = require('../package.json');

var createSocketServer = function(port, socketHandler) {
  var server = http.createServer();
  var sio = io(server);

  sio.on('connection', function(socket) {

    socket.on('record', function(event) {
      socketHandler(event);

      server.close();
    });
  });
  server.listen(port);
  return server;
};

describe('Agent middleware', function() {
  it('should record an event send', function(done) {
    var port = 4001;
    var mockServer = createSocketServer(port, function(event) {
      event.should.be.ok;
      done();
    });

    // Create HTTP server for api call
    var app = express();

    app.use(agent('fake-key', {host: 'localhost', port: port}));

    app.get('/', function(req, res) {
      res.send('Bonjour');
    });

    app.listen(function() {

      // Invoke an API call
      request(app)
        .get('/')
        .expect('Bonjour')
        .end(function() {});
    });

  });
});

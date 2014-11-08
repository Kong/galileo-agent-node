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

  sio.on('connection', socketHandler.bind(server));
  server.listen(port);
  return server;
};

describe('Agent middleware', function() {
  it('should emit record with an event', function(done) {
    var port = 4001;

    // Start a mock analytics server
    var mockServer = createSocketServer(port, function(socket) {
      var server = this;

      socket.on('record', function(event) {
        event.should.be.ok;

        server.close();
        done();
      });
    });

    // Create HTTP server for api call
    var app = express();

    // Attach agent
    app.use(agent('fake-key', {host: 'localhost', port: port}));

    // Setup a route
    app.get('/', function(req, res) {
      res.send('Bonjour');
    });

    // Start the server
    app.listen(function() {

      // Call the route
      request(app)
        .get('/')
        .expect('Bonjour')
        .end(function() {});
    });

  });
});

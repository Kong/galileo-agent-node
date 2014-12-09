var express = require('express');
var http = require('http');
var sio = require('socket.io');
var request = require('supertest');
var agent = require('../lib');
require('should');

/**
 * Helper function
 */
// Creates a mock of the analytics server.
// Returns: Server address
var createAnalyticsServer = function(socketHandler) {
  var server = http.Server();
  var io = sio(server);

  io.on('connection', socketHandler.bind(server));

  var addr = server.address();
  if (!addr) {
    addr = server.listen().address();
  }

  return addr;
};

describe('Agent', function() {

  it('should record event with an Express server', function(done) {
    var analyticsAddr = createAnalyticsServer(function(socket) {
      socket.on('record', function(event) {
        event.should.be.ok;
        event.should.have.property('version');

        done();
      });
    });

    // Create Express server for api call
    var app = express();

    // Attach agent
    app.use(agent('fake-key', {host: analyticsAddr.address, port: analyticsAddr.port}));

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

  it('should record event with an HTTP server', function(done) {
    var analyticsAddr = createAnalyticsServer(function(socket) {
      socket.on('record', function(event) {
        event.should.be.ok;
        event.should.have.property('version');

        done();
      });
    });

    // Create server and attach agent
    var analytics = agent('fake-key', {host: analyticsAddr.address, port: analyticsAddr.port});
    var server = http.createServer(function(req, res) {
      analytics(req, res);

      res.writeHead(200, { 'Content-Type': 'text/plain'});
      res.write('This is a test');
      res.end();
    });
    server.listen(function() {
      // Call the route
      request(server)
        .get('/')
        .expect(200)
        .expect('This is a test')
        .end(function() {});
    });
  });

  it('should use custom logger', function(done) {
    var analyticsAddr = createAnalyticsServer(function(socket) {
    });

    // Create server and attach agent
    var analytics = agent('fake-key', {host: analyticsAddr.address, port: analyticsAddr.port, logger: function(message) {
      message.should.equal('Connected to API Analytics socket.io server with service token fake-key.');

      done();
    }});
    var server = http.createServer(function(req, res) {
      analytics(req, res);

      res.writeHead(200, { 'Content-Type': 'text/plain'});
      res.write('This is a test');
      res.end();
    });
  });
});

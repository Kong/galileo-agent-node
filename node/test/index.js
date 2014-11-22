var express = require('express');
var http = require('http');
var zmq = require('zmq');
var request = require('supertest');
var agent = require('../lib');
require('should');

/**
 * Helper function
 */
// Creates a mock of the analytics server.
// Returns: Server address
var createAnalyticsServer = function(socketHandler) {
  var sock = zmq.socket('pull');
  sock.bindSync('tcp://127.0.0.1:4000');

  sock.on('message', function(data) {
    socketHandler(JSON.parse(data.toString('utf8')));
  });
};

describe('Agent', function() {

  it('should record event with an Express server', function(done) {
    createAnalyticsServer(function(data) {
      data.should.be.ok;
      data.should.have.property('version');

      done();
    });

    // Create Express server for api call
    var app = express();

    // Attach agent
    app.use(agent('fake-key', {host:'127.0.0.1', port:4000}));

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

  it.skip('should record event with an HTTP server', function(done) {
    var analyticsAddr = createAnalyticsServer(function(data) {
      data.should.be.ok;
      data.should.have.property('version');

      done();
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
});

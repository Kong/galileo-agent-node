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
      done();
    });
  });
  server.listen(port);
  return server;
};

describe('Agent middleware', function() {
  it('should record an event send in HAR', function(done) {
    var port = 4001;
    var mockServer = createSocketServer(port, function(event) {
      // TODO validate HAR
      // event.should.have.property('version').and.equal(1.2); // HAR 1.2
      // event.should.have.property('creator')
      // event.creator.should.have.property('name').and.equal(package.name);
      // event.creator.should.have.property('version').and.equal(package.version);

      // event.should.have.property('request');
      // event.request.should.have.property('receivedAt').and.be.a.Number;
      // event.request.should.have.property('method').and.equal('GET');
      // event.request.should.have.a.property('protocol').and.equal('http');
      // event.request.should.have.a.property('path').and.equal('/');
      // event.request.should.have.property('queries');
      // event.request.should.have.property('headers');
      // event.request.headers.should.have.a.property('host').and.match(/127.0.0.1/);

      // event.should.have.property('response');
      // event.response.should.have.property('receivedAt').and.be.a.Number;
      // event.response.should.have.property('status').and.equal(200);

      // event.response.should.have.property('headers');
      // event.response.headers.should.have.property('content-type').and.match(/html/);
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

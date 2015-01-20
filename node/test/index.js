var express = require('express');
var http = require('http');
var util = require('util');
var socketio = require('socket.io');
var request = require('supertest');
var pkg = require('../package.json');
var agent = require('../lib');
require('should');

var io;
var address;

/**
 * setup socket server
 *
 */

var serviceToken = 'ALLYOURBASEAREBELONGTOUS';

describe('Agent Middleware', function () {
  beforeEach(function (done) {
    var httpServer = http.Server();

    io = socketio(httpServer);

    var addr = httpServer.listen().address();

    address = addr.address + ':' + addr.port;

    done();
  });

  it('sends a message with an Express server', function (done) {

    io.on('connection', function (socket) {
      socket.on('message', function (har) {
        har.should.be.an.Object;
        har.should.have.property('version').and.equal('1.2');
        har.should.have.property('serviceToken').and.equal(serviceToken);

        done();
      });
    });

    // Create Express server for api call
    var app = express();

    // Attach agent
    app.use(agent(serviceToken, {
      host: address
    }));

    // Setup a route
    app.get('/', function (req, res) {
      res.send('Bonjour');
    });

    // Start the server
    app.listen(function () {

      // Call the route
      request(app)
        .get('/')
        .expect('Bonjour')
        .end(function () {});
    });
  });

  it('sends a message with a standard HTTP server', function (done) {
    io.on('connection', function (socket) {
      socket.on('message', function (har) {
        har.should.be.an.Object;
        har.should.have.property('version').and.equal('1.2');
        har.should.have.property('serviceToken').and.equal(serviceToken);

        done();
      });
    });

    // Create server and attach agent
    var analytics = agent(serviceToken, {
      host: address
    });

    var server = http.createServer(function (req, res) {
      analytics(req, res);

      res.writeHead(200, { 'Content-Type': 'text/plain'});
      res.write('Bonjour');
      res.end();
    });

    server.listen(function () {
      // Call the route
      request(server)
        .get('/')
        .expect(200)
        .expect('This is a test')
        .end(function () {});
    });
  });

  it('sends a batched message', function (done) {
    io.on('connection', function (socket) {
      socket.on('message', function (har) {
        har.should.have.property('entries').and.be.an.Array.with.lengthOf(10);

        done();
      });
    });

    // Create server and attach agent
    var analytics = agent(serviceToken, {
      host: address,
      batch: 10
    });

    var server = http.createServer(function (req, res) {
      analytics(req, res);

      res.writeHead(200, { 'Content-Type': 'text/plain'});
      res.write('Bonjour');
      res.end();
    });

    server.listen(function () {
      // Call the route x times
      var i = 10;

      while (i--) {
        request(server)
          .get('/')
          .expect(200)
          .expect('This is a test')
          .end(function () {});
      }
    });
  });

  it('should convert http server req, res to HAR', function(done) {
    io.on('connection', function (socket) {
      socket.on('message', function (har) {

        har.should.be.an.Object;
        har.should.have.property('version').and.equal('1.2');
        har.should.have.property('serviceToken').and.equal(serviceToken);

        har.should.have.property('creator').and.be.an.Object;
        har.creator.should.have.property('name').and.equal(pkg.name);
        har.creator.should.have.property('version').and.equal(pkg.version);

        har.should.have.property('entries').and.be.an.Array.with.lengthOf(1);

        har.entries[0].should.have.property('serverIPAddress').and.be.a.String;
        har.entries[0].should.have.property('startedDateTime').and.be.a.String;

        har.entries[0].should.have.property('request').and.be.an.Object;
        har.entries[0].request.should.have.property('method').and.equal('GET');
        har.entries[0].request.should.have.property('url').and.equal('http://localhost/?foo=bar');
        har.entries[0].request.should.have.property('httpVersion').and.equal('HTTP/1.1');
        har.entries[0].request.should.have.property('queryString').and.be.Array.and.containEql({name: 'foo', value: 'bar'});
        har.entries[0].request.should.have.property('headersSize').and.be.a.Number.and.equal(168);
        har.entries[0].request.should.have.property('bodySize').and.be.a.Number.and.equal(-1);
        har.entries[0].request.should.have.property('headers').and.be.a.Array.and.containEql({name: 'x-custom-header', value: 'foo'});

        har.entries[0].should.have.property('response').and.be.an.Object;
        har.entries[0].response.should.have.property('status').and.equal(200);
        har.entries[0].response.should.have.property('statusText').and.equal('OK');
        har.entries[0].response.should.have.property('httpVersion').and.equal('HTTP/1.1');
        har.entries[0].response.should.have.property('headersSize').and.equal(129);
        har.entries[0].response.should.have.property('bodySize').and.be.a.Number.and.equal(7);
        har.entries[0].response.should.have.property('headers').and.be.a.Array.and.containEql({name: 'Content-Type', value: 'text/plain'});
        har.entries[0].response.should.have.property('redirectUrl').and.equal('');

        har.entries[0].response.should.have.property('content').and.be.an.Object;
        har.entries[0].response.content.should.have.property('size').and.equal(7);
        har.entries[0].response.content.should.have.property('mimeType').and.equal('text/plain');
        har.entries[0].response.content.should.have.property('text').and.equal('Bonjour');

        har.entries[0].should.have.property('cache').and.be.an.Object;
        har.entries[0].should.have.property('timings').and.be.an.Object;

        done();
      });
    });

    // Create server and attach agent
    var analytics = agent(serviceToken, {
      host: address,
      sendBody: true
    });

    var server = http.createServer(function (req, res) {
      analytics(req, res);

      res.writeHead(200, { 'Content-Type': 'text/plain'});
      res.write('Bonjour');
      res.end();
    });

    request(server)
      .get('/?foo=bar')
      .set('host', 'localhost')
      .set('X-Custom-Header', 'foo')
      .end(function() {});
  });

  it('should use custom logger', function (done) {
    // Create server and attach agent
    var analytics = agent('fake-key', {
      host: address,
      logger: function (message) {
        message.should.equal(util.format('Connected using token: %s', 'fake-key'));

        done();
      }
    });

    var server = http.createServer(function (req, res) {
      analytics(req, res);

      res.writeHead(200, { 'Content-Type': 'text/plain'});
      res.write('This is a test');
      res.end();
    });
  });
});

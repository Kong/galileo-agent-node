var express = require('express');
var http = require('http');
var util = require('util');
var socketio = require('socket.io');
var unirest = require('unirest');
var pkg = require('../package.json');
var agent = require('../lib');
require('should');

var io;
var port;
var webserver;

var serviceToken = 'ALLYOURBASEAREBELONGTOUS';

describe('Agent Middleware', function () {
  beforeEach(function (done) {
    var server = http.Server();

    io = socketio(server);

    port = server.listen().address().port;

    done();
  });

  afterEach(function (done) {
    try {
      webserver.close();
    } catch (err) {}

    done();
  });

  it('sends a message with an Express server', function (done) {
    io.on('connection', function (socket) {
      socket.on('message', function (message) {
        message.should.be.an.Object;
        message.should.have.property('serviceToken').and.equal(serviceToken);

        done();
      });
    });

    // Create Express server for api call
    var app = express();

    // Attach agent
    app.use(agent(serviceToken, {
      host: '127.0.0.1:' + port
    }));

    // Setup a route
    app.get('/', function (req, res) {
      res.send('Bonjour');
    });

    // Start the server
    webserver = app.listen(3002, function () {
      unirest.get('http://localhost:3002/').end();
    });
  });
  it('sends a message with a standard HTTP server', function (done) {
    io.on('connection', function (socket) {
      socket.on('message', function (message) {
        message.should.be.an.Object;
        message.should.have.property('serviceToken').and.equal(serviceToken);

        done();
      });
    });

    // Create server and attach agent
    var analytics = agent(serviceToken, {
      host: '127.0.0.1:' + port
    });

    webserver = http.createServer(function (req, res) {
      analytics(req, res);

      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.write('Bonjour');
      res.end();
    });

    webserver.listen(3002, function () {
      unirest.get('http://localhost:3002/').end();
    });
  });

  it('sends a batched message', function (done) {
    io.on('connection', function (socket) {
      socket.on('message', function (message) {
        message.har.log.should.have.property('entries').and.be.an.Array.with.lengthOf(10);

        done();
      });
    });

    // Create server and attach agent
    var analytics = agent(serviceToken, {
      host: '127.0.0.1:' + port,
      entriesPerHar: 10
    });

    webserver = http.createServer(function (req, res) {
      analytics(req, res);

      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.write('Bonjour');
      res.end();
    });

    webserver.listen(3002, function () {
      // Call the route x times
      var i = 10;

      while (i--) {
        unirest.get('http://localhost:3002/').end();
      }
    });
  });

  it('should convert http server req, res to HAR', function (done) {
    io.on('connection', function (socket) {
      socket.on('message', function (message) {
        var har = message.har.log;

        har.should.be.an.Object;
        har.should.have.property('version').and.equal('1.2');

        har.should.have.property('creator').and.be.an.Object;
        har.creator.should.have.property('name').and.equal(pkg.name);
        har.creator.should.have.property('version').and.equal(pkg.version);

        har.should.have.property('entries').and.be.an.Array.with.lengthOf(1);

        har.entries[0].should.have.property('serverIPAddress').and.be.a.String;
        har.entries[0].should.have.property('startedDateTime').and.be.a.String;

        har.entries[0].should.have.property('request').and.be.an.Object;
        har.entries[0].request.should.have.property('method').and.equal('POST');
        har.entries[0].request.should.have.property('url').and.equal('http://localhost/?foo=bar');
        har.entries[0].request.should.have.property('httpVersion').and.equal('HTTP/1.1');
        har.entries[0].request.should.have.property('queryString').and.be.Array.and.containEql({name: 'foo', value: 'bar'});
        har.entries[0].request.should.have.property('headersSize').and.be.a.Number.and.equal(168);
        har.entries[0].request.should.have.property('bodySize').and.be.a.Number.and.equal(13);
        har.entries[0].request.should.have.property('headers').and.be.a.Array.and.containEql({name: 'x-custom-header', value: 'foo'});

        har.entries[0].request.should.have.property('content').and.be.an.Object;
        har.entries[0].request.content.should.have.property('size').and.equal(13);
        har.entries[0].request.content.should.have.property('mimeType').and.equal('application/json');
        // TODO fix request body capture
        // har.entries[0].request.content.should.have.property('text').and.equal('{"foo":"bar"}');

        har.entries[0].should.have.property('response').and.be.an.Object;
        har.entries[0].response.should.have.property('status').and.equal(200);
        har.entries[0].response.should.have.property('statusText').and.equal('OK');
        har.entries[0].response.should.have.property('httpVersion').and.equal('HTTP/1.1');
        har.entries[0].response.should.have.property('headersSize').and.equal(134);
        // TODO fix response bodySize capture
        // har.entries[0].response.should.have.property('bodySize').and.be.a.Number.and.equal(7);
        har.entries[0].response.should.have.property('headers').and.be.a.Array.and.containEql({name: 'Content-Type', value: 'text/plain'});

        har.entries[0].response.should.have.property('content').and.be.an.Object;
        har.entries[0].response.content.should.have.property('size').and.equal(7);
        har.entries[0].response.content.should.have.property('mimeType').and.equal('text/plain');
        har.entries[0].response.content.should.have.property('text').and.equal('Bonjour');

        har.entries[0].should.have.property('timings').and.be.an.Object;

        done();
      });
    });

    // Create server and attach agent
    var analytics = agent(serviceToken, {
      host: '127.0.0.1:' + port,
      sendBody: true
    });

    webserver = http.createServer(function (req, res) {
      analytics(req, res);

      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.write('Bonjour');
      res.end();
    });

    webserver.listen(3002, function () {
      unirest.post('http://localhost:3002/')
        .query('foo=bar')
        .type('json')
        .send({foo: 'bar'})
        .header('host', 'localhost')
        .header('X-Custom-Header', 'foo')
        .end();
    });
  });

  it('should use custom logger', function (done) {
    // Create server and attach agent
    var analytics = agent('fake-key', {
      host: '127.0.0.1:' + port,
      logger: function (message) {
        message.should.equal(util.format('starting socket connection to 127.0.0.1:%d using token: %s', port, 'fake-key'));

        done();
      }
    });

    webserver = http.createServer(function (req, res) {
      analytics(req, res);

      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.write('This is a test');
      res.end(function () {});
    });
  });
});

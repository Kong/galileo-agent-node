var express = require('express');
var request = require('supertest');
var http = require('http');
var helpers = require('../lib/helpers');
var package = require('../package.json');
require('should');


describe('HAR', function() {
  it('should convert http server req, res to HAR', function(done) {
    var now = new Date();
    var server = http.createServer(function(req, res) {
      // Setup Mock Data
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.write('Hello World');

      // Capture
      var event = har(req, res, now);
      var headerBuffer = new Buffer(res._header);

      event.should.have.property('version').and.equal('1.2'); // HAR 1.2
      event.creator.should.have.property('name').and.equal(package.name);
      event.creator.should.have.property('version').and.equal(package.version);

      event.should.have.property('entries').and.be.an.Array;
      event.entries.length.should.equal(1);
      event.entries[0].should.have.property('startedDateTime').and.be.a.String;
      event.entries[0].should.have.property('request');
      event.entries[0].request.should.have.property('method').and.equal('GET');
      event.entries[0].request.should.have.property('httpVersion').and.equal('HTTP/1.1');
      event.entries[0].request.should.have.property('headers').and.be.a.Array;
      event.entries[0].should.have.property('response');
      event.entries[0].response.should.have.property('status').and.equal(200);
      event.entries[0].response.should.have.property('statusText').and.equal('OK');
      event.entries[0].response.should.have.property('httpVersion').and.equal('HTTP/1.1');
      event.entries[0].response.should.have.property('headers').and.be.a.Array;
      event.entries[0].response.headers.should.containEql({name: 'Content-Type', value: 'text/plain'});
      event.entries[0].response.should.have.property('headersSize').and.equal(headerBuffer.length);
      event.entries[0].should.have.property('cache');
      event.entries[0].should.have.property('timings');

      done();
    });

    request(server)
      .get('/?test=1&test=2')
      .set('host', 'rawr.com')
      .end(function() {});
  });
  it('should convert express req, res to HAR', function(done) {
    var now = new Date();
    var app = express();

    app.get('/', function(req, res) {
      // console.log(req);
      res.on('finish', function() {
        var event = har(req, res, now);

        event.should.have.property('version').and.equal('1.2'); // HAR 1.2
        event.should.have.property('creator');
        event.should.have.property('entries').and.be.an.Array;

        done();
      });
      res.send('Bonjour');
    });

    request(app)
      .get('/?test=1&test=2')
      .end(function() {});
  });
});

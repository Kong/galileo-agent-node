var express = require('express');
var request = require('supertest');
var har = require('../lib/har');
var package = require('../package.json');

var http = require('http');

describe('HAR', function() {
  it('should convert http server req, res to HAR', function(done) {
    var now = new Date();
    var server = http.createServer(function(req, res) {
      var event = har(req, res, now);

      event.should.have.property('version').and.equal(1.2); // HAR 1.2
      event.creator.should.have.property('name').and.equal(package.name);
      event.creator.should.have.property('version').and.equal(package.version);

      event.should.have.property('entries').and.be.an.Array;
      event.entries.length.should.equal(1);
      event.entries[0].should.have.property('startedDateTime').and.be.a.String;
      event.entries[0].should.have.property('request');
      event.entries[0].request.should.have.property('method').and.equal('GET');
      event.entries[0].request.should.have.property('httpVersion').and.equal('HTTP/1.1');
      event.entries[0].should.have.property('response');
      event.entries[0].response.should.have.property('status').and.equal(200);
      event.entries[0].request.should.have.property('httpVersion').and.equal('HTTP/1.1');
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

        event.should.have.property('version').and.equal(1.2); // HAR 1.2
        event.should.have.property('creator');
        event.should.have.property('entries').and.be.an.Array;

        done();
      })
      res.send('Bonjour');
    });

    request(app)
      .get('/?test=1&test=2')
      .end(function() {});
  });
})

require('should');
var express = require('express');
var net = require('net');
var request = require('supertest');
var agent = require('../index');
var package = require('../package.json');

describe('Agent middleware', function() {
  it('should record a request', function(done) {
    var port = 4001;
    var mockServer = net.createServer(function(socket) {
      socket.write('server/1.0'); // Mimick server
      socket.on('data', function(req) {
        data = JSON.parse(req.toString('utf-8'));

        data.agent.should.equal(package.name + '/' + package.version);

        data.should.have.property('request');
        data.request.should.have.property('receivedAt').and.be.a.Number;
        data.request.should.have.property('method').and.equal('GET');
        data.request.should.have.a.property('protocol').and.equal('http');
        data.request.should.have.a.property('path').and.equal('/');
        data.request.should.have.property('queries');
        data.request.should.have.property('headers');
        data.request.headers.should.have.a.property('host').and.match(/127.0.0.1/);

        data.should.have.property('response');
        data.response.should.have.property('receivedAt').and.be.a.Number;
        data.response.should.have.property('status').and.equal(200);

        data.response.should.have.property('headers');
        data.response.headers.should.have.property('content-type').and.match(/html/);

        //console.log(data);
        mockServer.close();
        done();
      });
    });
    mockServer.listen(port);
    var app = express();

    app.use(agent('fake-key', {host: 'localhost', port: port}));

    app.get('/', function(req, res) {
      res.send('Bonjour');
    });

    app.listen(function() {
      request(app)
        .get('/')
        .expect('Bonjour')
        .end(function() {});
    });
  });
});

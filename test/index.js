/* global describe, it */

'use strict'

var agent = require('../lib')
var debug = require('debug-log')('galileo-test')
var echo = require('./helpers/echo')
var express = require('express')
var pkg = require('../package')
var server = require('./helpers/server')
var unirest = require('unirest')
var alfValidator = require('alf-validator')

require('should')

var serviceToken = 'ALLYOURBASEAREBELONGTOUS'

describe('Agent Middleware', function () {
  describe('Express', function () {
    it('sends a message with an Express server', function (done) {
      var setup = function (port) {
        debug('echo server started on port %s', port)

        // create Express server
        var app = express()

        // Attach agent
        app.use(agent(serviceToken, {
          queue: {
            entries: 1
          },
          collector: {
            host: 'localhost',
            port: port,
            ssl: false
          }
        }))

        // Setup a route
        app.get('/', function (req, res) {
          res.send('Bonjour')
        })

        // Start the server
        server(app, function (port) {
          debug('express server started on port %s', port)

          // send a request
          unirest.get('http://localhost:' + port).end()
        })
      }

      // actual test
      echo(setup, function test (body) {
        body.should.be.an.Object
        body.should.have.property('serviceToken').and.equal(serviceToken)

        done()
      })
    })
  })

  it('sends a message with a standard HTTP server', function (done) {
    var setup = function (port) {
      debug('echo server started on port %s', port)

      // create server
      var analytics = agent(serviceToken, {
        queue: {
          entries: 1
        },
        collector: {
          host: 'localhost',
          port: port,
          ssl: false
        }
      })

      var app = function (req, res) {
        analytics(req, res)

        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.write('Bonjour')
        res.end()
      }

      server(app, function (port) {
        debug('http server started on port %s', port)

        // send a request
        unirest.get('http://localhost:' + port).end()
      })
    }

    // actual test
    echo(setup, function test (body) {
      body.should.be.an.Object
      body.should.have.property('serviceToken').and.equal(serviceToken)

      done()
    })
  })

  it('sends a batched message', function (done) {
    var setup = function (port) {
      debug('echo server started on port %s', port)

      // create server
      var analytics = agent(serviceToken, {
        queue: {
          entries: 10
        },
        collector: {
          host: 'localhost',
          port: port,
          ssl: false
        }
      })

      var app = function (req, res) {
        analytics(req, res)

        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.write('Bonjour')
        res.end()
      }

      server(app, function (port) {
        debug('http server started on port %s', port)

        // call the route x times
        var i = 10

        while (i--) {
          unirest.get('http://localhost:' + port).end()
        }
      })
    }

    echo(setup, function test (body) {
      body.should.be.an.Object
      body.har.log.should.have.property('entries').lengthOf(10)

      done()
    })
  })

  it('should convert http server req, res to HAR', function (done) {
    var setup = function (port) {
      debug('echo server started on port %s', port)

      // create server
      var analytics = agent(serviceToken, {
        logBody: true,
        queue: {
          entries: 1
        },
        limits: {
          bodySize: 1e10
        },
        collector: {
          host: 'localhost',
          port: port,
          ssl: false
        }
      })

      var app = function (req, res) {
        analytics(req, res)

        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.write('Bonjour')
        res.end()
      }

      server(app, function (port) {
        debug('http server started on port %s', port)

        // send a request
        unirest.post('http://localhost:' + port)
          .query('foo=bar')
          .type('json')
          .send({foo: 'bar'})
          .header('host', 'localhost')
          .header('X-Custom-Header', 'foo')
          .end()
      })
    }

    // actual test
    echo(setup, function test (body) {
      alfValidator(body, '1.1.0').then(function () {
        var har = body.har.log

        har.should.be.an.Object

        har.should.have.property('creator').and.be.an.Object
        har.creator.should.have.property('name').and.equal('galileo-agent-node')
        har.creator.should.have.property('version').and.equal(pkg.version)

        har.should.have.property('entries').and.be.an.Array().with.lengthOf(1)

        har.entries[0].should.have.property('serverIPAddress').and.be.a.String
        har.entries[0].should.have.property('clientIPAddress').and.be.a.String
        har.entries[0].should.have.property('startedDateTime').and.be.a.String

        har.entries[0].should.have.property('request').and.be.an.Object
        har.entries[0].request.should.have.property('method').and.equal('POST')
        har.entries[0].request.should.have.property('url').and.equal('http://localhost/?foo=bar')
        har.entries[0].request.should.have.property('httpVersion').and.equal('HTTP/1.1')
        har.entries[0].request.should.have.property('queryString').and.be.an.Array().and.containEql({name: 'foo', value: 'bar'})
        har.entries[0].request.should.have.property('headersSize').and.be.a.Number().and.equal(163)
        har.entries[0].request.should.have.property('bodySize').and.be.a.Number().and.equal(13)
        har.entries[0].request.should.have.property('headers').and.be.an.Array().and.containEql({name: 'x-custom-header', value: 'foo'})

        har.entries[0].request.should.have.property('postData').and.be.an.Object

        // TODO fix request body capture
        // har.entries[0].request.postData.should.have.property('text').and.equal('{"foo":"bar"}')

        har.entries[0].should.have.property('response').and.be.an.Object
        har.entries[0].response.should.have.property('status').and.equal(200)
        har.entries[0].response.should.have.property('statusText').and.equal('OK')
        har.entries[0].response.should.have.property('httpVersion').and.equal('HTTP/1.1')
        har.entries[0].response.should.have.property('headersSize').and.equal(129)

        // TODO fix response bodySize capture
        // har.entries[0].response.should.have.property('bodySize').and.be.a.Number.and.equal(7)

        har.entries[0].response.should.have.property('headers').and.be.an.Array().and.containEql({name: 'Content-Type', value: 'text/plain'})

        har.entries[0].response.should.have.property('content').and.be.an.Object
        har.entries[0].response.content.should.have.property('text').and.equal('Qm9uam91cg==') // Base64 of 'Bonjour'

        har.entries[0].should.have.property('timings').and.be.an.Object
        done()
      }).catch(function (err) {
        done(err)
      })
    })
  })
})

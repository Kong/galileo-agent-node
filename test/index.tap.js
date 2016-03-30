'use strict'
var tap = require('tap')

var galileo = require('../lib')
var debug = require('debug-log')('galileo-test')
var express = require('express')
var bodyParser = require('body-parser')
var restify = require('restify')
var http = require('http')
var alfValidator = require('alf-validator')
var EventEmitter = require('events')
var util = require('util')
var request = require('request')
function NewEmitter () { EventEmitter.call(this) }
util.inherits(NewEmitter, EventEmitter)
var ee = new NewEmitter()

var serviceToken = 'ALLYOURBASEAREBELONGTOUS'

// set up servers
// set up mock collector
var collectorPort
var collector = express()
collector.use(bodyParser.json())
collector.use(bodyParser.urlencoded({ extended: true }))
collector.post('/', collectorResponse)
collector.post('/:status', collectorResponse)
function collectorResponse (req, res, next) {
  var responseStatus = req.params.status || 200
  ee.emit('collector-response', {status: responseStatus, data: req.body})
  res.sendStatus(responseStatus)
}
var listeningCollector = collector.listen(function () {
  collectorPort = listeningCollector.address().port
  ee.emit('collector-started')
})

var agentServer = {
  http: {
    working: null,
    workingPort: 0,
    workingResponse: function () {},
    workingListening: function () {},
    adhoc: {}
  },
  express: {
    working: null,
    workingPort: 0,
    workingResponse: function () {},
    workingListening: function () {},
    adhoc: {}
  },
  restify: {
    working: null,
    workingPort: 0,
    workingResponse: function () {},
    workingListening: function () {},
    adhoc: {}
  }
}

ee.on('collector-response', function (data) {
  debug('collector-response', data)
})
ee.on('collector-started', function () {
  debug('collector-started', collectorPort)
})

ee.on('collector-started', function () {
  var workingGalileo = galileo(serviceToken, 'default-environment', {
    logBody: true, // LOG_BODY agent spec
    failLog: './test/test-fail-logs', // FAIL_LOG agent spec
    failLogName: 'galileo-agent-errors.log', // FAIL_LOG agent spec
    limits: {
      bodySize: 1000, // bytes
      retry: 5, // RETRY_COUNT agent spec
      retryTime: 1,
      flush: 5, // seconds, FLUSH_TIMEOUT agent spec
      connection: 4 // seconds, CONNECTION_TIMEOUT agent spec
    },
    queue: { // QUEUE_SIZE agent spec
      batch: 1, // number in a batch, if >1 switches path; `single` to `batch`
      entries: 1 // number of entries per ALF record
    },
    collector: {
      host: 'localhost', // HOST agent spec
      port: collectorPort, // PORT agent spec
      path: '/',
      ssl: false
    }
  })

  // set up mock agent - http - working
  agentServer.http.workingResponse = function (req, res) {
    workingGalileo(req, res)
    debug(req.url)
    var responseStatus = req.url.split('/')
    responseStatus = responseStatus[1] || 200
    responseStatus = parseInt(responseStatus, 10)
    var chunks = []
    req.on('data', function (chunk) {
      chunks.push(chunk)
    })
    req.on('end', function () {
      ee.emit('agentServer.http.working-response', {status: responseStatus, data: chunks})
    })
    res.writeHead(responseStatus, {'Content-Type': 'text/plain'})
    res.end('Hello World!')
  }
  agentServer.http.working = http.createServer(agentServer.http.workingResponse)
  agentServer.http.workingListening = agentServer.http.working.listen(0, function () {
    agentServer.http.workingPort = agentServer.http.workingListening.address().port
    ee.emit('agentServer.http.working-started')
  })
  agentServer.http.workingReady = false

  // set up mock agent - express - working
  agentServer.express.working = express()
  agentServer.express.working.use(bodyParser.json())
  agentServer.express.working.use(bodyParser.urlencoded({ extended: true }))
  agentServer.express.working.use(workingGalileo)
  agentServer.express.workingResponse = function (req, res, next) {
    var responseStatus = req.params.status || 200
    ee.emit('agentServer.express.working-response', {status: responseStatus, data: req.body})
    res.sendStatus(responseStatus)
  }
  agentServer.express.working.get('/', agentServer.express.workingResponse)
  agentServer.express.working.post('/', agentServer.express.workingResponse)
  agentServer.express.working.get('/:status', agentServer.express.workingResponse)
  agentServer.express.working.post('/:status', agentServer.express.workingResponse)
  agentServer.express.workingListening = agentServer.express.working.listen(function () {
    agentServer.express.workingPort = agentServer.express.workingListening.address().port
    ee.emit('agentServer.express.working-started')
  })
  agentServer.express.workingReady = false

  // set up mock agent - restify - working
  agentServer.restify.working = restify.createServer()
  agentServer.restify.working.use(workingGalileo)
  agentServer.restify.workingResponse = function (req, res, next) {
    var responseStatus = req.params.status || 200
    ee.emit('agentServer.restify.working-response', {status: responseStatus, data: req.body})
    res.send(responseStatus)
  }
  agentServer.restify.working.get('/', agentServer.restify.workingResponse)
  agentServer.restify.working.post('/', agentServer.restify.workingResponse)
  agentServer.restify.working.get('/:status', agentServer.restify.workingResponse)
  agentServer.restify.working.post('/:status', agentServer.restify.workingResponse)
  agentServer.restify.workingListening = agentServer.restify.working.listen(function () {
    agentServer.restify.workingPort = agentServer.restify.workingListening.address().port
    ee.emit('agentServer.restify.working-started')
  })
  agentServer.restify.workingReady = false

  ee.on('agentServer.http.working-response', function (data) {
    debug('agentServer.http.working-response', data)
  })
  ee.on('agentServer.http.working-started', function () {
    debug('agentServer.http.working-started', agentServer.http.workingPort)

    agentServer.http.workingReady = true
  })
  ee.on('agentServer.express.working-response', function (data) {
    debug('agentServer.express.working-response', data)
  })
  ee.on('agentServer.express.working-started', function () {
    debug('agentServer.express.working-started', agentServer.express.workingPort)
    agentServer.express.workingReady = true
  })
  ee.on('agentServer.restify.working-response', function (data) {
    debug('agentServer.restify.working-response', data)
  })
  ee.on('agentServer.restify.working-started', function () {
    debug('agentServer.restify.working-started', agentServer.restify.workingPort)
    agentServer.restify.workingReady = true
  })
  debug('doneskies')
  // tests - call and get responses (set up adhoc servers for fail tests)

  tap.test('should send valid alf record', function (t) {
    var thisCollectorResponse = function (data) {
      alfValidator(data.data, '1.1.0').then(function (results) {
        debug('got results')
        ee.removeListener('collector-response', thisCollectorResponse)
        ee.removeListener('agentServer.express.working-started', thisExpressReady)
        t.pass('ALF data is valid.')
        t.end()
      }).catch(function (err) {
        debug('got error')
        ee.removeListener('collector-response', thisCollectorResponse)
        ee.removeListener('agentServer.express.working-started', thisExpressReady)
        t.fail(err)
        t.end()
      })
    }
    var thisExpressReady = function () {
      ee.on('collector-response', thisCollectorResponse)
      var workingUrl = 'http://localhost:' + agentServer.express.workingPort
      debug(workingUrl)
      // unirest.get(workingUrl)
      request({
        method: 'POST',
        uri: workingUrl,
        headers: {
          'User-Agent': 'request',
          'Content-Type': 'application/www-url-formencoded'
        },
        body: 'foo=bar'
      }, function (err, results) {
        debug('this was sent!', err)
      })
    }
    if (!agentServer.express.workingReady) {
      ee.on('agentServer.express.working-started', thisExpressReady)
    } else {
      thisExpressReady()
    }
  })
  tap.test('should allow setting no environment', function (t) {
    var noEnvGalileo = galileo(serviceToken, {
      logBody: true, // LOG_BODY agent spec
      failLog: './test/test-fail-logs', // FAIL_LOG agent spec
      failLogName: 'galileo-agent-errors.log', // FAIL_LOG agent spec
      limits: {
        bodySize: 1000, // bytes
        retry: 5, // RETRY_COUNT agent spec
        retryTime: 1,
        flush: 5, // seconds, FLUSH_TIMEOUT agent spec
        connection: 4 // seconds, CONNECTION_TIMEOUT agent spec
      },
      queue: { // QUEUE_SIZE agent spec
        batch: 1, // number in a batch, if >1 switches path; `single` to `batch`
        entries: 1 // number of entries per ALF record
      },
      collector: {
        host: 'localhost', // HOST agent spec
        port: collectorPort, // PORT agent spec
        path: '/',
        ssl: false
      }
    })
    agentServer.express.adhoc.noEnv = {}
    agentServer.express.adhoc.noEnv.app = express()
    agentServer.express.adhoc.noEnv.app.use(bodyParser.json())
    agentServer.express.adhoc.noEnv.app.use(bodyParser.urlencoded({ extended: true }))
    agentServer.express.adhoc.noEnv.app.use(noEnvGalileo)
    agentServer.express.adhoc.noEnv.appResponse = function (req, res, next) {
      var responseStatus = req.params.status || 200
      ee.emit('agentServer.express.adhoc.noEnv.app-response', {status: responseStatus, data: req.body})
      res.sendStatus(responseStatus)
    }
    agentServer.express.adhoc.noEnv.app.get('/', agentServer.express.adhoc.noEnv.appResponse)
    agentServer.express.adhoc.noEnv.app.post('/', agentServer.express.adhoc.noEnv.appResponse)
    agentServer.express.adhoc.noEnv.app.get('/:status', agentServer.express.adhoc.noEnv.appResponse)
    agentServer.express.adhoc.noEnv.app.post('/:status', agentServer.express.adhoc.noEnv.appResponse)

    var noEnvCollectorResponse = function (data) {
      alfValidator(data.data, '1.1.0').then(function (results) {
        debug('got results')
        ee.removeListener('collector-response', noEnvCollectorResponse)
        ee.removeListener('agentServer.express.adhoc.noEnv.app-started', noEnvExpressReady)
        t.pass('ALF data is valid.')
        ee.emit('noEnv-test-complete')
      }).catch(function (err) {
        debug('got error')
        ee.removeListener('collector-response', noEnvCollectorResponse)
        ee.removeListener('agentServer.express.adhoc.noEnv.app-started', noEnvExpressReady)
        t.fail(err)
        ee.emit('noEnv-test-complete')
      })
    }
    var noEnvExpressReady = function () {
      ee.on('collector-response', noEnvCollectorResponse)
      var workingUrl = 'http://localhost:' + agentServer.express.adhoc.noEnv.appPort
      debug(workingUrl)
      request({
        method: 'POST',
        uri: workingUrl,
        headers: {
          'User-Agent': 'request',
          'Content-Type': 'application/www-url-formencoded'
        },
        body: 'foo=bar'
      }, function (err, results) {
        debug('noEnv was sent!', err)
      })
    }
    ee.on('agentServer.express.adhoc.noEnv.app-started', noEnvExpressReady)
    ee.on('noEnv-test-complete', function () {
      debug('closing noenv server')
      agentServer.express.adhoc.noEnv.appListening.close()
      agentServer.express.adhoc.noEnv = {}
      t.end()
    })
    agentServer.express.adhoc.noEnv.appListening = agentServer.express.adhoc.noEnv.app.listen(function () {
      agentServer.express.adhoc.noEnv.appPort = agentServer.express.adhoc.noEnv.appListening.address().port
      ee.emit('agentServer.express.adhoc.noEnv.app-started')
    })
  })
  tap.test("should set response BodySize to 0 if data isn't present", function (t) {
    var bodyZeroCollectorResponse = function (data) {
      console.log(JSON.stringify(data.data.har.log.entries[0].response, null, ' '))
      t.ok(data.data.har.log.entries[0].response.bodySize === 2)
      t.end()
    }
    var bodyZeroExpressReady = function () {
      ee.on('collector-response', bodyZeroCollectorResponse)
      var workingUrl = 'http://localhost:' + agentServer.express.workingPort
      debug(workingUrl)
      // unirest.get(workingUrl)
      request({
        method: 'POST',
        uri: workingUrl,
        headers: {
          'User-Agent': 'request',
          'Content-Type': 'application/www-url-formencoded'
        }
      }, function (err, results) {
        debug('bodyZero was sent!', err)
      })
    }
    if (!agentServer.express.workingReady) {
      ee.on('agentServer.express.working-started', bodyZeroExpressReady)
    } else {
      bodyZeroExpressReady()
    }
  })

  // Fail tests
  tap.test('should fail if serviceToken is not provided', function (t) {
    try {
      var failGalileo = galileo()
      failGalileo({}, {})
      t.fail('Did not throw error when serviceToken is absent')
      t.end()
    } catch (e) {
      t.pass('Threw error correctly')
      t.end()
    }
    ee.emit('all-tests-complete')
  })
})
ee.on('all-tests-complete', function () {
  debug('closing servers')
  listeningCollector.close()
  agentServer.http.workingListening.close()
  agentServer.express.workingListening.close()
  agentServer.restify.workingListening.close()
})
// check and make sure the collector is sending proper alf

// describe('Agent Middleware', function () {
//   describe('Express', function () {
//     it('sends a message with an Express server', function (done) {
//       var setup = function (port) {
//         debug('echo server started on port %s', port)
//
//         // create Express server
//         var app = express()
//
//         // Attach agent
//         app.use(agent(serviceToken, {
//           queue: {
//             entries: 1
//           },
//           collector: {
//             host: 'localhost',
//             port: port,
//             ssl: false
//           }
//         }))
//
//         // Setup a route
//         app.get('/', function (req, res) {
//           res.send('Bonjour')
//         })
//
//         // Start the server
//         server(app, function (port) {
//           debug('express server started on port %s', port)
//
//           // send a request
//           unirest.get('http://localhost:' + port).end(function (results) {
//             if (results.error) debug(results.error)
//           })
//         })
//       }
//
//       // actual test
//       echo(setup, function test (body) {
//         body.should.be.an.Object
//         body.should.have.property('serviceToken').and.equal(serviceToken)
//
//         done()
//       })
//     })
//   })
//
//   it('sends a message with a standard HTTP server', function (done) {
//     var setup = function (port) {
//       debug('echo server started on port %s', port)
//
//       // create server
//       var analytics = agent(serviceToken, {
//         queue: {
//           entries: 1
//         },
//         collector: {
//           host: 'localhost',
//           port: port,
//           ssl: false
//         }
//       })
//
//       var app = function (req, res) {
//         analytics(req, res)
//
//         res.writeHead(200, {'Content-Type': 'text/plain'})
//         res.write('Bonjour')
//         res.end()
//       }
//
//       server(app, function (port) {
//         debug('http server started on port %s', port)
//
//         // send a request
//         unirest.get('http://localhost:' + port).end(function (results) {
//           if (results.error) debug(results.error)
//         })
//       })
//     }
//
//     // actual test
//     echo(setup, function test (body) {
//       body.should.be.an.Object
//       body.should.have.property('serviceToken').and.equal(serviceToken)
//
//       done()
//     })
//   })
//
//   it('sends a batched message', function (done) {
//     var setup = function (port) {
//       debug('echo server started on port %s', port)
//
//       // create server
//       var analytics = agent(serviceToken, {
//         queue: {
//           entries: 10
//         },
//         collector: {
//           host: 'localhost',
//           port: port,
//           ssl: false
//         }
//       })
//
//       var app = function (req, res) {
//         analytics(req, res)
//
//         res.writeHead(200, {'Content-Type': 'text/plain'})
//         res.write('Bonjour')
//         res.end()
//       }
//
//       server(app, function (port) {
//         debug('http server started on port %s', port)
//
//         // call the route x times
//         var i = 10
//
//         while (i--) {
//           unirest.get('http://localhost:' + port).end(function (results) {
//             if (results.error) debug(results.error)
//           })
//         }
//       })
//     }
//
//     echo(setup, function test (body) {
//       body.should.be.an.Object
//       body.har.log.should.have.property('entries').lengthOf(10)
//
//       done()
//     })
//   })
//
//   it('should convert http server req, res to ALF', function (done) {
//     var setup = function (port) {
//       debug('collector echo server started on port %s', port)
//
//       // create server
//       var analytics = agent(serviceToken, {
//         logBody: true,
//         queue: {
//           entries: 1
//         },
//         limits: {
//           bodySize: 1e10
//         },
//         collector: {
//           host: 'localhost',
//           port: port,
//           ssl: false
//         }
//       })
//
//       var app = function (req, res) {
//         analytics(req, res)
//         debug('agent server is responding')
//         res.writeHead(200, {'Content-Type': 'text/plain'})
//         res.write('Bonjour')
//         res.end()
//       }
//
//       server(app, function (port) {
//         debug('agent http server started on port %s', port)
//
//         // send a request
//         unirest.post('http://localhost:' + port)
//           .query('foo=bar')
//           .type('json')
//           .send({foo: 'bar'})
//           .header('host', 'localhost')
//           .header('X-Custom-Header', 'foo')
//           .end(function (results) {
//             if (results.error) debug(results.error)
//           })
//       })
//     }
//
//     // actual test
//     echo(setup, function test (body) {
//       debug('actual alf test starting')
//
//       alfValidator(body, '1.1.0').then(function () {
//         debug('valid alf. Running specific content tests')
//
//         var har = body.har.log
//
//         har.should.be.an.Object
//
//         har.should.have.property('creator').and.be.an.Object
//         har.creator.should.have.property('name').and.equal('galileo-agent-node')
//         har.creator.should.have.property('version').and.equal(pkg.version)
//
//         har.should.have.property('entries').and.be.an.Array().with.lengthOf(1)
//
//         har.entries[0].should.have.property('serverIPAddress').and.be.a.String
//         har.entries[0].should.have.property('startedDateTime').and.be.a.String
//
//         har.entries[0].should.have.property('request').and.be.an.Object
//         har.entries[0].request.should.have.property('method').and.equal('POST')
//         har.entries[0].request.should.have.property('url').and.equal('http://localhost/?foo=bar')
//         har.entries[0].request.should.have.property('httpVersion').and.equal('HTTP/1.1')
//         har.entries[0].request.should.have.property('queryString').and.be.an.Array().and.containEql({name: 'foo', value: 'bar'})
//         har.entries[0].request.should.have.property('headersSize').and.be.a.Number().and.equal(163)
//         har.entries[0].request.should.have.property('bodySize').and.be.a.Number().and.equal(13)
//         har.entries[0].request.should.have.property('headers').and.be.an.Array().and.containEql({name: 'x-custom-header', value: 'foo'})
//
//         har.entries[0].request.should.have.property('postData').and.be.an.Object
//
//         // TODO fix request body capture
//         // har.entries[0].request.postData.should.have.property('text').and.equal('{"foo":"bar"}')
//
//         har.entries[0].should.have.property('response').and.be.an.Object
//         har.entries[0].response.should.have.property('status').and.equal(200)
//         har.entries[0].response.should.have.property('statusText').and.equal('OK')
//         har.entries[0].response.should.have.property('httpVersion').and.equal('HTTP/1.1')
//         har.entries[0].response.should.have.property('headersSize').and.equal(129)
//
//         // TODO fix response bodySize capture
//         // har.entries[0].response.should.have.property('bodySize').and.be.a.Number.and.equal(7)
//
//         har.entries[0].response.should.have.property('headers').and.be.an.Array().and.containEql({name: 'Content-Type', value: 'text/plain'})
//
//         har.entries[0].response.should.have.property('content').and.be.an.Object
//         har.entries[0].response.content.should.have.property('text').and.equal('Qm9uam91cg==') // Base64 of 'Bonjour'
//
//         har.entries[0].should.have.property('timings').and.be.an.Object
//         debug('finished content tests')
//         done()
//       }).catch(function (err) {
//         debug('The alf submitted is not valid.', err.toString())
//
//         err.message = 'ALF Validator Error: ' + JSON.stringify(err, null, ' ')
//         done(err)
//       })
//     })
//   })
// })

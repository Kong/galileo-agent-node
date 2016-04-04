'use strict'
var tap = require('tap')

var Galileo = require('../lib')
var debug = require('debug-log')('galileo-test')
var express = require('express')
var bodyParser = require('body-parser')
var restify = require('restify')
var http = require('http')
var zlib = require('zlib')
var fs = require('fs')
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

  var trigger
  if (responseStatus === 'delay') {
    trigger = responseStatus
    responseStatus = 200
  }
  ee.emit('collector-response', {status: responseStatus, data: req.body})
  if (trigger === 'delay') {
    return setTimeout(function () {
      res.sendStatus(responseStatus)
    }, 2000)
  }
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
    gzip: null,
    gzipPort: 0,
    gzipResponse: function () {},
    gzipListening: function () {},
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
  var workingGalileo = new Galileo(serviceToken, 'default-environment', {
    logBody: true, // LOG_BODY agent spec
    failLog: './test/test-fail-logs', // FAIL_LOG agent spec
    failLogName: 'galileo-agent-errors.log', // FAIL_LOG agent spec
    limits: {
      bodySize: 1000, // bytes
      retry: 5, // RETRY_COUNT agent spec
      retryTime: 1,
      flush: 5, // seconds, FLUSH_TIMEOUT agent spec
      connection: 1 // seconds, CONNECTION_TIMEOUT agent spec
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
    var trigger
    if (responseStatus[1] === 'content-length-zero') {
      trigger = responseStatus[1]
      responseStatus = []
    }
    responseStatus = responseStatus[1] || 200
    responseStatus = parseInt(responseStatus, 10)
    var chunks = []
    req.on('data', function (chunk) {
      chunks.push(chunk)
    })
    req.on('end', function () {
      ee.emit('agentServer.http.working-response', {status: responseStatus, data: chunks})
    })
    var headers = {'Content-Type': 'application/json'}
    if (trigger === 'content-length-zero') {
      headers['Content-Length'] = 0
    }
    var raw = fs.createReadStream(__dirname + '/fixture-response.json')
    var acceptEncoding = req.headers['accept-encoding']
    if (!acceptEncoding) {
      acceptEncoding = ''
    }
    // Note: this is not a conformant accept-encoding parser.
    // See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
    if (acceptEncoding.match(/\bgzip\b/)) {
      headers['content-encoding'] = 'gzip'
      res.writeHead(200, headers)
      raw.pipe(zlib.createGzip()).pipe(res)
    } else {
      res.writeHead(200, {})
      raw.pipe(res)
    }
  }
  agentServer.http.working = http.createServer(agentServer.http.workingResponse)
  agentServer.http.workingReady = false
  agentServer.http.workingListening = agentServer.http.working.listen(0, function () {
    agentServer.http.workingPort = agentServer.http.workingListening.address().port
    agentServer.http.workingReady = true
    ee.emit('agentServer.http.working-started')
  })

  // set up mock agent - express - working
  agentServer.express.working = express()
  agentServer.express.working.use(bodyParser.json())
  agentServer.express.working.use(bodyParser.urlencoded({ extended: true }))
  agentServer.express.working.use(workingGalileo)
  agentServer.express.workingResponse = function (req, res, next) {
    var responseStatus = req.params.status || 200
    var trigger
    if (responseStatus === 'delay') {
      trigger = responseStatus
      responseStatus = 200
    }
    if (responseStatus === 'content-length-zero') {
      trigger = responseStatus
      responseStatus = 200
    }
    responseStatus = responseStatus === 'noresponse' ? 200 : responseStatus
    ee.emit('agentServer.express.working-response', {status: responseStatus, data: req.body})
    if (req.params.status === 'noresponse') {
      return res.send('')
    }
    if (trigger === 'content-length-zero') {
      res.setHeader('Content-Length', 0)
    }
    if (trigger === 'delay') {
      return setTimeout(function () {
        res.status(responseStatus).send({'data': 'Hello World!'})
      }, 2000)
    }
    res.status(responseStatus).send({'data': 'Hello World!'})
  }
  agentServer.express.working.get('/', agentServer.express.workingResponse)
  agentServer.express.working.post('/', agentServer.express.workingResponse)
  agentServer.express.working.get('/:status', agentServer.express.workingResponse)
  agentServer.express.working.post('/:status', agentServer.express.workingResponse)
  agentServer.express.workingReady = false
  agentServer.express.workingListening = agentServer.express.working.listen(function () {
    agentServer.express.workingPort = agentServer.express.workingListening.address().port
    agentServer.express.workingReady = true
    ee.emit('agentServer.express.working-started')
  })

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
  agentServer.restify.workingReady = false
  agentServer.restify.workingListening = agentServer.restify.working.listen(function () {
    agentServer.restify.workingPort = agentServer.restify.workingListening.address().port
    agentServer.restify.workingReady = true
    ee.emit('agentServer.restify.working-started')
  })

  ee.on('agentServer.http.working-response', function (data) {
    debug('agentServer.http.working-response', data)
  })
  ee.on('agentServer.http.working-started', function () {
    debug('agentServer.http.working-started', agentServer.http.workingPort)
  })
  ee.on('agentServer.express.working-response', function (data) {
    debug('agentServer.express.working-response', data)
  })
  ee.on('agentServer.express.working-started', function () {
    debug('agentServer.express.working-started', agentServer.express.workingPort)
  })
  ee.on('agentServer.restify.working-response', function (data) {
    debug('agentServer.restify.working-response', data)
  })
  ee.on('agentServer.restify.working-started', function () {
    debug('agentServer.restify.working-started', agentServer.restify.workingPort)
  })

  // tests - call and get responses (set up adhoc servers for fail tests)

  tap.test('should send valid alf record', function (t) {
    var thisCollectorResponse = function (data) {
      alfValidator(data.data, '1.1.0').then(function (results) {
        // 'Zm9vPWJhcg==' === base64('foo=bar')
        t.ok(data.data.har.log.entries[0].request.postData.text === 'Zm9vPWJhcg==', 'should base64 encode request postData')
        // 'eyJkYXRhIjoiSGVsbG8gV29ybGQhIn0='=== base64('{"data":"Hello World!"}')
        t.ok(data.data.har.log.entries[0].response.content.text === 'eyJkYXRhIjoiSGVsbG8gV29ybGQhIn0=', 'should base64 encode response content')
        ee.removeListener('collector-response', thisCollectorResponse)
        ee.removeListener('agentServer.express.working-started', thisExpressReady)
        t.pass('ALF data is valid.')
        t.end()
      }).catch(function (err) {
        debug('got error', err)
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
  tap.test('should handle gzipped bodies', function (t) {
    var gzipCollectorResponse = function (data) {
      alfValidator(data.data, '1.1.0').then(function (results) {
        debug('got results')
        debug(data.data.har.log.entries[0].response.content)
        // 'Zm9vPWJhcg==' === base64('foo=bar')
        t.ok(data.data.har.log.entries[0].request.postData.text === 'Zm9vPWJhcg==', 'should base64 encode request postData')
        // 'eyJkYXRhIjogIkhlbGxvIFdvcmxkISJ9Cg=='=== base64('{"data": "Hello World!"}')
        t.ok(data.data.har.log.entries[0].response.content.text === 'eyJkYXRhIjogIkhlbGxvIFdvcmxkISJ9Cg==', 'should degzip and base64 encode response content')
        ee.removeListener('collector-response', gzipCollectorResponse)
        ee.removeListener('agentServer.http.working-started', gzipHttpReady)
        t.pass('ALF data is valid.')
        t.end()
      }).catch(function (err) {
        debug('got error', err)
        ee.removeListener('collector-response', gzipCollectorResponse)
        ee.removeListener('agentServer.http.working-started', gzipHttpReady)
        t.fail(err)
        t.end()
      })
    }
    var gzipHttpReady = function () {
      ee.on('collector-response', gzipCollectorResponse)
      var gzipUrl = 'http://localhost:' + agentServer.http.workingPort
      debug(gzipUrl)
      // unirest.get(gzipUrl)
      request({
        method: 'POST',
        uri: gzipUrl,
        headers: {
          'User-Agent': 'request',
          'Content-Type': 'application/www-url-formencoded'
        },
        body: 'foo=bar',
        gzip: true
      }, function (err, results) {
        debug('gzip was sent!', err)
      })
    }
    if (!agentServer.http.workingReady) {
      ee.on('agentServer.http.working-started', gzipHttpReady)
    } else {
      gzipHttpReady()
    }
  })
  tap.test('should allow setting no environment', function (t) {
    var noEnvGalileo = new Galileo(serviceToken, {
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
        debug('got error', err)
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
  tap.test("should set request BodySize to 0 if data isn't present", function (t) {
    var reqBodyZeroCollectorResponse = function (data) {
      t.ok(data.data.har.log.entries[0].request.bodySize === 0)
      ee.removeListener('collector-response', reqBodyZeroCollectorResponse)
      ee.removeListener('agentServer.express.working-started', reqBodyZeroExpressReady)
      t.end()
    }
    var reqBodyZeroExpressReady = function () {
      ee.on('collector-response', reqBodyZeroCollectorResponse)
      var workingUrl = 'http://localhost:' + agentServer.express.workingPort
      debug(workingUrl)
      // unirest.get(workingUrl)
      request({
        method: 'GET',
        uri: workingUrl,
        headers: {
          'User-Agent': 'request',
          'Content-Type': 'application/www-url-formencoded'
        }
      }, function (err, results) {
        debug('reqBodyZero was sent!', err)
      })
    }
    if (!agentServer.express.workingReady) {
      ee.on('agentServer.express.working-started', reqBodyZeroExpressReady)
    } else {
      reqBodyZeroExpressReady()
    }
  })
  tap.test("should set response BodySize to 0 if data isn't returned", function (t) {
    var resBodyZeroCollectorResponse = function (data) {
      t.ok(data.data.har.log.entries[0].response.bodySize === 0)
      ee.removeListener('collector-response', resBodyZeroCollectorResponse)
      ee.removeListener('agentServer.express.working-started', resBodyZeroExpressReady)
      t.end()
    }
    var resBodyZeroExpressReady = function () {
      ee.on('collector-response', resBodyZeroCollectorResponse)
      var workingUrl = 'http://localhost:' + agentServer.express.workingPort + '/noresponse'
      debug(workingUrl)
      // unirest.get(workingUrl)
      request({
        method: 'GET',
        uri: workingUrl,
        headers: {
          'User-Agent': 'request',
          'Content-Type': 'application/www-url-formencoded'
        }
      }, function (err, results) {
        debug('resBodyZero was sent!', err)
      })
    }
    if (!agentServer.express.workingReady) {
      ee.on('agentServer.express.working-started', resBodyZeroExpressReady)
    } else {
      resBodyZeroExpressReady()
    }
  })
  // Fail tests
  tap.test('should write request to disk if server refuses connection', function (t) {
    var deadServerGalileo = new Galileo(serviceToken, {
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
        port: collectorPort - 1, // PORT agent spec
        path: '/',
        ssl: false
      }
    })
    agentServer.express.adhoc.deadServer = {}
    agentServer.express.adhoc.deadServer.app = express()
    agentServer.express.adhoc.deadServer.app.use(bodyParser.json())
    agentServer.express.adhoc.deadServer.app.use(bodyParser.urlencoded({ extended: true }))
    agentServer.express.adhoc.deadServer.app.use(deadServerGalileo)
    agentServer.express.adhoc.deadServer.appResponse = function (req, res, next) {
      var responseStatus = req.params.status || 200
      ee.emit('agentServer.express.adhoc.deadServer.app-response', {status: responseStatus, data: req.body})
      res.sendStatus(responseStatus)
    }
    agentServer.express.adhoc.deadServer.app.get('/', agentServer.express.adhoc.deadServer.appResponse)
    agentServer.express.adhoc.deadServer.app.post('/', agentServer.express.adhoc.deadServer.appResponse)
    agentServer.express.adhoc.deadServer.app.get('/:status', agentServer.express.adhoc.deadServer.appResponse)
    agentServer.express.adhoc.deadServer.app.post('/:status', agentServer.express.adhoc.deadServer.appResponse)
    var deadServerExpressReady = function () {
      var workingUrl = 'http://localhost:' + agentServer.express.adhoc.deadServer.appPort
      debug(workingUrl)
      request({
        method: 'GET',
        uri: workingUrl,
        headers: {
          'User-Agent': 'request',
          'Content-Type': 'application/www-url-formencoded'
        }
      }, function (err, results) {
        debug('deadServer was sent!', err)

        // check fail log

        ee.removeListener('agentServer.express.adhoc.deadServer.app-started', deadServerExpressReady)
        setTimeout(function () {
          ee.emit('deadServer-test-complete')
        }, 6000)
      })
    }
    ee.on('agentServer.express.adhoc.deadServer.app-started', deadServerExpressReady)
    ee.on('deadServer-test-complete', function () {
      debug('closing dead server')
      agentServer.express.adhoc.deadServer.appListening.close()
      agentServer.express.adhoc.deadServer = {}
      t.end()
    })
    agentServer.express.adhoc.deadServer.appListening = agentServer.express.adhoc.deadServer.app.listen(function () {
      agentServer.express.adhoc.deadServer.appPort = agentServer.express.adhoc.deadServer.appListening.address().port
      ee.emit('agentServer.express.adhoc.deadServer.app-started')
    })
  })

  tap.test('should fail if serviceToken is not provided', function (t) {
    try {
      var failGalileo = new Galileo()
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
  listeningCollector.close()
  agentServer.http.workingListening.close()
  agentServer.express.workingListening.close()
  agentServer.restify.workingListening.close()
  process.exit()
})

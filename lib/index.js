'use strict'

var async = require('async')
var debug = require('debug-log')('mashape-analytics')
var extend = require('xtend')
var helpers = require('./helpers')
var pkg = require('../package.json')
var http = require('http')
var url = require('url')
var util = require('util')

module.exports = function Agent (serviceToken, options) {
  // ensure agent key exists
  if (!serviceToken) {
    throw new Error('a service token is required, visit: https://analytics.mashape.com/ to obtain one')
  }

  // ensure instance type
  if (!(this instanceof Agent)) {
    return new Agent(serviceToken, options)
  }

  // this alias
  var self = this

  // setup options with defaults
  self.opts = extend({
    host: 'socket.analytics.mashape.com',
    port: 80,
    sendBody: false,
    reqByteLimit: 1e10,
    entriesPerHar: 1
  }, options)

  // setup event queue
  // TODO specify worker pool
  // TODO use msgpack + gzip?
  this.queue = async.queue(function (entry, done) {
    // append entry to log
    self.message.har.log.entries.push(entry)

    debug('queue [%d/%d]', self.message.har.log.entries.length, self.opts.entriesPerHar)

    // throttle
    if (self.message.har.log.entries.length < self.opts.entriesPerHar) {
      return done()
    }

    // construct HTTP mesasge body
    var postData = JSON.stringify(self.message)

    // immediatly reset entries object
    self.message.har.log.entries = []

    // send the log
    var request = http.request({
      host: self.opts.host,
      port: self.opts.port,
      path: '/1.0.0/alf',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': util.format('%s/%s', self.message.har.log.creator.name, self.message.har.log.creator.version)
      }
    })

    request.on('response', function (res) {
      debug('STATUS: ' + res.statusCode)
      debug('HEADERS: ' + JSON.stringify(res.headers))
      res.setEncoding('utf8')
      res.on('data', function (chunk) {
        debug('BODY: ' + chunk)
      })

      done()
    })

    request.on('error', function (err) {
      debug('problem with request: %s', err.message)

      done()
    })

    request.write(postData)
    request.end()
  })

  // init HAR object
  this.message = {
    serviceToken: serviceToken,

    har: {
      log: {
        version: '1.2',
        creator: {
          name: 'mashape-analytics-agent-node',
          version: pkg.version
        },

        entries: []
      }
    }
  }

  // API Recorder Middleware
  // TODO use tamper or tamper-esque method to get raw body
  //      to determine raw content size to get infer compression size
  return function (req, res, next) {
    var reqReceived = new Date()

    // body container
    var bytes = 0

    var bodies = {
      req: {
        size: 0,
        base64: null
      },

      res: {
        size: 0,
        base64: null
      }
    }

    // buffer container
    var chunked = {
      req: [],
      res: []
    }

    // store original methods for later use
    var func = {
      end: res.end,
      write: res.write
    }

    // grab the request body
    if (self.opts.sendBody) {
      req.on('data', function (chunk) {
        bytes += chunk.length

        if (bytes <= self.opts.reqByteLimit) {
          chunked.req.push(chunk)
        }
      })
    }

    // construct the request body
    if (self.opts.sendBody) {
      req.on('end', function () {
        var body = Buffer.concat(chunked.req)

        bodies.req.size = body.length
        bodies.req.base64 = body.toString('utf8')
      })
    }

    // override node's http.ServerResponse.write method
    res.write = function (chunk, encoding) {
      // call the original http.ServerResponse.write method
      func.write.call(res, chunk, encoding)

      chunked.res.push(chunk)
    }

    // override node's http.ServerResponse.end method
    res.end = function (data, encoding) {
      // call the original http.ServerResponse.end method
      func.end.call(res, data, encoding)

      if (chunked.res.length) {
        data = Buffer.concat(chunked.res)
      }

      // construct body
      bodies.res.size = data ? data.length : 0
      bodies.res.base64 = data ? data.toString('utf8') : null

      var agentResStartTime = new Date()
      var reqHeadersArr = helpers.objectToArray(req.headers)

      var resHeaders = helpers.parseResponseHeaderString(res._header)

      var resContentLength = parseInt(helpers.getHeaderValue(resHeaders.headersArr, 'content-length', 0), 10)
      var resBodySize = resContentLength === 0 && bodies.res.size > 0 ? bodies.res.size : resContentLength

      var reqContentLength = parseInt(helpers.getHeaderValue(reqHeadersArr, 'content-length', 0), 10)
      var reqBodySize = reqContentLength === 0 && bodies.req.size > 0 ? bodies.req.size : reqContentLength

      var waitTime = agentResStartTime.getTime() - reqReceived.getTime()
      var protocol = req.connection.encrypted ? 'https' : 'http'

      var entry = {
        serverIPAddress: helpers.getServerAddress(),
        startedDateTime: agentResStartTime.toISOString(),

        request: {
          method: req.method,
          url: util.format('%s://%s%s', protocol, req.headers.host, req.url),
          httpVersion: 'HTTP/' + req.httpVersion,
          queryString: helpers.objectToArray(url.parse(req.url, true).query),
          headers: reqHeadersArr,
          headersSize: helpers.getReqHeaderSize(req),
          bodySize: reqBodySize,
          postData: {
            mimeType: helpers.getHeaderValue(reqHeadersArr, 'content-type', 'application/octet-stream'),
            text: self.opts.sendBody ? bodies.req.base64 : null
          }
        },

        response: {
          status: res.statusCode,
          statusText: resHeaders.statusText,
          httpVersion: resHeaders.version,
          headers: resHeaders.headersArr,
          headersSize: res._header ? new Buffer(res._header).length : 0,
          bodySize: resBodySize,
          content: {
            // TODO measure before compression, if any
            size: resBodySize,
            mimeType: helpers.getHeaderValue(resHeaders.headersArr, 'content-type', 'application/octet-stream'),
            text: self.opts.sendBody ? bodies.res.base64 : null
          }
        },

        timings: {
          send: 0, // TODO
          wait: waitTime,
          receive: 0  // TODO
        }
      }

      // log some info
      debug('[%d] %s %s', res.statusCode, entry.request.method, entry.request.url)

      // send to queue
      self.queue.push(entry)
    }

    if (typeof next === 'function') {
      next()
    }
  }
}

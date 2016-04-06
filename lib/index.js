'use strict'

var debug = require('debug-log')('galileo')
var extend = require('xtend')
var helpers = require('./helpers')
var Queue = require('./queue')
var url = require('url')
var util = require('util')

module.exports = function Agent (serviceToken, environment, options) {
  // ensure agent key exists
  if (!serviceToken) {
    throw new Error('a service token is required, visit: ' +
      'https://galileo.mashape.com/ to obtain one')
  }

  // ensure instance type
  if (!(this instanceof Agent)) {
    return new Agent(serviceToken, environment, options)
  }

  // this alias
  var self = this

  // no environment specified
  if (typeof environment === 'object') {
    options = environment
    environment = null
  }

  // setup options with defaults
  self.opts = extend({
    logBody: false, // LOG_BODY agent spec
    failLog: '/dev/null', // FAIL_LOG agent spec
    failLogName: 'galileo-agent-errors.log', // FAIL_LOG agent spec
    limits: {
      bodySize: 1000, // bytes
      retry: 2, // RETRY_COUNT agent spec
      retryTime: 5, // seconds
      flush: 5, // seconds, FLUSH_TIMEOUT agent spec
      connection: 30 // seconds, CONNECTION_TIMEOUT agent spec
    },
    queue: { // QUEUE_SIZE agent spec
      batch: 1, // number in a batch, if >1 switches path; `single` to `batch`
      entries: 100 // number of entries per ALF record
    },
    collector: {
      host: 'collector.galileo.mashape.com', // HOST agent spec
      port: 443, // PORT agent spec
      path: '/1.1.0/single',
      ssl: true
    }

  }, options)
  debug('[agent] plugin options: %s', JSON.stringify(self.opts, null, ' '))

  // setup request queue
  this.queue = new Queue(serviceToken, environment, self.opts)

  // API Recorder Middleware
  // TODO use tamper or tamper-esque method to get raw body
  //      to determine raw content size to get infer compression size
  return function (req, res, next) {
    var reqReceived = new Date()
    var reqEndFired = false
    // assign clientIpAddress for each call
    self.clientIPAddress = helpers.getClientAddress(req)

    // body container
    var bytes = {
      req: 0,
      res: 0
    }

    var bodies = {
      req: {
        size: 0,
        base64: ''
      },

      res: {
        size: 0,
        base64: ''
      }
    }

    // buffer container
    var chunked = {
      req: [],
      res: []
    }

    // grab the request body
    if (self.opts.logBody) {
      req.on('data', function (chunk) {
        bytes.req += chunk.length

        if (bytes.req <= self.opts.limits.bodySize) {
          chunked.req.push(chunk)
        }
      })
    }

    // construct the request body
    if (self.opts.logBody) {
      req.on('end', function () {
        reqEndFired = true
        var body = Buffer.concat(chunked.req)
        bodies.req.size = body.length
        bodies.req.base64 = body ? body.toString('base64') : ''
      })
    }

    // store original methods for later use
    var func = {
      end: res.end,
      write: res.write
    }

    // override node's http.ServerResponse.write method
    res.write = function (chunk, encoding) {
      // call the original http.ServerResponse.write method
      func.write.call(res, chunk, encoding)
      bytes.res += chunk.length

      if (bytes.res <= self.opts.limits.bodySize) {
        chunked.res.push(chunk)
      }
    }

    // override node's http.ServerResponse.end method
    res.end = function (data, encoding) {
      // call the original http.ServerResponse.end method
      func.end.call(res, data, encoding)

      if (chunked.res.length) {
        chunked.res = chunked.res.map(function (chunk) {
          if (chunk instanceof Buffer) {
            return chunk
          }
          return new Buffer(chunk)
        })
        data = Buffer.concat(chunked.res)
      }

      // construct body
      bodies.res.size = data.length
      bodies.res.base64 = bodies.res.size && data ? data.toString('base64') : ''

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
        time: waitTime, // TODO
        startedDateTime: agentResStartTime.toISOString(),

        request: {
          method: req.method,
          url: util.format('%s://%s%s', protocol, req.headers.host, req.url),
          httpVersion: 'HTTP/' + req.httpVersion,
          queryString: helpers.objectToArray(url.parse(req.url, true).query),
          headers: reqHeadersArr,
          headersSize: helpers.getReqHeaderSize(req),
          bodySize: reqBodySize,
          bodyCaptured: !!bodies.req.base64.length
        },

        response: {
          status: res.statusCode,
          statusText: resHeaders.statusText,
          httpVersion: resHeaders.version,
          headers: resHeaders.headersArr,
          headersSize: res._header ? new Buffer(res._header).length : 0,
          bodySize: resBodySize,
          bodyCaptured: !!bodies.res.base64.length
        },

        timings: {
          send: 0, // TODO
          wait: waitTime,
          receive: 0 // TODO
        }
      }
      if (self.clientIPAddress && self.clientIPAddress !== '') {
        entry.clientIPAddress = self.clientIPAddress
      }
      if (helpers.getServerAddress() && helpers.getServerAddress() !== '') {
        entry.serverIPAddress = helpers.getServerAddress()
      }
      if (self.opts.logBody && bodies.req.base64.length) {
        entry.request.postData = {
          mimeType: req.headers['content-type'],
          text: bodies.req.base64,
          encoding: 'base64'
        }
      }
      if (self.opts.logBody && bodies.res.base64.length) {
        var contentType = 'text/plain'
        if (res._header && res._header.indexOf('Content-Type:')) {
          contentType = res._header.split('Content-Type: ')[1].split('\r\n')[0]
        }
        entry.response.content = {
          mimeType: contentType,
          text: bodies.res.base64,
          encoding: 'base64'
        }
      }

      debug('[agent] triggered on [%s] %s %s', res.statusCode, entry.request.method, entry.request.url)

      // send to queue
      if (self.opts.logBody && !reqEndFired) { // only run this if req.on('end') has not fired yet
        // for some reason, req.on('end', fn) is being fired after res.end(fn)
        // this event is here to make sure the request body is being logged
        req.on('end', function () {
          if (bodies.req.base64.length) {
            entry.request.postData = {
              mimeType: req.headers['content-type'],
              text: bodies.req.base64,
              encoding: 'base64'
            }
            entry.request.bodyCaptured = true
            reqContentLength = parseInt(helpers.getHeaderValue(reqHeadersArr, 'content-length', 0), 10)
            reqBodySize = reqContentLength === 0 && bodies.req.size > 0 ? bodies.req.size : reqContentLength
            entry.request.bodySize = reqBodySize
          }
          reqEndFired = false // reset flag
          self.queue.push(entry)
        })
      } else {
        reqEndFired = false // reset flag
        self.queue.push(entry)
      }
    }

    if (typeof next === 'function') {
      next()
    }
  }
}

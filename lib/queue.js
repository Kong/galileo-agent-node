'use strict'

var async = require('async')
var debug = require('debug-log')('galileo')
var dataDebug = require('debug-log')('galileo-data')
var http = require('http')
var https = require('https')
var pkg = require('../package.json')
var util = require('util')
var helpers = require('./helpers')
var fs = require('fs')
var path = require('path')
var uuid = require('uuid')

/**
 * ALF Queue
 */
var Queue = module.exports = function (serviceToken, environment, options) {
  var self = this

  this.opts = options
  this.userAgent = util.format('%s/%s', 'galileo-agent-node', pkg.version)
  this.flushTimer = {
    started: false,
    start: function () {
      var timerSelf = this
      if (timerSelf.started) return
      debug('[agent] flush timer started (%ds)', self.opts.limits.flush)
      timerSelf.started = true
      timerSelf.timer = setTimeout(function () {
        if (self.alf.har.log.entries.length) {
          debug('[agent] flush timer limit reached', 'agent')
          timerSelf.started = false
          self.flush()
        }
      }, self.opts.limits.flush * 1000)
    },
    timer: {}
  }

  this.queue = async.queue(function (entry, done) {
    // append entry to log
    self.alf.har.log.entries.push(entry)

    // TODO Implement idle flusher

    // throttle
    if (self.alf.har.log.entries.length >= self.opts.queue.entries) {
      debug('[agent] flush timer reset', 'agent')
      self.flushTimer.started = false
      clearTimeout(self.flushTimer.timer)
      self.flushTimer.timer = false
      self.flush()
      return done()
    }
    self.flushTimer.start()

    debug('[agent] queued (%d/%d)', self.alf.har.log.entries.length, self.opts.queue.entries)
    done()
  })

  // init HAR object
  this.alf = {
    version: '1.1.0',
    serviceToken: serviceToken,
    environment: environment || '',

    har: {
      log: {
        creator: {
          name: 'galileo-agent-node',
          version: pkg.version
        },

        entries: []
      }
    }
  }
}

/**
 * push entry to queue
 */
Queue.prototype.push = function (entry) {
  this.queue.push(entry)
}

/**
 * flush to collector server
 */
Queue.prototype.flush = function () {
  debug('[agent] sending (%d)', this.alf.har.log.entries.length)

  var flushId = uuid.v4()

  // construct HTTP mesasge body
  var postData = JSON.stringify(this.alf)
  dataDebug('[agent data] postData %s', postData)

  // immediatly reset entries object
  this.alf.har.log.entries = []
  var opts = this.opts
  opts.userAgent = this.userAgent
  this.postToCollector(flushId, postData, opts, this.opts.limits.retry)
}

Queue.prototype.flushInProgress = function (set, flushId) {
  this.currentlyFlushing = this.currentlyFlushing || false
  if (set === true || set === false) {
    this.currentlyFlushing = set
    this.flushingDataSet = set ? flushId : false
  }
  return {
    running: this.currentlyFlushing,
    dataSet: this.flushingDataSet
  }
}

Queue.prototype.postToCollector = function (flushId, postData, opts, iteration, responses) {
  var self = this
  if (this.flushInProgress().running && this.flushInProgress().dataSet !== flushId) {
    debug('[agent] flush in progress for %s. Waiting to send %s data.', this.flushInProgress().dataSet, flushId)
    return setTimeout(function () {
      self.postToCollector(flushId, postData, opts, iteration, responses)
    }, 1000)
  }
  this.flushInProgress(true, flushId)
  responses = responses || []
  var client = opts.collector.ssl ? https : http

  var request = client.request({
    host: opts.collector.host,
    port: opts.collector.port,
    path: opts.collector.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': opts.userAgent
    }
  })

  var timeout = opts.limits.connection
  timeout *= 1000
  var timeOutError
  request.setTimeout(timeout, function () {
    debug('[collector] connection timed out after %d seconds.', opts.limits.connection)
    timeOutError = 'Connection timed out after ' + opts.limits.connection + ' seconds'
    request.abort()
  })

  request.on('response', function (res) {
    var chunks = []

    res.on('data', function (chunk) {
      chunks.push(chunk)
    })

    res.on('end', function () {
      debug('[collector] %d %s: %s', res.statusCode, res.statusMessage, Buffer.concat(chunks))
      self.flushInProgress(false)
      if (res.statusCode !== 200) {
        responses.push(Buffer.concat(chunks))
        self.writeErrorsToDisk(responses, postData, opts)
      }
    })
  })

  request.on('error', function (err) {
    if (!timeOutError) {
      debug('[collector] problem with connection: %s', err.message)
      responses.push(err.message)
    } else {
      responses.push(timeOutError)
    }
    // handle error, retry, write to disk
    if (iteration) {
      iteration--
      var retryTime = opts.limits.retryTime
      retryTime *= 1000
      debug('[agent] retrying in %d seconds', opts.limits.retryTime)
      setTimeout(function () {
        debug('[agent] retrying post. Remaining retries: %d', iteration)
        self.postToCollector(flushId, postData, opts, iteration, responses)
      }, retryTime)
    } else {
      self.flushInProgress(false)
      self.writeErrorsToDisk(responses, postData, opts)
    }
  })
  request.write(postData)
  request.end()
}

Queue.prototype.writeErrorsToDisk = function (response, postData, opts) {
  debug('[agent] %s', 'aborting retries')
  dataDebug('[agent data] errorData %s', JSON.stringify(response))
  if (opts.failLog === '/dev/null') return

  debug('[agent] %s: %s', 'writing errors to disk', opts.failLog)
  response = helpers.uniq(response)
  var failLog = opts.failLog
  // check if failLog if relative or absolute
  if (!path.isAbsolute(failLog)) {
    // if relative, make absolute
    failLog = path.resolve(process.cwd(), failLog)
  }
  // check if exists
  var failPath
  var pathExists
  try {
    failPath = fs.lstatSync(failLog)
    pathExists = true
  } catch (e) {}

  if (pathExists && failPath.isDirectory()) {
    failLog += '/'
    failLog += opts.failLogName
    failLog = path.normalize(failLog)

    // yes, this is ugly. I wanted pretty printing only one level deep, and
    // this did the job. If you know of a better way, please let me know - Trent
    var time = new Date()
    var failObj = {
      date: time.toString(),
      unix: Math.round(time.getTime() / 1000),
      collectorResponse: response,
      data_to_post: JSON.parse(postData)
    }
    var failMessage = JSON.stringify(failObj)
    failMessage += '\n'

    var writeOrAppend = 'writeFile'
    try {
      failPath = fs.lstatSync(failLog)
      writeOrAppend = 'appendFile'
    } catch (e) {}
    fs[writeOrAppend](failLog, failMessage, function (err) {
      if (err) {
        console.error('[agent] %s: %s', 'error writing error to log', err)
      }
      debug('[agent] %s', 'successfully wrote errors to disk')
    })
  } else if (pathExists) {
    console.error('[agent] %s: %s', opts.failLog, 'failLog must be a directory. Please adjust settings and restart server.')
  } else {
    console.error('[agent] %s: %s', opts.failLog, 'failLog directory does not exist. discarding error.')
  }
}

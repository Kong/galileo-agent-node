'use strict'

var async = require('async')
var chalk = require('chalk')
var debug = require('debug-log')('galileo')
var dataDebug = require('debug-log')('galileo-data')
var http = require('http')
var https = require('https')
var pkg = require('../package.json')
var util = require('util')
var helpers = require('./helpers')
var fs = require('fs')
var path = require('path')

/**
 * ALF Queue
 */
var Queue = module.exports = function (serviceToken, environment, options) {
  var self = this

  this.opts = options
  this.userAgent = util.format('%s/%s', 'galileo-agent-node', pkg.version)

  // setup event queue
  // TODO specify worker pool
  // TODO use msgpack + gzip?
  this.queue = async.queue(function (entry, done) {
    // append entry to log
    self.alf.har.log.entries.push(entry)

    // throttle
    if (self.alf.har.log.entries.length >= self.opts.queue.entries) {
      self.flush()
      return done()
    }

    debug('[%s] queued (%d/%d)', chalk.yellow('agent'), self.alf.har.log.entries.length, self.opts.queue.entries)
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
  debug('[%s] sending (%d)', chalk.yellow('agent'), this.alf.har.log.entries.length)

  // construct HTTP mesasge body
  var postData = JSON.stringify(this.alf)
  dataDebug('[%s] postData %s', chalk.yellow('agent data'), postData)

  // immediatly reset entries object
  this.alf.har.log.entries = []
  var opts = this.opts
  opts.userAgent = this.userAgent
  postToCollector(postData, opts, this.opts.limits.retry)
}

function postToCollector (postData, opts, iteration, responses) {
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
    debug('[%s] connection timed out after %d seconds.', chalk.magenta('collector'), opts.limits.connection)
    timeOutError = 'Connection timed out after ' + opts.limits.connection + ' seconds'
    request.abort()
  })

  request.on('response', function (res) {
    var chunks = []

    res.on('data', function (chunk) {
      chunks.push(chunk)
    })

    res.on('end', function () {
      debug('[%s] %d %s: %s', chalk.magenta('collector'), res.statusCode, res.statusMessage, Buffer.concat(chunks))
      if (res.statusCode !== 200) {
        responses.push(Buffer.concat(chunks))
        writeErrorsToDisk(responses, postData, opts)
      }
    })
  })

  request.on('error', function (err) {
    if (!timeOutError) {
      debug('[%s] problem with connection: %s', chalk.magenta('collector'), err.message)
      responses.push(err.message)
    } else {
      responses.push(timeOutError)
    }
    // handle error, retry, write to disk
    if (iteration) {
      iteration--
      var retryTime = opts.limits.retryTime
      retryTime *= 1000
      debug('[%s] retrying in %d seconds', chalk.yellow('agent'), opts.limits.retryTime)
      setTimeout(function () {
        debug('[%s] retrying post. Remaining retries: %d', chalk.yellow('agent'), iteration)
        postToCollector(postData, opts, iteration, responses)
      }, retryTime)
    } else {
      writeErrorsToDisk(responses, postData, opts)
    }
  })
  request.write(postData)
  request.end()
}

function writeErrorsToDisk (response, postData, opts) {
  debug('[%s] %s', chalk.yellow('agent'), 'aborting retries')
  dataDebug('[%s] errorData %s', chalk.yellow('agent data'), JSON.stringify(response))
  if (opts.failLog === '/dev/null') return

  debug('[%s] %s: %s', chalk.yellow('agent'), 'writing errors to disk', opts.failLog)
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
      date:time.toString(),
      unix:Math.round(time.getTime() / 1000),
      collectorResponse:response,
      data_to_post:JSON.parse(postData)
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
        console.error('[%s] %s: %s', chalk.yellow('agent'), 'error writing error to log', err)
      }
      debug('[%s] %s', chalk.yellow('agent'), 'successfully wrote errors to disk')
    })
  } else if (pathExists) {
    console.error('[%s] %s: %s', chalk.yellow('agent'), opts.failLog, 'failLog must be a directory. Please adjust settings and restart server.')
  } else {
    console.error('[%s] %s: %s', chalk.yellow('agent'), opts.failLog, 'failLog directory does not exist. discarding error.')
  }
}

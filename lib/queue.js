'use strict'

var async = require('async')
var chalk = require('chalk')
var debug = require('debug-log')('galileo')
var fnDebug = require('debug-log')('function')
var dataDebug = require('debug-log')('data')
fnDebug('')
var http = require('http')
var https = require('https')
var pkg = require('../package.json')
var util = require('util')

/**
 * ALF Queue
 */
var Queue = module.exports = function (serviceToken, environment, options) {
  fnDebug('Queue')
  var self = this

  this.opts = options
  this.userAgent = util.format('%s/%s', 'galileo-agent-node', pkg.version)

  // setup event queue
  // TODO specify worker pool
  // TODO use msgpack + gzip?
  this.queue = async.queue(function (entry, done) {
    fnDebug('this.queue = async.queue')
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
  fnDebug('Queue.prototype.push')
  this.queue.push(entry)
}

/**
 * flush to collector server
 */
Queue.prototype.flush = function () {
  fnDebug('Queue.prototype.flush')
  debug('[%s] sending (%d)', chalk.yellow('agent'), this.alf.har.log.entries.length)

  // construct HTTP mesasge body
  var postData = JSON.stringify(this.alf)

  // immediatly reset entries object
  this.alf.har.log.entries = []

  var client = this.opts.collector.ssl ? https : http

  var request = client.request({
    host: this.opts.collector.host,
    port: this.opts.collector.port,
    path: this.opts.collector.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent
    }
  })

  request.on('response', function (res) {
    fnDebug('request.on(\'response\'')
    var chunks = []

    res.on('data', function (chunk) {
      fnDebug('res.on(\'data\'')
      chunks.push(chunk)
    })

    res.on('end', function () {
      fnDebug('res.on(\'end\'')
      debug('[%s] %d %s: %s', chalk.magenta('collector'), res.statusCode, res.statusMessage, Buffer.concat(chunks))
    })
  })

  request.on('error', function (err) {
    fnDebug('request.on(\'error\'')
    debug('[%s] problem with connection: %s', chalk.magenta('collector'), err.message)
  })
  dataDebug(postData)
  dataDebug(this.opts.collector.host, this.opts.collector.port, this.opts.collector.path)
  request.write(postData)
  request.end()
}

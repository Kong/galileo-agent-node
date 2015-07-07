'use strict'

var async = require('async')
var chalk = require('chalk')
var debug = require('debug-log')('mashape-analytics-queue')
var http = require('http')
var https = require('https')
var pkg = require('../package.json')
var util = require('util')

/**
 * ALF Queue
 */
var Queue = module.exports = function (serviceToken, environment, options) {
  var self = this

  this.opts = options
  this.userAgent = util.format('%s/%s', 'mashape-analytics-agent-node', pkg.version)

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
    version: '1.0.0',
    serviceToken: serviceToken,
    environment: environment || '',

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
}

/**
 * push entry to queue
 */
Queue.prototype.push = function (entry) {
  this.queue.push(entry)
}

/**
 * flush to socket server
 */
Queue.prototype.flush = function () {
  debug('[%s] sending (%d)', chalk.yellow('agent'), this.alf.har.log.entries.length)

  // construct HTTP mesasge body
  var postData = JSON.stringify(this.alf)

  // immediatly reset entries object
  this.alf.har.log.entries = []

  var client = this.opts.ssl ? https : http

  var request = client.request({
    host: this.opts.host,
    port: this.opts.port,
    path: '/1.0.0/single',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent
    }
  })

  request.on('response', function (res) {
    var chunks = []

    res.on('data', function (chunk) {
      chunks.push(chunk)
    })

    res.on('end', function () {
      debug('[%s] %d %s: %s', chalk.magenta('socket'), res.statusCode, res.statusMessage, Buffer.concat(chunks))
    })
  })

  request.on('error', function (err) {
    debug('[%s] problem with connection: %s', chalk.magenta('socket'), err.message)
  })

  request.write(postData)
  request.end()
}

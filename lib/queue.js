'use strict'

var async = require('async')
var chalk = require('chalk')
var debug = require('debug-log')('galileo')
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
    var chunks = []

    res.on('data', function (chunk) {
      chunks.push(chunk)
    })

    res.on('end', function () {
      debug('[%s] %d %s: %s', chalk.magenta('collector'), res.statusCode, res.statusMessage, Buffer.concat(chunks))
    })
  })

  request.on('error', function (err) {
    debug('[%s] problem with connection: %s', chalk.magenta('collector'), err.message)
  })
  request.write(postData)
  request.end()
}

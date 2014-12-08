var async   = require('async');
var har     = require('./har');
var io      = require('socket.io-client');
var log     = require('debug')('apianalytics');

module.exports = function Agent (serviceToken, options) {
  var self = this;

  // Ensure instance type
  if (!(this instanceof Agent)) {
    return new Agent(serviceToken, options);
  }

  // Ensure agent key exists
  if (!serviceToken) {
    throw new Error(
      'Mashape Analytics requires an API-KEY, to obtain a key visit: http://apianalytics.com'
    );
  }

  // Setup
  this.options = options || {};
  this.connected = false;
  this.serviceToken = serviceToken;

  // Setup options
  this.options.host = this.options.host || 'server.apianalytics.com';
  this.options.port = this.options.port || 80;

  // Setup event queue
  // TODO specify worker pool
  // TODO use msgpack + gzip?
  this.eventQueue = async.queue(function (event, done) {
    self.client.emit('record', event);
    log('Recorded %s %s request ', event.entries[0].request.method, event.entries[0].request.url);
    done();
  });

  // Pause event queue until connected to Analytics server
  this.eventQueue.pause();

  // Connect to Analytics server
  this.client = io('ws://' + self.options.host + ':' + self.options.port);
  this.client.on('connect', function() {
    self.connected = true;
    log('Connected to API Analytics socket.io server with service token %s', serviceToken);
    self.eventQueue.resume();
  });

  // API Recorder Middleware
  // TODO use tamper or tamper-esque method to get raw body
  //      to determine raw content size to get infer compression size
  return function (req, res, next) {
    var reqReceived = new Date();

    res.on('finish', function () {
      var model = har(req, res, reqReceived, serviceToken);
      self.eventQueue.push(model);
    });

    if (typeof next === 'function') {
      next();
    }
  };
};

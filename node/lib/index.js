var async       = require('async');
var har         = require('./har');
var io          = require('socket.io-client');
var log         = require('debug')('apianalytics');
var onFinished  = require('on-finished');
var util        = require('util');

var defaultLoggerFn = function(message) {
  log(message);
}

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
  this.log = this.options.logger || defaultLoggerFn;

  // Setup options
  this.options.host = this.options.host || 'server.apianalytics.com';
  this.options.port = this.options.port || 80;

  // Setup event queue
  // TODO specify worker pool
  // TODO use msgpack + gzip?
  this.eventQueue = async.queue(function (event, done) {
    self.client.emit('record', event);
    self.log(util.format('Recorded %s %s request with a response of %s %s.', event.entries[0].request.method, event.entries[0].request.url, event.entries[0].response.status, event.entries[0].response.statusText));
    done();
  });

  // Pause event queue until connected to Analytics server
  this.eventQueue.pause();

  // Connect to Analytics server
  this.client = io('ws://' + self.options.host + ':' + self.options.port);
  this.client.on('connect', function() {
    self.connected = true;
    self.log(util.format('Connected to API Analytics socket.io server with service token %s.', serviceToken));
    self.eventQueue.resume();
  });
  this.client.on('disconnect', function() {
    self.log('Disconnected from API Analytics socket.io.');
    self.eventQueue.pause();
  });

  // API Recorder Middleware
  // TODO use tamper or tamper-esque method to get raw body
  //      to determine raw content size to get infer compression size
  return function (req, res, next) {
    var reqReceived = new Date();

    onFinished(res, function() {
      var model = har(req, res, reqReceived, serviceToken);
      self.log(util.format('Detected \033[32mfinish\033[39m with %s response on request, %s %s.', res.statusCode, model.entries[0].request.method, model.entries[0].request.url));
      self.eventQueue.push(model);
    });

    if (typeof next === 'function') {
      next();
    }
  };
};

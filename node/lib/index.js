var async   = require('async');
var har     = require('./har');
var io      = require('socket.io-client');

var Agent = module.exports = function Agent (agentKey, options) {
  if (!(this instanceof Agent)) return new Agent(agentKey, options);

  // Initial setup
  var self = this;
  this.connected = false;
  this.agentKey = agentKey;
  this.eventQueue = async.queue(function (req, done) {
    // TODO use msgpack + gzip?
    self.client.emit('record', JSON.stringify(req));
    done();
  }); // TODO specify worker pool
  this.eventQueue.pause();

  this.options = options || {};
  this.options.host = this.options.host || 'localhost';
  this.options.port = this.options.port || 4000;

  if (!this.agentKey) {
    throw new Error('Analytics requires an API-KEY');
  }

  // Connect to Analytics server
  this.client = io('ws://' + self.options.host + ':' + self.options.port);
  this.client.on('connect', function() {
    self.connected = true;
    self.eventQueue.resume();
  });

  // API Recorder Middleware
  return function (req, res, next) {
    var reqReceived = new Date().getTime();

    res.on('finish', function () {
      var model = har(req, res, new Date());

      self.eventQueue.push(model);
    });

    if (next) {
      next();
    }
  };
};

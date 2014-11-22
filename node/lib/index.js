var async   = require('async');
var har     = require('./har');
var zmq      = require('zmq');

module.exports = function Agent (agentKey, options) {
  var self = this;

  // Ensure instance type
  if (!(this instanceof Agent)) {
    return new Agent(agentKey, options);
  }

  // Ensure agent key exists
  if (!agentKey) {
    throw new Error(
      'Mashape Analytics requires an API-KEY, to obtain a key visit: http://apianalytics.com'
    );
  }

  // Setup
  this.options = options || {};
  this.agentKey = agentKey;

  // Setup options
  this.options.host = this.options.host || 'mashgalileo.herokuapp.com';
  this.options.port = this.options.port || 4000;

  // TODO use msgpack + gzip?

  // Connect to Analytics server
  var sock = zmq.socket('push');
  sock.connect('tcp://' + self.options.host + ':' + self.options.port);

  // API Recorder Middleware
  // TODO use tamper or tamper-esque method to get raw body
  //      to determine raw content size to get infer compression size
  return function (req, res, next) {
    var reqReceived = new Date();

    res.on('finish', function () {
      var model = har(req, res, reqReceived);
      model.agentKey = agentKey;
      sock.send(JSON.stringify(model));
    });

    if (typeof next === 'function') {
      next();
    }
  };
};

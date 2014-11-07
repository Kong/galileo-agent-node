// var rawBody = require('raw-body'); // Pro
var async   = require('async');
var net     = require('net');
var package = require('./package.json');

var Agent = module.exports = function Agent (agentKey, options) {
  if (!(this instanceof Agent)) return new Agent(agentKey, options);
  var self = this;
  var agent = [package.name, package.version].join('/');

  this.connected = false;
  this.agentKey = agentKey;
  this.requestQueue = async.queue(function (req, done) {
    // TODO use msgpack + gzip?
    self.client.write(JSON.stringify(req), done);
  });
  this.requestQueue.pause();

  this.options = options || {};
  this.options.host = this.options.host || 'localhost';
  this.options.port = this.options.port || 4000;

  this.client = net.createConnection({host: self.options.host, port: self.options.port}, function () {
    // TODO detect server version

    self.connected = true;
    self.requestQueue.resume();
  });

  // TODO reconnection on disconnect

  if (!this.agentKey) {
    throw new Error('Analytics requires an API-KEY');
  }

  // API Recorder Middleware
  return function (req, res, next) {
    var reqReceived = new Date().getTime();

    res.on('finish', function () {
      // Make this a module to be unit testable

      var resSent = new Date().getTime();
      var model = {
        agentKey: self.agentKey,
        agent: agent,
        request: {
          httpVersion: req.httpVersion,
          method: req.method,
          protocol: req.protocol,
          path: req.path,
          queries: req.query,
          headers: req.headers,
          body: null
        },
        response: {
          status: res.statusCode,
          headers: res._headers // Not a good idea - may change depending on the version of express
        },
        timers: {
          reqReceived: reqReceived,
          reqSent: reqReceived,
          resReceived: resSent,
          resSent: resSent
        }
      };

      self.requestQueue.push(model);
    });

    next();
  };

};

// var rawBody = require('raw-body'); // Pro
var async = require('async');
var net = require('net');
var package = require('./package.json');

var Agent = module.exports = function Agent(apiKey, options) {
  if (!(this instanceof Agent)) return new Agent(apiKey, options);
  var self = this;
  var agent = package.name + '/' + package.version;

  this.connected = false;
  this.apiKey = apiKey;
  this.requestQueue = async.queue(function(req, done) {
    // TODO use msgpack + gzip?
    self.client.write(JSON.stringify(req), done);
  });
  this.requestQueue.pause();

  this.options = options || {};
  this.options.host = this.options.host || 'localhost';
  this.options.port = this.options.port || 4000;

  this.client = net.createConnection({host: self.options.host, port: self.options.port}, function() {
    // TODO detect server version

    self.connected = true;
    self.requestQueue.resume();
  });

  // TODO reconnection on disconnect

  if (!this.apiKey) {
    throw new Error('Analytics requires an API-KEY');
  }

  // API Recorder Middleware
  return function(req, res, next) {
    var reqReceived = new Date().getTime();
    // var body = null; // Pro

    // Pro
    // rawBody(req, function(err, body) {
    //   reqSent = new Date().getTime();
    //   body = body;
    // });
    res.on('finish', function() {
      var resSent = new Date().getTime();
      var request = {
        key: self.apiKey,
        agent: agent,
        request: {
          receivedAt: reqReceived,
          sentAt: reqReceived,  // Same as above
          version: req.httpVersion,
          method: req.method,
          protocol: req.protocol,
          path: req.path,
          queries: req.query,
          headers: req.headers,
          //body: body  // Pro
        },
        response: {
          sentAt: resSent,
          receivedAt: resSent, // Same as above
          status: res.statusCode,
          headers: res._headers // Not a good idea - may change depending on the version of express
        }
      };

      self.requestQueue.push(request);
    });

    next();
  };

};

var url         = require('url');
var util        = require('util');
var async       = require('async');
var io          = require('socket.io-client');
var debug       = require('debug')('apianalytics');

var helpers     = require('./helpers');
var pkg         = require('../package.json');

module.exports = function Agent (serviceToken, options) {
  // Ensure agent key exists
  if (!serviceToken) {
    throw new Error('a service token is required, visit: https://www.apianalytics.com/ to obtain one');
  }

  // Ensure instance type
  if (!(this instanceof Agent)) {
    return new Agent(serviceToken, options);
  }

  // this alias
  var self = this;

  // Setup options with defaults
  self.opts = Object.create({
    host: 'socket.apianalytics.com:80',
    logger: debug,
    sendBody: false,
    reqByteLimit: 1e10,
    entriesPerHar: 1
  });

  // assign new values or keep old ones
  Object.keys(options).map(function (key) {
    key in self.opts && (self.opts[key] = options[key]);
  });

  // Setup event queue
  // TODO specify worker pool
  // TODO use msgpack + gzip?
  this.queue = async.queue(function (entry, done) {
    self.har.entries.push(entry);

    if (self.har.entries.length >= self.opts.entriesPerHar) {
      // TODO benchmark this
      self.socket.send(JSON.parse(JSON.stringify(self.har)));

      // reset entries object
      self.har.entries = [];

      self.opts.logger(util.format.apply(null, [
        'Recorded %s %s request with a response of %s %s',
        entry.request.method,
        entry.request.url,
        entry.response.status,
        entry.response.statusText
      ]));
    }

    done();
  });

  // init HAR object
  this.har = {
    version: '1.2',
    serviceToken: serviceToken,
    creator: {
      name: pkg.name,
      version: pkg.version
    },

    entries: []
  };

  // Pause event queue until connected to Analytics server
  this.queue.pause();

  // Connect to Analytics server
  self.opts.logger(util.format('starting socket connection to %s using token: %s', this.opts.host, serviceToken));

  // TODO set reconnectionAttempts count
  this.socket = io(util.format('ws://%s', this.opts.host));

  this.socket.on('connect', function () {
    self.opts.logger(util.format('Connected to %s using token: %s', self.opts.host, serviceToken));
    self.queue.resume();
  });

  this.socket.on('reconnect', function () {
    self.opts.logger(util.format('Reconnected to %s using token: %s', self.opts.host, serviceToken));
    self.queue.resume();
  });

  this.socket.on('reconnecting', function (number) {
    self.opts.logger(util.format('Reconnect attemp #%d to %s using token: %s', number, self.opts.host, serviceToken));
    self.queue.resume();
  });

  this.socket.on('disconnect', function () {
    self.opts.logger('Disconnected from %s', self.opts.host);
    self.queue.pause();
  });

  this.socket.on('error', function (err) {
    self.opts.logger(util.format('Error connecting to %s using token: %s, details: %s', self.opts.host, serviceToken, err));
    self.queue.pause();
  });

  // API Recorder Middleware
  // TODO use tamper or tamper-esque method to get raw body
  //      to determine raw content size to get infer compression size
  return function (req, res, next) {
    var agentResStartTime = new Date();

    // body container
    var bytes = 0;

    var bodies = {
      req: {
        size: 0,
        base64: null
      },

      res: {
        size: 0,
        base64: null
      }
    };

    // buffer container
    var chunked = {
      req: [],
      res: []
    };

    // store original methods for later use
    var func = {
      end: res.end,
      write: res.write
    };

    // grab the request body
    req.on('data', function (chunk) {
      bytes += chunk.length;

      if (bytes <= self.opts.reqByteLimit) {
        chunked.req.push(chunk);
      }
    });

    // construct the request body
    req.on('end', function () {
      var body = Buffer.concat(chunked.req);

      bodies.req.size = body.length;
      bodies.req.base64 = body.toString('utf8');
    });

    // override node's http.ServerResponse.write method
    res.write = function (chunk, encoding) {
      // call the original http.ServerResponse.write method
      func.write.call(res, chunk, encoding);

      chunked.res.push(chunk);
    };

    // override node's http.ServerResponse.end method
    res.end = function (data, encoding) {
      // call the original http.ServerResponse.end method
      func.end.call(res, data, encoding);

      if (chunked.res.length) {
        data = Buffer.concat(chunked.res);
      }

      // construct body
      bodies.res.size = data ? data.length : 0;
      bodies.res.base64 = data ? data.toString('utf8') : null;

      var reqReceived = new Date();
      var reqHeadersArr = helpers.objectToArray(req.headers);

      var resHeaders = helpers.parseResponseHeaderString(res._header);

      var resContentLength = parseInt(helpers.getHeaderValue(resHeaders.headersArr, 'content-length', 0));
      var resBodySize = resContentLength === 0 && bodies.res.size > 0 ? bodies.res.size : resContentLength;

      var reqContentLength = parseInt(helpers.getHeaderValue(reqHeadersArr, 'content-length', 0));
      var reqBodySize = reqContentLength === 0 && bodies.req.size > 0 ? bodies.req.size : reqContentLength;

      var waitTime = agentResStartTime.getTime() - reqReceived.getTime();
      var protocol = req.connection.encrypted ? 'https' : 'http';

      var entry = {
        serverIPAddress: helpers.getServerAddress(),
        startedDateTime: agentResStartTime.toISOString(),

        request: {
          method: req.method,
          url: util.format('%s://%s%s', protocol, req.headers.host, req.url),
          httpVersion: 'HTTP/' + req.httpVersion,
          queryString: helpers.objectToArray(url.parse(req.url, true).query),
          headers: reqHeadersArr,
          headersSize: helpers.getReqHeaderSize(req),
          bodySize: reqBodySize,
          content: {
            size: reqBodySize,
            mimeType: helpers.getHeaderValue(reqHeadersArr, 'content-type', 'application/octet-stream'),
            text: self.opts.sendBody ? bodies.req.base64 : null
          }
        },

        response: {
          status: res.statusCode,
          statusText: resHeaders.statusText,
          httpVersion: resHeaders.version,
          headers: resHeaders.headersArr,
          headersSize: res._header ? new Buffer(res._header).length : 0,
          bodySize: resBodySize,
          content: {
            // TODO measure before compression, if any
            size: resBodySize,
            mimeType: helpers.getHeaderValue(resHeaders.headersArr, 'content-type', 'application/octet-stream'),
            text: self.opts.sendBody ? bodies.res.base64 : null
          }
        },

        timings: {
          send: 0, // TODO
          wait: waitTime,
          receive: 0  // TODO
        }
      };

      // log some info
      self.opts.logger(util.format.apply(null, [
        'Detected "finish" with %s response on request, %s %s',
        res.statusCode,
        entry.request.method,
        entry.request.url
      ]));

      // send to queue
      self.queue.push(entry);
    };

    if (typeof next === 'function') {
      next();
    }
  };
};

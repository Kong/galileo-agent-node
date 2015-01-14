# The ApiAnalytics.com logging interface

This specification documents the public interface to log data points into apianalytics.com

This document is authoritative: other copies of this information must follow the standard to ensure compatibility.

The server accepts only accepts a slightly customized version of the HAR (HTTP Archive Format) standard. It supports the Socket.io, ZMQ and HTTP protocols.

## Known clients

Official

- [Node.js Agent](https://github.com/Mashape/analytics-agents)

Community

- [Precompiled portable proxy](https://github.com/SGrondin/analytics-harchiver)

## HAR

HAR is a simple JSON-based format.

Here's an example HAR containing all the accepted fields.

```json
{
  "service-token": "<my service token>",
  "version": 1.2,
  "creator": {
    "name": "My HAR client",
    "version": "0.1"
  },
  "entries": [{
    "serverIPAddress": "10.10.10.10",
    "startedDateTime": 1416888146,
    "request": {
      "method": "POST",
      "url": "http://myfirstharclient.com/abc/def",
      "httpVersion": "HTTP/1.1",
      "queryString": [{"name":"q", "value":"thisisatest"}, {"name":"param2", "value":"abc"}],
      "headers": [{"name":"Accept", "value":"text/plain"}, {"name":"Cookie", "value":"ijafhIAGWF3Awf93f"}],
      "headersSize": 44,
      "bodySize": 323
    },
    "response": {
      "status": 200,
      "statusText": "OK",
      "httpVersion": "HTTP/1.1",
      "headers": [{"name": "Content-Length", "value":744}, {"name":"Mime-Type", "value":"image/jpeg"}],
      "content": {
        "size": 500,
        "compression": 151,
        "mimeType": "image/jpeg",
      },
      "bodySize": 651,
      "headersSize": 41,
      "redirectUrl": ""
    },
    "cache": {},
    "timings": {
      "blocked": 2,
      "dns": 18,
      "connect": 0,
      "send": 3,
      "wait": 33,
      "receive": 7,
      "ssl": 0
    }
  }]
}
```

All the main sections are required:
- `creator`, `entries`, `request`, `response`, `content`, `cache`, `timings`

All the fields are optional, with the exception of:

- `service-token`
- `version`
- `creator.name`
- `creator.version`

`cache` must be an empty object (reserved for future use) and `entries` must be an array containing exactly 1 object.

For more information about individual fields, see: http://www.softwareishard.com/blog/har-12-spec/

Remember that this is a customized version of the HAR format. For example, in the [official specification](https://dvcs.w3.org/hg/webperf/raw-file/tip/specs/HAR/Overview.html), a lot more fields are mandatory.

## Communicating with the server

The ApiAnalytics.com platform supports 3 different protocols: Socket.io, ZMQ and HTTP.

Socket.io is the simplest, but isn't available on every platform and language. ZMQ is the fastest, but requires an external library. HTTP is only there for compatibility when the other options aren't available.

### Socket.io

Open a connection to `mashgalileo.herokuapp.com`, port `4000`. Emit JSON data on the channel `record`.

Example:
```javascript
var io = require("socket.io-client");
var socket = io("ws://mashgalileo.herokuapp.com:4000");
socket.emit("record", harObject);
```

### ZMQ

Open a connection to `mashgalileo.herokuapp.com`, port `5000`, in `push` mode. Send a string representation of the HAR object.

Example:
```javascript
var zmq = require("zmq");
var socket = zmq.socket("push");
socket.send(JSON.stringify(harObject));
```

### HTTP

**Not currently supported by the ApiAnalytics.com server.**

Send HTTP `POST` requests to `mashgalileo.herokuapp.com`, port `6000`. The body must be a valid HAR object.



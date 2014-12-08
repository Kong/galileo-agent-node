Mashape Analytics Agent (node.js)
-------------------------------------------

Middleware agent to report requests to a mashape analytics server.

Install
-------

```bash
npm install apianalytics
```

Usage with Express
------------------

```javascript
var analytics = require('apianalytics');
var app = require('express')();

// Middleware to report all calls
app.use(analytics('ANALYTICS-SERVICE-TOKEN'));
```

If you have a specific API endpoint:
```javascript
app.use('/api', analytics('ANALYTICS-SERVICE-TOKEN'));
```

Usage with Restify
------------------

```javascript
var analytics = require('apianalytics');
var server = require('restify').createServer({
  name: 'myapp',
  version: '1.0.0'
});

// Middleware to report all calls
server.use(analytics('ANALYTICS-SERVICE-TOKEN'));
```

Usage with HTTP Server
----------------------

``` javascript
var analytics = require('apianalytics')('ANALYTICS-SERVICE-TOKEN');
var server = require('http').createServer(function (req, res) {
    
    analytics(req, res);

    // Other logic here...
    
});
```


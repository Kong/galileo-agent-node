var express = require('express');
var analytics = require('apianalytics');
 
var app = express();
 
app.use(analytics('SERVICE_TOKEN'));
 
app.get('/api', function (req, res) {
  res.send('Hello World!');
});
 
var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Listening at http://%s:%s', host, port);
});

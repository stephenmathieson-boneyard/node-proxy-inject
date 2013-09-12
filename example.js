
var Proxy = require('./');
var cheerio = require('cheerio');
var chalk = require('chalk');
var ms = require('ms');

var p = new Proxy(8080);


// trigger on *ALL* html pages
p.set('trigger', function (req, res) {
  var type = String(res.headers['content-type'] || '').toLowerCase();

  return type.indexOf('text/html') !== -1;
});

// inject an alert into the head of every document
p.set('inject', function (content) {
  var $ = cheerio.load(content);

  var title = $('title').text();
  $('head').prepend('<script>alert("' + title + '")</script>');
  return $.html();
});

// log requests which we inject stuff into
p.set('logger', function (req, start, end) {
  console.log(chalk.blue(req.method), req.url, chalk.yellow(ms(end - start)));
});

// start the server
p.start(function () {
  console.log('proxy server running on', this.get('port'));
});


var http = require('http');
var parse = require('url').parse;

/**
 * Expose `Proxy`
 */

exports = module.exports = Proxy;
exports.Proxy = Proxy;


/**
 * Parse the given `url`, always adding a port
 *
 * @api private
 * @param {String} url
 * @return {Object}
 */
function parseUrl(url) {
  var parsed = parse(url);
  parsed.port = parsed.port || (parsed.protocol === 'https:' ? 443 : 80);
  return parsed;
}

/**
 * Create a proxy server on the given `port`
 *
 * @api public
 * @param {Number} port
 * @param {Function} trigger
 * @param {Function} inject
 */
function Proxy(port, trigger, inject) {
  this.opts = {};
  if (port) this.set('port', port);
  if (trigger) this.set('trigger', trigger);
  if (inject) this.set('inject', inject);
}

/**
 * Set the given `key` to `value`
 *
 * @api public
 * @param {String} key
 * @param {Mixed|Any} value
 * @return {Proxy} for chaining
 */
Proxy.prototype.set = function (key, value) {
  this.opts[key] = value;
  return this;
};

/**
 * Get `key`
 *
 * @api public
 * @param {String} key
 * @return {Mixed|Any}
 */
Proxy.prototype.get = function (key) {
  return this.opts[key];
};

/**
 * Handle the given `req`
 *
 * Must be bound to a `Proxy` instance:
 *
 *     this.onRequest.bind(this)
 *
 * @api private
 * @param {http.IncomingMessage} req
 * @param {http.OutgoingMessage} res
 */
Proxy.prototype.onRequest = function (req, res) {
  var url = parseUrl(req.url);
  var start = new Date;
  var logger = this.opts.logger;
  var trigger = this.opts.trigger;
  var inject = this.opts.inject;

  // HACK: don't bother with gzip stuff
  delete req.headers['accept-encoding'];

  var opts = {
    hostname: url.hostname,
    method: req.method,
    headers: req.headers,
    path: url.pathname,
    port: url.port
  };

  var proxyReq = http.request(opts, function (proxyRes) {
    if (trigger(req, proxyRes)) {
      // handle triggered requests
      var bufs = [];

      proxyRes.on('data', function (d) {
        bufs.push(d);
      });

      proxyRes.once('end', function () {
        // build one huge buffer
        //   TODO this could be too leaky
        //        be safer here:
        //          - check length
        //          - etc...
        var buf = Buffer.concat(bufs);
        // grab "injected" content
        var content = inject(buf.toString());
        res.write(content);
        res.end();

        if (logger) {
          logger(req, start, new Date);
        }
      });
    } else {
      // just pipe directly into `res`
      proxyRes.pipe(res);
      proxyRes.once('end', function () {
        res.end();
      });
    }

    // write headers
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
  });

  // pipe `req` into the `proxyReq`
  req.pipe(proxyReq);
  req.once('end', function () {
    proxyReq.end();
  });
};

/**
 * Start the proxy server
 *
 * @api public
 * @param {Function} [cb]
 */
Proxy.prototype.start = function (cb) {
  if (this.server) {
    var err = new Error('proxy server already started');
    if (cb) {
      return cb(err);
    }
    throw err;
  }

  cb = cb || function () {};

  this.server = http.createServer(this.onRequest.bind(this));
  this.server.listen(this.get('port'), cb.bind(this));
};

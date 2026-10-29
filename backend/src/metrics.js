const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

function getRoutePattern(req) {
  if (req.route && req.route.path) {
    const basePath = req.baseUrl || '';
    const routePath = typeof req.route.path === 'string' ? req.route.path : req.route.path.toString();
    const full = `${basePath}${routePath}`.replace(/\/+/g, '/');
    return full.length > 1 && full.endsWith('/') ? full.slice(0, -1) : full;
  }
  return 'unmatched';
}

function metricsMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationSeconds = Number(endTime - startTime) / 1e9;
    const durationMs = durationSeconds * 1000;
    const route = getRoutePattern(req);
    const method = req.method;
    const status = String(res.statusCode);

    httpRequestsTotal.inc({ method, route, status });
    httpRequestDurationSeconds.observe({ method, route, status }, durationSeconds);

    console.log(
      JSON.stringify({
        method,
        route,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      })
    );
  });

  next();
}

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  metricsMiddleware,
  getRoutePattern,
};


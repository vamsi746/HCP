"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _cors = require('cors'); var _cors2 = _interopRequireDefault(_cors);
var _helmet = require('helmet'); var _helmet2 = _interopRequireDefault(_helmet);
var _compression = require('compression'); var _compression2 = _interopRequireDefault(_compression);
var _morgan = require('morgan'); var _morgan2 = _interopRequireDefault(_morgan);
var _cookieparser = require('cookie-parser'); var _cookieparser2 = _interopRequireDefault(_cookieparser);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var _nodecron = require('node-cron'); var _nodecron2 = _interopRequireDefault(_nodecron);
var _config = require('./config');
var _database = require('./config/database');
var _logger = require('./config/logger');
var _errorHandler = require('./middleware/errorHandler');
var _rateLimiter = require('./middleware/rateLimiter');
var _escalation = require('./services/escalation');

var _authroutes = require('./routes/auth.routes'); var _authroutes2 = _interopRequireDefault(_authroutes);
var _officersroutes = require('./routes/officers.routes'); var _officersroutes2 = _interopRequireDefault(_officersroutes);
var _dsrroutes = require('./routes/dsr.routes'); var _dsrroutes2 = _interopRequireDefault(_dsrroutes);
var _casesroutes = require('./routes/cases.routes'); var _casesroutes2 = _interopRequireDefault(_casesroutes);
var _violationsroutes = require('./routes/violations.routes'); var _violationsroutes2 = _interopRequireDefault(_violationsroutes);
var _actionsroutes = require('./routes/actions.routes'); var _actionsroutes2 = _interopRequireDefault(_actionsroutes);
var _appealsroutes = require('./routes/appeals.routes'); var _appealsroutes2 = _interopRequireDefault(_appealsroutes);
var _zonesroutes = require('./routes/zones.routes'); var _zonesroutes2 = _interopRequireDefault(_zonesroutes);
var _reportsroutes = require('./routes/reports.routes'); var _reportsroutes2 = _interopRequireDefault(_reportsroutes);
var _mappingroutes = require('./routes/mapping.routes'); var _mappingroutes2 = _interopRequireDefault(_mappingroutes);
var _memosroutes = require('./routes/memos.routes'); var _memosroutes2 = _interopRequireDefault(_memosroutes);

const app = _express2.default.call(void 0, );

// Middleware
app.use(_helmet2.default.call(void 0, ));
const allowedOrigins = _config.config.clientUrl.split(',').map((s) => s.trim());
app.use(_cors2.default.call(void 0, {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('CORS not allowed'));
  },
  credentials: true,
}));
app.use(_cookieparser2.default.call(void 0, ));
app.use(_compression2.default.call(void 0, ));
app.use(_express2.default.json({ limit: '10mb' }));
app.use(_express2.default.urlencoded({ extended: true }));
app.use(_morgan2.default.call(void 0, 'combined', { stream: { write: (msg) => _logger.logger.info(msg.trim()) } }));
app.use('/api', _rateLimiter.apiLimiter);

// Static uploads
app.use('/uploads', _express2.default.static(_path2.default.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', _authroutes2.default);
app.use('/api/officers', _officersroutes2.default);
app.use('/api/dsr', _dsrroutes2.default);
app.use('/api/cases', _casesroutes2.default);
app.use('/api/violations', _violationsroutes2.default);
app.use('/api/actions', _actionsroutes2.default);
app.use('/api/appeals', _appealsroutes2.default);
app.use('/api/zones', _zonesroutes2.default);
app.use('/api/reports', _reportsroutes2.default);
app.use('/api/mapping', _mappingroutes2.default);
app.use('/api/memos', _memosroutes2.default);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(_errorHandler.errorHandler);

// Cron jobs: run escalation checks every hour
_nodecron2.default.schedule('0 * * * *', async () => {
  try {
    await _escalation.checkMissedAction.call(void 0, {});
    await _escalation.checkInactiveSIs.call(void 0, );
    _logger.logger.info('Escalation checks completed');
  } catch (err) {
    _logger.logger.error('Escalation cron error', err);
  }
});

// Start
const PORT = _config.config.port;
_database.connectDB.call(void 0, ).then(() => {
  app.listen(PORT, () => {
    _logger.logger.info(`API server running on port ${PORT}`);
  });
});

exports. default = app;

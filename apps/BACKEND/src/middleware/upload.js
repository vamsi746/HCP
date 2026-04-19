"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _multer = require('multer'); var _multer2 = _interopRequireDefault(_multer);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);

 const upload = _multer2.default.call(void 0, {
  storage: _multer2.default.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.txt', '.json'];
    const ext = _path2.default.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
}); exports.upload = upload;

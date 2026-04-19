"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);

const notificationSchema = new (0, _mongoose.Schema)(
  {
    recipientId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['INFO', 'WARNING', 'URGENT', 'ACTION_REQUIRED'], default: 'INFO' },
    relatedEntity: String,
    relatedEntityId: String,
    isRead: { type: Boolean, default: false },
    readAt: Date,
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, isRead: 1 });

 const Notification = _mongoose2.default.model('Notification', notificationSchema); exports.Notification = Notification;

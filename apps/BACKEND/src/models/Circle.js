"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);

const circleSchema = new (0, _mongoose.Schema)(
  {
    name: { type: String, required: true },
    divisionId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Division', required: true },
    ciId: { type: _mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
circleSchema.index({ divisionId: 1 });
circleSchema.index({ divisionId: 1, isActive: 1 });

 const Circle = _mongoose2.default.model('Circle', circleSchema); exports.Circle = Circle;

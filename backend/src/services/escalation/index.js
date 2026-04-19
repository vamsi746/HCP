"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }




var _models = require('../../models');
var _logger = require('../../config/logger'); var _logger2 = _interopRequireDefault(_logger);
var _documentgen = require('../document-gen');

const SI_RESPONSIBILITY_CRIMES = [
  _models.CrimeType.BETTING, _models.CrimeType.GAMBLING, _models.CrimeType.ONLINE_BETTING,
  _models.CrimeType.PROSTITUTION,
  _models.CrimeType.SOCIAL_MEDIA, _models.CrimeType.CYBER_FRAUD,
  _models.CrimeType.NDPS_PETTY, _models.CrimeType.ROWDY_SHEET,
  _models.CrimeType.ILLICIT_LIQUOR, _models.CrimeType.PROPERTY_OFFENCE,
  _models.CrimeType.EVE_TEASING, _models.CrimeType.THEFT,
];

const TF_HANDLERS = [
  _models.HandlerType.TASK_FORCE, _models.HandlerType.SIT,
  _models.HandlerType.SOT, _models.HandlerType.ANTI_VICE,
];

 async function checkMissedAction(caseRecord) {
  try {
    if (
      !SI_RESPONSIBILITY_CRIMES.includes(caseRecord.crimeType) ||
      !TF_HANDLERS.includes(caseRecord.handledBy)
    ) return;

    const sectors = await _models.Sector.find({ policeStationId: caseRecord.policeStationId, isActive: true });

    for (const sector of sectors) {
      const assignments = await _models.SectorOfficer.find({
        sectorId: sector._id, isActive: true, role: 'PRIMARY_SI',
      }).populate('officerId');

      for (const assignment of assignments) {
        const officer = assignment.officerId ;

        const isOnLeave = await _models.OfficerLeave.findOne({
          officerId: officer._id,
          startDate: { $lte: caseRecord.caseDate },
          endDate: { $gte: caseRecord.caseDate },
          status: 'APPROVED',
        });

        if (isOnLeave) {
          if (isOnLeave.reliefSIId) {
            await _models.Violation.create({
              officerId: isOnLeave.reliefSIId,
              caseId: caseRecord._id,
              violationType: _models.ViolationType.MISSED_ACTION,
              severity: _models.Severity.MEDIUM,
              date: caseRecord.caseDate,
              description: `Relief SI failed to act on ${caseRecord.crimeType} case`,
            });
          }
          continue;
        }

        await _models.Violation.create({
          officerId: officer._id,
          caseId: caseRecord._id,
          violationType: _models.ViolationType.MISSED_ACTION,
          severity: _models.Severity.HIGH,
          date: caseRecord.caseDate,
          description: `SI missed ${caseRecord.crimeType} case handled by ${caseRecord.handledBy}`,
        });

        // Auto-generate warning/suspension for the officer
        await autoGenerateAction(officer._id, caseRecord);

        caseRecord.isMissedBySI = true;
        await caseRecord.save();
      }
    }
  } catch (error) {
    _logger2.default.error('Error in checkMissedAction:', error);
  }
} exports.checkMissedAction = checkMissedAction;

 async function checkInactiveSIs() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeSIs = await _models.SectorOfficer.find({ isActive: true, role: 'PRIMARY_SI' }).populate('officerId');

    for (const assignment of activeSIs) {
      const officer = assignment.officerId ;
      if (!_optionalChain([officer, 'optionalAccess', _ => _.isActive])) continue;

      const recentViolation = await _models.Violation.findOne({
        officerId: officer._id,
        violationType: _models.ViolationType.INACTIVE_SI,
        date: { $gte: sevenDaysAgo },
      });
      if (recentViolation) continue;

      await _models.Violation.create({
        officerId: officer._id,
        violationType: _models.ViolationType.INACTIVE_SI,
        severity: _models.Severity.MEDIUM,
        date: new Date(),
        description: 'SI has been inactive for 7+ days',
      });
    }
  } catch (error) {
    _logger2.default.error('Error in checkInactiveSIs:', error);
  }
} exports.checkInactiveSIs = checkInactiveSIs;

/**
 * Auto-generate WARNING or SUSPENSION action for an officer.
 * If officer has fewer than 3 prior warnings → issue WARNING with CP signature.
 * If officer has 3+ warnings → issue SUSPENSION notice.
 */
 async function autoGenerateAction(officerId, caseRecord) {
  try {
    // Count existing warnings for this officer
    const warningCount = await _models.DisciplinaryAction.countDocuments({
      officerId,
      actionType: { $in: [_models.ActionType.WARNING, _models.ActionType.SHOW_CAUSE] },
    });

    // Find Commissioner for issuing
    const commissioner = await _models.Officer.findOne({ rank: 'COMMISSIONER', isActive: true });
    const issuedBy = _optionalChain([commissioner, 'optionalAccess', _2 => _2._id]) || officerId; // fallback

    const actionType = warningCount >= 2 ? _models.ActionType.SUSPENSION : _models.ActionType.WARNING;
    const actionNumber = warningCount + 1;
    const responseDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const action = await _models.DisciplinaryAction.create({
      officerId,
      actionType,
      actionNumber,
      issuedBy,
      issuedAt: new Date(),
      responseDeadline,
      status: _models.ActionStatus.PENDING,
    });

    // Generate PDF document with CP signature
    const populated = await _models.DisciplinaryAction.findById(action._id)
      .populate('officerId', 'name badgeNumber rank')
      .populate('violationId');

    if (populated) {
      const docUrl = await _documentgen.generateDocument.call(void 0, populated);
      populated.documentUrl = docUrl;
      await populated.save();
    }

    _logger2.default.info(`Auto-generated ${actionType} (#${actionNumber}) for officer ${officerId}`);
  } catch (error) {
    _logger2.default.error('Error in autoGenerateAction:', error);
  }
} exports.autoGenerateAction = autoGenerateAction;

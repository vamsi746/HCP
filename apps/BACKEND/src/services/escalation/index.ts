import {
  Violation, ViolationType, Severity,
  CrimeType, HandlerType,
  DisciplinaryAction, ActionType, ActionStatus,
  SectorOfficer, OfficerLeave, Sector, Officer,
} from '../../models';
import logger from '../../config/logger';
import { generateDocument } from '../document-gen';

const SI_RESPONSIBILITY_CRIMES: string[] = [
  CrimeType.BETTING, CrimeType.GAMBLING, CrimeType.ONLINE_BETTING,
  CrimeType.PROSTITUTION,
  CrimeType.SOCIAL_MEDIA, CrimeType.CYBER_FRAUD,
  CrimeType.NDPS_PETTY, CrimeType.ROWDY_SHEET,
  CrimeType.ILLICIT_LIQUOR, CrimeType.PROPERTY_OFFENCE,
  CrimeType.EVE_TEASING, CrimeType.THEFT,
];

const TF_HANDLERS: string[] = [
  HandlerType.TASK_FORCE, HandlerType.SIT,
  HandlerType.SOT, HandlerType.ANTI_VICE,
];

export async function checkMissedAction(caseRecord: any): Promise<void> {
  try {
    if (
      !SI_RESPONSIBILITY_CRIMES.includes(caseRecord.crimeType) ||
      !TF_HANDLERS.includes(caseRecord.handledBy)
    ) return;

    const sectors = await Sector.find({ policeStationId: caseRecord.policeStationId, isActive: true });

    for (const sector of sectors) {
      const assignments = await SectorOfficer.find({
        sectorId: sector._id, isActive: true, role: 'PRIMARY_SI',
      }).populate('officerId');

      for (const assignment of assignments) {
        const officer = assignment.officerId as any;

        const isOnLeave = await OfficerLeave.findOne({
          officerId: officer._id,
          startDate: { $lte: caseRecord.caseDate },
          endDate: { $gte: caseRecord.caseDate },
          status: 'APPROVED',
        });

        if (isOnLeave) {
          if (isOnLeave.reliefSIId) {
            await Violation.create({
              officerId: isOnLeave.reliefSIId,
              caseId: caseRecord._id,
              violationType: ViolationType.MISSED_ACTION,
              severity: Severity.MEDIUM,
              date: caseRecord.caseDate,
              description: `Relief SI failed to act on ${caseRecord.crimeType} case`,
            });
          }
          continue;
        }

        await Violation.create({
          officerId: officer._id,
          caseId: caseRecord._id,
          violationType: ViolationType.MISSED_ACTION,
          severity: Severity.HIGH,
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
    logger.error('Error in checkMissedAction:', error);
  }
}

export async function checkInactiveSIs(): Promise<void> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeSIs = await SectorOfficer.find({ isActive: true, role: 'PRIMARY_SI' }).populate('officerId');

    for (const assignment of activeSIs) {
      const officer = assignment.officerId as any;
      if (!officer?.isActive) continue;

      const recentViolation = await Violation.findOne({
        officerId: officer._id,
        violationType: ViolationType.INACTIVE_SI,
        date: { $gte: sevenDaysAgo },
      });
      if (recentViolation) continue;

      await Violation.create({
        officerId: officer._id,
        violationType: ViolationType.INACTIVE_SI,
        severity: Severity.MEDIUM,
        date: new Date(),
        description: 'SI has been inactive for 7+ days',
      });
    }
  } catch (error) {
    logger.error('Error in checkInactiveSIs:', error);
  }
}

/**
 * Auto-generate WARNING or SUSPENSION action for an officer.
 * If officer has fewer than 3 prior warnings → issue WARNING with CP signature.
 * If officer has 3+ warnings → issue SUSPENSION notice.
 */
export async function autoGenerateAction(officerId: any, caseRecord: any): Promise<void> {
  try {
    // Count existing warnings for this officer
    const warningCount = await DisciplinaryAction.countDocuments({
      officerId,
      actionType: { $in: [ActionType.WARNING, ActionType.SHOW_CAUSE] },
    });

    // Find Commissioner for issuing
    const commissioner = await Officer.findOne({ rank: 'COMMISSIONER', isActive: true });
    const issuedBy = commissioner?._id || officerId; // fallback

    const actionType = warningCount >= 2 ? ActionType.SUSPENSION : ActionType.WARNING;
    const actionNumber = warningCount + 1;
    const responseDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const action = await DisciplinaryAction.create({
      officerId,
      actionType,
      actionNumber,
      issuedBy,
      issuedAt: new Date(),
      responseDeadline,
      status: ActionStatus.PENDING,
    });

    // Generate PDF document with CP signature
    const populated = await DisciplinaryAction.findById(action._id)
      .populate('officerId', 'name badgeNumber rank')
      .populate('violationId');

    if (populated) {
      const docUrl = await generateDocument(populated);
      populated.documentUrl = docUrl;
      await populated.save();
    }

    logger.info(`Auto-generated ${actionType} (#${actionNumber}) for officer ${officerId}`);
  } catch (error) {
    logger.error('Error in autoGenerateAction:', error);
  }
}

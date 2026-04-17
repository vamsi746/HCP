// Officer ranks
export type OfficerRank = 'CONSTABLE' | 'HEAD_CONSTABLE' | 'ASI' | 'SI' | 'INSPECTOR' | 'DSP' | 'ACP' | 'DCP' | 'ADDL_CP' | 'JT_CP' | 'COMMISSIONER';

export interface Officer {
  _id: string;
  name: string;
  badgeNumber: string;
  rank: OfficerRank;
  phone: string;
  email: string;
  stationId?: string;
  sectorId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Zone {
  _id: string;
  name: string;
  code: string;
}

export interface Division {
  _id: string;
  name: string;
  code: string;
  zoneId: string;
}

export interface Circle {
  _id: string;
  name: string;
  code: string;
  divisionId: string;
}

export interface PoliceStation {
  _id: string;
  name: string;
  code: string;
  circleId: string;
  latitude?: number;
  longitude?: number;
}

export interface Sector {
  _id: string;
  name: string;
  policeStationId: string;
  officers?: SectorOfficerInfo[];
}

export interface SectorOfficerInfo {
  _id: string;
  name: string;
  badgeNumber: string;
  rank: string;
  phone: string;
  isActive: boolean;
  role: string;
  recruitmentType?: 'DIRECT' | 'RANKER';
  batch?: number;
  remarks?: string;
}

export type CrimeType = 'BETTING' | 'GAMBLING' | 'ONLINE_BETTING' | 'PROSTITUTION' | 'MURDER' | 'ROBBERY' | 'THEFT' | 'ASSAULT' | 'BURGLARY' | 'FRAUD' | 'KIDNAPPING' | 'CHAIN_SNATCHING' | 'VEHICLE_THEFT' | 'DRUG_OFFENCE' | 'CYBERCRIME' | 'DOMESTIC_VIOLENCE' | 'SEXUAL_OFFENCE' | 'ARSON' | 'EXTORTION' | 'MISSING_PERSON' | 'HIT_AND_RUN' | 'DRUNK_DRIVING' | 'EVE_TEASING' | 'PROPERTY_DISPUTE' | 'ATTEMPT_MURDER' | 'DACOITY' | 'RIOTS' | 'CHEATING' | 'FORGERY' | 'ILLICIT_LIQUOR' | 'NDPS_PETTY' | 'NDPS_MAJOR' | 'OTHER';

export type HandlerType = 'SECTOR_SI' | 'TASK_FORCE' | 'SIT' | 'SOT' | 'ANTI_VICE' | 'CYBER_CELL' | 'SPECIAL_BRANCH';

export interface Case {
  _id: string;
  firNumber?: string;
  crimeType: CrimeType;
  description?: string;
  policeStationId?: string | { _id: string; name: string; code: string };
  handledBy: HandlerType;
  isMissedBySI: boolean;
  caseDate: string;
  location?: string;
  taskForceUnit?: string;
  createdAt: string;
  updatedAt: string;
}

export type DSRStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'MANUAL_REVIEW';
export type ForceType = 'CHARMINAR_GOLCONDA' | 'RAJENDRANAGAR_SHAMSHABAD' | 'KHAIRATABAD_SECUNDERABAD_JUBILEEHILLS';
export type DSRCategory = 'SPECIAL_WINGS' | 'NORMAL';
export interface ExtractedLocation {
  type: 'ps_reference' | 'residential' | 'incident_area';
  rawText: string;
  psName?: string;
}

export interface ParsedCase {
  _id: string;
  slNo: number;
  zone: string;
  policeStation: string;
  sector: string;
  socialViceType: string;
  actionTakenBy: string;
  natureOfCase: string;
  crNo: string;
  sections: string;
  dor: string;
  psWithCrDetails: string;
  accusedParticulars: string;
  seizedProperty: string;
  seizedWorth: string;
  numAccused: number;
  numCases: number;
  abscondingAccused: number;
  crimeHead: string;
  accusedDetails: string;
  briefFacts: string;
  matchedPSId?: { _id: string; name: string; code: string } | string;
  matchedZoneId?: { _id: string; name: string; code: string } | string;
  matchedSectorId?: { _id: string; name: string } | string;
  matchedOfficerId?: { _id: string; name: string; badgeNumber: string; rank: string; phone: string } | string;
  matchedSHOId?: { _id: string; name: string; badgeNumber: string; rank: string; phone: string } | string;
  extractedLocations: ExtractedLocation[];
  warningGenerated: boolean;
  warningId?: string;
  memoId?: string | null;
  memoStatus?: string | null;
}

export interface DSR {
  _id: string;
  date: string;
  dsrCategory?: DSRCategory;
  forceType: ForceType;
  raidedBy?: string;
  fileName?: string;
  filePath?: string;
  documentHtml?: string;
  processingStatus: DSRStatus;
  parsedCases?: ParsedCase[];
  totalCases: number;
  memoGeneratedCount?: number;
  uploadedBy?: { _id: string; name: string; badgeNumber: string } | string;
  createdAt: string;
}

export type ViolationType = 'MISSED_ACTION' | 'INACTIVE_SI' | 'DEFECTIVE_REGISTRATION' | 'SUPERVISION_FAILURE' | 'INSUBORDINATION';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Violation {
  _id: string;
  officerId: string;
  officer?: Officer;
  caseId?: string;
  violationType: ViolationType;
  severity: Severity;
  description?: string;
  date: string;
  isExempted: boolean;
  exemptedBy?: string;
  exemptionReason?: string;
  createdAt: string;
}

export type ActionType = 'COUNSELING' | 'WARNING' | 'SHOW_CAUSE' | 'ENQUIRY' | 'SUSPENSION' | 'COMMENDATION' | 'TRANSFER_RECOMMENDATION';
export type ActionStatus = 'PENDING' | 'ACKNOWLEDGED' | 'RESPONDED' | 'CLOSED' | 'APPEALED';

export interface DisciplinaryAction {
  _id: string;
  officerId: string;
  officer?: Officer;
  violationId?: string;
  actionType: ActionType;
  actionNumber: number;
  status: ActionStatus;
  documentUrl?: string;
  issuedBy?: string;
  issuedAt: string;
  responseDeadline?: string;
  responseReceived?: string;
  createdAt: string;
}

export type AppealStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ESCALATED';

export interface Appeal {
  _id: string;
  actionId: string;
  action?: DisciplinaryAction;
  officerId: string;
  officer?: Officer;
  reason: string;
  status: AppealStatus;
  slaDeadline: string;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface DashboardData {
  activeOfficers: number;
  totalSIs: number;
  dsrsToday: number;
  activeViolations: number;
  pendingActions: number;
  totalCases: number;
  missedCases: number;
  totalWarnings: number;
  totalSuspensions: number;
  taskForceIncidents: number;
}

// Mapping hierarchy types
export interface MappingSector extends Sector {
  officers: SectorOfficerInfo[];
}
export interface MappingStation extends PoliceStation {
  sectors: MappingSector[];
}
export interface MappingCircle extends Circle {
  stations: MappingStation[];
}
export interface MappingDivision extends Division {
  circles: MappingCircle[];
}
export interface MappingZone extends Zone {
  divisions: MappingDivision[];
}

// Memo types
export type MemoStatus = 'DRAFT' | 'PENDING_REVIEW' | 'REVIEWED' | 'APPROVED' | 'SENT' | 'ON_HOLD' | 'REJECTED';

export interface Memo {
  _id: string;
  dsrId: string;
  caseId: string;
  memoNumber?: string;
  date: string;
  subject: string;
  reference: string;
  content: string;
  status: MemoStatus;
  crimeNo?: string;
  sections?: string;
  policeStation?: string;
  psId?: string | { _id: string; name: string; code: string };
  zone?: string;
  zoneId?: string | { _id: string; name: string; code: string };
  briefFacts?: string;
  recipientType?: 'SI' | 'SHO';
  recipientId?: string | Officer;
  recipientName?: string;
  recipientDesignation?: string;
  recipientPS?: string;
  copyTo?: { designation: string; name: string; unit: string }[];
  generatedBy?: string | { _id: string; name: string; badgeNumber: string; rank: string };
  reviewedBy?: string | { _id: string; name: string; badgeNumber: string; rank: string };
  approvedBy?: string | { _id: string; name: string; badgeNumber: string; rank: string };
  generatedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  // Enriched from DSR parsed case
  raidedDate?: string;
  raidedBy?: string;
  caseDetails?: {
    natureOfCase: string;
    sector: string;
    actionTakenBy: string;
    socialViceType: string;
    sho: { _id: string; name: string; badgeNumber: string; rank: string } | null;
    si: { _id: string; name: string; badgeNumber: string; rank: string } | null;
    accusedParticulars: string;
    briefFacts: string;
    seizedProperty: string;
    seizedWorth: string;
    numAccused: number;
    numCases: number;
    abscondingAccused: number;
    psWithCrDetails: string;
    dor: string;
    warningGenerated: boolean;
  };
  // Compliance tracking
  complianceStatus?: 'AWAITING_REPLY' | 'COMPLIED';
  complianceRemarks?: string;
  complianceDocumentPath?: string;
  complianceDocumentName?: string;
  compliedAt?: string;
  compliedBy?: string | { _id: string; name: string; badgeNumber: string; rank: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

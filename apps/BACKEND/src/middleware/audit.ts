import { AuditLog } from '../models';

export async function createAuditLog(data: {
  officerId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await AuditLog.create(data);
  } catch {
    // Audit log failure should not block operations
  }
}

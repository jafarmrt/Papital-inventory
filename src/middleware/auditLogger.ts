import { orm } from '../db/drizzle.js';
import { auditLogs } from '../db/schema.js';

export async function logAction(userId: number, username: string, action: string, entityType: string, entityId: string | null, changes: any = null) {
  try {
    await orm.insert(auditLogs).values({
      userId,
      username,
      action,
      entityType,
      entityId,
      changes,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

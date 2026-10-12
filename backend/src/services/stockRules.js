import { AppError } from '../utils/AppError.js';

export function assertCanWrite(existing, existingId, clientUpdatedAt) {
  if (!existing) {
    if (existingId) {
      throw new AppError('This stock entry no longer exists. Reload the page.', 409, 'STALE_ENTRY');
    }
    return;
  }
  if (!existingId || String(existing._id) !== String(existingId)) {
    throw new AppError(
      'A stock entry already exists for this item and date. Reload the page to edit it instead of creating a duplicate.',
      409,
      'DUPLICATE_ENTRY'
    );
  }
  if (!clientUpdatedAt) {
    throw new AppError('Reload the page before editing this entry.', 409, 'STALE_ENTRY');
  }
  const serverTime = new Date(existing.updatedAt).getTime();
  const clientTime = new Date(clientUpdatedAt).getTime();
  if (!Number.isFinite(clientTime) || serverTime !== clientTime) {
    throw new AppError('This entry was updated on another device. Reload to see the saved stock.', 409, 'STALE_ENTRY');
  }
}

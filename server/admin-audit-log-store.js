import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getPool, query } from './db.js';

const STORE_PATH = path.resolve(process.cwd(), 'server', 'admin-audit-log-store.json');

const DEFAULT_PAYLOAD = {
  entries: [],
  dedupeKeys: {},
};

let warnedReadOnlyStore = false;

const isReadOnlyStoreError = (error) =>
  Boolean(error) &&
  typeof error === 'object' &&
  'code' in error &&
  (error.code === 'EROFS' || error.code === 'EPERM' || error.code === 'EACCES');

const warnReadOnlyStore = () => {
  if (warnedReadOnlyStore) {
    return;
  }

  warnedReadOnlyStore = true;
  console.warn('[admin-audit-log-store] Local audit store is read-only; falling back to remote/no-op persistence.');
};

const ensurePayloadShape = (payload) => ({
  entries: Array.isArray(payload?.entries) ? payload.entries : [],
  dedupeKeys: payload?.dedupeKeys && typeof payload.dedupeKeys === 'object' ? payload.dedupeKeys : {},
});

const readStore = async () => {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    return ensurePayloadShape(JSON.parse(raw));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { ...DEFAULT_PAYLOAD };
    }

    return { ...DEFAULT_PAYLOAD };
  }
};

const writeStore = async (payload) => {
  const normalized = ensurePayloadShape(payload);

  try {
    await fs.writeFile(STORE_PATH, JSON.stringify(normalized, null, 2), 'utf8');
    return true;
  } catch (error) {
    if (isReadOnlyStoreError(error)) {
      warnReadOnlyStore();
      return false;
    }

    throw error;
  }
};

const normalizeEntry = (entry) => ({
  id: String(entry?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
  at: entry?.at || new Date().toISOString(),
  actorUserId: String(entry?.actorUserId || '').trim(),
  actorName: String(entry?.actorName || '').trim(),
  actorEmail: String(entry?.actorEmail || '').trim(),
  actorRole: String(entry?.actorRole || '').trim(),
  action: String(entry?.action || '').trim(),
  targetType: String(entry?.targetType || '').trim(),
  targetId: String(entry?.targetId || '').trim(),
  targetLabel: String(entry?.targetLabel || '').trim(),
  details: entry?.details && typeof entry.details === 'object' ? entry.details : {},
});

const fromDbRow = (row) =>
  normalizeEntry({
    id: row?.id,
    at: row?.at,
    actorUserId: row?.actor_user_id,
    actorName: row?.actor_name,
    actorEmail: row?.actor_email,
    actorRole: row?.actor_role,
    action: row?.action,
    targetType: row?.target_type,
    targetId: row?.target_id,
    targetLabel: row?.target_label,
    details: row?.details,
  });

const normalizeLogFilters = (filters = {}) => {
  const limit = Number.parseInt(String(filters.limit ?? 500), 10);

  return {
    action: String(filters.action || '').trim().toLowerCase(),
    actorEmail: String(filters.actorEmail || '').trim().toLowerCase(),
    dateFrom: String(filters.dateFrom || '').trim(),
    dateTo: String(filters.dateTo || '').trim(),
    query: String(filters.query || '').trim().toLowerCase(),
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 1000) : 500,
  };
};

const toTimestamp = (value, endOfDay = false) => {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return null;
  }

  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? `${normalized}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : normalized;
  const timestamp = new Date(candidate).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const getSearchableAuditText = (entry) =>
  [
    entry?.actorName,
    entry?.actorEmail,
    entry?.actorRole,
    entry?.action,
    entry?.targetType,
    entry?.targetId,
    entry?.targetLabel,
    ...Object.values(entry?.details || {}).flatMap((value) => (Array.isArray(value) ? value : [value])),
  ]
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
    .join(' ')
    .toLowerCase();

const matchesFilters = (entry, filters) => {
  const normalizedFilters = normalizeLogFilters(filters);
  const entryAction = String(entry?.action || '').trim().toLowerCase();
  const entryEmail = String(entry?.actorEmail || '').trim().toLowerCase();
  const entryTimestamp = toTimestamp(entry?.at);
  const dateFrom = toTimestamp(normalizedFilters.dateFrom, false);
  const dateTo = toTimestamp(normalizedFilters.dateTo, true);

  if (normalizedFilters.action && entryAction !== normalizedFilters.action) {
    return false;
  }

  if (normalizedFilters.actorEmail && !entryEmail.includes(normalizedFilters.actorEmail)) {
    return false;
  }

  if (dateFrom !== null && (entryTimestamp === null || entryTimestamp < dateFrom)) {
    return false;
  }

  if (dateTo !== null && (entryTimestamp === null || entryTimestamp > dateTo)) {
    return false;
  }

  if (normalizedFilters.query && !getSearchableAuditText(entry).includes(normalizedFilters.query)) {
    return false;
  }

  return true;
};

export const appendAuditLog = async (entry, options = {}) => {
  const { dedupeKey = '', dedupeValue = '' } = options;
  const payload = await readStore();
  const normalizedEntry = normalizeEntry(entry);

  if (dedupeKey && dedupeValue && payload.dedupeKeys[dedupeKey] === dedupeValue) {
    return;
  }

  let storedRemotely = false;

  if (getPool()) {
    try {
      await query(
        `INSERT INTO admin_audit_logs
           (id, at, actor_user_id, actor_name, actor_email, actor_role, action, target_type, target_id, target_label, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          normalizedEntry.id,
          normalizedEntry.at,
          normalizedEntry.actorUserId,
          normalizedEntry.actorName,
          normalizedEntry.actorEmail,
          normalizedEntry.actorRole,
          normalizedEntry.action,
          normalizedEntry.targetType,
          normalizedEntry.targetId,
          normalizedEntry.targetLabel,
          normalizedEntry.details,
        ]
      );
      storedRemotely = true;
    } catch {
      storedRemotely = false;
    }
  }

  if (!storedRemotely) {
    payload.entries.unshift(normalizedEntry);
    payload.entries = payload.entries.slice(0, 500);
  }

  if (dedupeKey && dedupeValue) {
    payload.dedupeKeys[dedupeKey] = dedupeValue;
  }

  if (!storedRemotely || (dedupeKey && dedupeValue)) {
    await writeStore(payload);
  }
};

export const listAuditLogs = async (filters = {}) => {
  const normalizedFilters = normalizeLogFilters(filters);

  if (getPool()) {
    try {
      const { rows } = await query('SELECT * FROM admin_audit_logs ORDER BY at DESC LIMIT $1', [
        normalizedFilters.limit,
      ]);
      return rows.map(fromDbRow).filter((entry) => matchesFilters(entry, normalizedFilters));
    } catch {
      // fall through to local store
    }
  }

  const payload = await readStore();
  return payload.entries.filter((entry) => matchesFilters(entry, normalizedFilters)).slice(0, normalizedFilters.limit);
};

export const clearAuditLogs = async () => {
  if (getPool()) {
    await query('DELETE FROM admin_audit_logs WHERE id IS NOT NULL', []);
  }

  await writeStore({
    entries: [],
    dedupeKeys: {},
  });
};

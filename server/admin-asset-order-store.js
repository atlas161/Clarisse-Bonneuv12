import { getPool, query } from './db.js';

const normalizePath = (value) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .trim();

export const listAssetOrdersByFolder = async (folderPath) => {
  if (!getPool()) {
    return new Map();
  }

  const normalizedFolder = normalizePath(folderPath);

  if (!normalizedFolder) {
    return new Map();
  }

  const { rows } = await query(
    'SELECT public_id, sort_order FROM admin_asset_orders WHERE folder_path = $1',
    [normalizedFolder]
  );

  const map = new Map();
  rows.forEach((row) => {
    const publicId = normalizePath(row?.public_id);
    const order = Number(row?.sort_order);
    if (!publicId || !Number.isFinite(order)) {
      return;
    }
    map.set(publicId, order);
  });

  return map;
};

export const listAssetOrderEntriesByFolder = async (folderPath) => {
  if (!getPool()) {
    return [];
  }

  const normalizedFolder = normalizePath(folderPath);

  if (!normalizedFolder) {
    return [];
  }

  const { rows } = await query(
    'SELECT public_id, sort_order FROM admin_asset_orders WHERE folder_path = $1 ORDER BY sort_order ASC, updated_at DESC',
    [normalizedFolder]
  );

  return rows
    .map((row) => ({
      publicId: normalizePath(row?.public_id),
      sortOrder: Number(row?.sort_order),
    }))
    .filter((row) => row.publicId && Number.isFinite(row.sortOrder));
};

export const listAssetOrdersByRoot = async (rootPath) => {
  if (!getPool()) {
    return new Map();
  }

  const normalizedRoot = normalizePath(rootPath);

  if (!normalizedRoot) {
    return new Map();
  }

  const { rows } = await query(
    'SELECT public_id, sort_order FROM admin_asset_orders WHERE folder_path LIKE $1',
    [`${normalizedRoot}/%`]
  );

  const map = new Map();
  rows.forEach((row) => {
    const publicId = normalizePath(row?.public_id);
    const order = Number(row?.sort_order);
    if (!publicId || !Number.isFinite(order)) {
      return;
    }
    map.set(publicId, order);
  });

  return map;
};

export const listAssetAssignmentsByRoot = async (rootPath) => {
  if (!getPool()) {
    return new Map();
  }

  const normalizedRoot = normalizePath(rootPath);

  if (!normalizedRoot) {
    return new Map();
  }

  const { rows } = await query(
    'SELECT folder_path, public_id, sort_order FROM admin_asset_orders WHERE folder_path LIKE $1',
    [`${normalizedRoot}/%`]
  );

  const map = new Map();
  rows.forEach((row) => {
    const publicId = normalizePath(row?.public_id);
    const folderPath = normalizePath(row?.folder_path);
    const order = Number(row?.sort_order);
    if (!publicId || !folderPath || !Number.isFinite(order)) {
      return;
    }
    map.set(publicId, { folderPath, order });
  });

  return map;
};

export const saveAssetOrderForFolder = async (folderPath, orderedItems) => {
  if (!getPool()) {
    throw new Error('Database is not configured for asset order storage.');
  }

  const normalizedFolder = normalizePath(folderPath);
  const normalizedItems = Array.isArray(orderedItems)
    ? orderedItems
        .map((entry, index) => {
          if (typeof entry === 'string') {
            return { publicId: normalizePath(entry), sortOrder: index };
          }

          const publicId = normalizePath(entry?.publicId || entry?.public_id || '');
          const sortOrderRaw = entry?.order ?? entry?.sortOrder ?? entry?.sort_order ?? index;
          const sortOrder = Number.isFinite(Number(sortOrderRaw)) ? Number(sortOrderRaw) : index;
          return { publicId, sortOrder };
        })
        .filter((entry) => entry.publicId)
    : [];

  if (!normalizedFolder) {
    throw new Error('Folder path is required.');
  }

  if (normalizedItems.length === 0) {
    throw new Error('Ordered items list is empty.');
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: existingRows } = await client.query(
      'SELECT public_id FROM admin_asset_orders WHERE folder_path = $1',
      [normalizedFolder]
    );

    for (const entry of normalizedItems) {
      await client.query(
        `INSERT INTO admin_asset_orders (folder_path, public_id, sort_order, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (folder_path, public_id)
         DO UPDATE SET sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at`,
        [normalizedFolder, entry.publicId, entry.sortOrder]
      );
    }

    const nextPublicIdSet = new Set(normalizedItems.map((entry) => entry.publicId));
    const publicIdsToDelete = existingRows
      .map((row) => normalizePath(row?.public_id))
      .filter((publicId) => publicId && !nextPublicIdSet.has(publicId));

    if (publicIdsToDelete.length > 0) {
      await client.query(
        'DELETE FROM admin_asset_orders WHERE folder_path = $1 AND public_id = ANY($2::text[])',
        [normalizedFolder, publicIdsToDelete]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getAssetOrder = async (folderPath, publicId) => {
  if (!getPool()) {
    return null;
  }

  const normalizedFolder = normalizePath(folderPath);
  const normalizedPublicId = normalizePath(publicId);

  if (!normalizedFolder || !normalizedPublicId) {
    return null;
  }

  const { rows } = await query(
    'SELECT sort_order FROM admin_asset_orders WHERE folder_path = $1 AND public_id = $2',
    [normalizedFolder, normalizedPublicId]
  );

  const order = Number(rows[0]?.sort_order);
  return Number.isFinite(order) ? order : null;
};

export const renameAssetOrderFolderPrefix = async (fromFolder, toFolder) => {
  if (!getPool()) {
    return;
  }

  const normalizedFrom = normalizePath(fromFolder);
  const normalizedTo = normalizePath(toFolder);

  if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) {
    return;
  }

  const { rows } = await query(
    'SELECT folder_path, public_id, sort_order FROM admin_asset_orders WHERE folder_path = $1 OR folder_path LIKE $2',
    [normalizedFrom, `${normalizedFrom}/%`]
  );

  if (rows.length === 0) {
    return;
  }

  const nextRows = rows
    .map((row) => {
      const folderPath = normalizePath(row?.folder_path);
      const publicId = normalizePath(row?.public_id);
      const sortOrder = Number(row?.sort_order);

      if (!folderPath || !publicId || !Number.isFinite(sortOrder)) {
        return null;
      }

      const nextFolderPath =
        folderPath === normalizedFrom
          ? normalizedTo
          : folderPath.startsWith(`${normalizedFrom}/`)
            ? `${normalizedTo}${folderPath.slice(normalizedFrom.length)}`
            : folderPath;

      if (!nextFolderPath) {
        return null;
      }

      return { folder_path: nextFolderPath, public_id: publicId, sort_order: sortOrder };
    })
    .filter(Boolean);

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const row of nextRows) {
      await client.query(
        `INSERT INTO admin_asset_orders (folder_path, public_id, sort_order, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (folder_path, public_id)
         DO UPDATE SET sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at`,
        [row.folder_path, row.public_id, row.sort_order]
      );
    }

    await client.query('DELETE FROM admin_asset_orders WHERE folder_path = $1 OR folder_path LIKE $2', [
      normalizedFrom,
      `${normalizedFrom}/%`,
    ]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const deleteAssetOrder = async (folderPath, publicId) => {
  if (!getPool()) {
    return;
  }

  const normalizedFolder = normalizePath(folderPath);
  const normalizedPublicId = normalizePath(publicId);

  if (!normalizedFolder || !normalizedPublicId) {
    return;
  }

  await query('DELETE FROM admin_asset_orders WHERE folder_path = $1 AND public_id = $2', [
    normalizedFolder,
    normalizedPublicId,
  ]);
};

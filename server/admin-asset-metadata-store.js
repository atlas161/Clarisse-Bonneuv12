import { getPool, query } from './db.js';

const normalizePath = (value) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .trim();

const normalizeTags = (tags) =>
  Array.isArray(tags)
    ? tags
        .map((tag) => String(tag || '').trim().toLowerCase())
        .filter(Boolean)
    : [];

export const listAssetMetadataByFolder = async (folderPath) => {
  if (!getPool()) {
    return new Map();
  }

  const normalizedFolder = normalizePath(folderPath);

  if (!normalizedFolder) {
    return new Map();
  }

  const { rows } = await query(
    'SELECT public_id, alt, alt_en, tags FROM admin_asset_metadata WHERE folder_path = $1',
    [normalizedFolder]
  );

  const map = new Map();
  rows.forEach((row) => {
    const publicId = normalizePath(row?.public_id);
    if (!publicId) {
      return;
    }
    map.set(publicId, {
      alt: row?.alt ?? null,
      altEn: row?.alt_en ?? null,
      tags: normalizeTags(row?.tags),
    });
  });

  return map;
};

export const listAssetMetadataByRoot = async (rootPath) => {
  if (!getPool()) {
    return new Map();
  }

  const normalizedRoot = normalizePath(rootPath);

  if (!normalizedRoot) {
    return new Map();
  }

  const { rows } = await query(
    'SELECT public_id, alt, alt_en, tags FROM admin_asset_metadata WHERE folder_path LIKE $1',
    [`${normalizedRoot}/%`]
  );

  const map = new Map();
  rows.forEach((row) => {
    const publicId = normalizePath(row?.public_id);
    if (!publicId) {
      return;
    }
    map.set(publicId, {
      alt: row?.alt ?? null,
      altEn: row?.alt_en ?? null,
      tags: normalizeTags(row?.tags),
    });
  });

  return map;
};

export const getAssetMetadata = async (folderPath, publicId) => {
  if (!getPool()) {
    return null;
  }

  const normalizedFolder = normalizePath(folderPath);
  const normalizedPublicId = normalizePath(publicId);

  if (!normalizedFolder || !normalizedPublicId) {
    return null;
  }

  const { rows } = await query(
    'SELECT alt, alt_en, tags FROM admin_asset_metadata WHERE folder_path = $1 AND public_id = $2',
    [normalizedFolder, normalizedPublicId]
  );

  const data = rows[0];

  if (!data) {
    return null;
  }

  return {
    alt: data.alt ?? null,
    altEn: data.alt_en ?? null,
    tags: normalizeTags(data.tags),
  };
};

export const upsertAssetMetadata = async (folderPath, publicId, updates = {}) => {
  if (!getPool()) {
    throw new Error('Database is not configured for asset metadata storage.');
  }

  const normalizedFolder = normalizePath(folderPath);
  const normalizedPublicId = normalizePath(publicId);

  if (!normalizedFolder || !normalizedPublicId) {
    throw new Error('Asset metadata target is invalid.');
  }

  const alt = String(updates.alt ?? '').trim();
  const altEn = String(updates.altEn ?? '').trim();
  const tags = normalizeTags(updates.tags);

  await query(
    `INSERT INTO admin_asset_metadata (folder_path, public_id, alt, alt_en, tags, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (folder_path, public_id)
     DO UPDATE SET alt = EXCLUDED.alt, alt_en = EXCLUDED.alt_en, tags = EXCLUDED.tags, updated_at = EXCLUDED.updated_at`,
    [normalizedFolder, normalizedPublicId, alt || null, altEn || null, tags]
  );
};

export const upsertAssetMetadataBulk = async (entries) => {
  if (!getPool()) {
    throw new Error('Database is not configured for asset metadata storage.');
  }

  const rows = (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const normalizedFolder = normalizePath(entry?.folderPath || entry?.folder_path || '');
      const normalizedPublicId = normalizePath(entry?.publicId || entry?.public_id || '');
      if (!normalizedFolder || !normalizedPublicId) {
        return null;
      }

      const alt = String(entry?.alt ?? '').trim();
      const altEn = String(entry?.altEn ?? entry?.alt_en ?? '').trim();
      const tags = normalizeTags(entry?.tags);

      return {
        folder_path: normalizedFolder,
        public_id: normalizedPublicId,
        alt: alt ? alt : null,
        alt_en: altEn ? altEn : null,
        tags,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    throw new Error('Bulk asset metadata update is empty.');
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      await client.query(
        `INSERT INTO admin_asset_metadata (folder_path, public_id, alt, alt_en, tags, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (folder_path, public_id)
         DO UPDATE SET alt = EXCLUDED.alt, alt_en = EXCLUDED.alt_en, tags = EXCLUDED.tags, updated_at = EXCLUDED.updated_at`,
        [row.folder_path, row.public_id, row.alt, row.alt_en, row.tags]
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

export const deleteAssetMetadata = async (folderPath, publicId) => {
  if (!getPool()) {
    return;
  }

  const normalizedFolder = normalizePath(folderPath);
  const normalizedPublicId = normalizePath(publicId);

  if (!normalizedFolder || !normalizedPublicId) {
    return;
  }

  await query('DELETE FROM admin_asset_metadata WHERE folder_path = $1 AND public_id = $2', [
    normalizedFolder,
    normalizedPublicId,
  ]);
};

export const renameAssetMetadataFolderPrefix = async (fromFolder, toFolder) => {
  if (!getPool()) {
    return;
  }

  const normalizedFrom = normalizePath(fromFolder);
  const normalizedTo = normalizePath(toFolder);

  if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) {
    return;
  }

  const { rows } = await query(
    'SELECT folder_path, public_id, alt, alt_en, tags FROM admin_asset_metadata WHERE folder_path = $1 OR folder_path LIKE $2',
    [normalizedFrom, `${normalizedFrom}/%`]
  );

  if (rows.length === 0) {
    return;
  }

  const nextRows = rows
    .map((row) => {
      const folderPath = normalizePath(row?.folder_path);
      const publicId = normalizePath(row?.public_id);

      if (!folderPath || !publicId) {
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

      return {
        folder_path: nextFolderPath,
        public_id: publicId,
        alt: row?.alt ?? null,
        alt_en: row?.alt_en ?? null,
        tags: normalizeTags(row?.tags),
      };
    })
    .filter(Boolean);

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const row of nextRows) {
      await client.query(
        `INSERT INTO admin_asset_metadata (folder_path, public_id, alt, alt_en, tags, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (folder_path, public_id)
         DO UPDATE SET alt = EXCLUDED.alt, alt_en = EXCLUDED.alt_en, tags = EXCLUDED.tags, updated_at = EXCLUDED.updated_at`,
        [row.folder_path, row.public_id, row.alt, row.alt_en, row.tags]
      );
    }

    await client.query('DELETE FROM admin_asset_metadata WHERE folder_path = $1 OR folder_path LIKE $2', [
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

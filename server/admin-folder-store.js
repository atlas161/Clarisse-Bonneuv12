import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getPool, query } from './db.js';

const STORE_PATH = path.join(process.cwd(), 'server', 'admin-folder-store.json');
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
  console.warn('[admin-folder-store] Local folder fallback store is read-only; using in-memory/Cloudinary data only.');
};

const normalizePath = (value) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .trim();

const getRootFolder = () => normalizePath(process.env.PORTFOLIO_CLOUDINARY_ROOT || 'samples/clarisse_bonneu');

const parseManualOrder = (value) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const uniqueFolderPaths = (entries) => {
  const unique = new Map();

  (entries || [])
    .map((entry) => normalizePath(entry))
    .filter(Boolean)
    .forEach((entry) => {
      unique.set(entry.toLowerCase(), entry);
    });

  return Array.from(unique.values());
};

const getDefaultFolders = () => {
  const rootFolder = getRootFolder();
  const configuredDefaults = String(process.env.ADMIN_DEFAULT_FOLDERS || 'Pola')
    .split(',')
    .map((entry) => normalizePath(entry))
    .filter(Boolean);

  return configuredDefaults.map((folderName) => {
    if (folderName.startsWith(`${rootFolder}/`) || folderName === rootFolder) {
      return folderName;
    }

    return normalizePath(`${rootFolder}/${folderName}`);
  });
};

const sortFolderRows = (rows) =>
  [...(Array.isArray(rows) ? rows : [])].sort((left, right) => {
    const leftOrder = parseManualOrder(left?.sort_order);
    const rightOrder = parseManualOrder(right?.sort_order);

    if (leftOrder !== null && rightOrder !== null && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    if (leftOrder !== null) {
      return -1;
    }

    if (rightOrder !== null) {
      return 1;
    }

    const leftDate = new Date(left?.created_at || 0).getTime();
    const rightDate = new Date(right?.created_at || 0).getTime();

    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    return String(left?.path || '').localeCompare(String(right?.path || ''), 'fr', {
      sensitivity: 'base',
    });
  });

const readStore = async () => {
  if (getPool()) {
    const { rows } = await query('SELECT path, sort_order, created_at FROM admin_tracked_folders', []);
    const storedPaths = uniqueFolderPaths(sortFolderRows(rows).map((row) => normalizePath(row?.path)));

    return {
      folders: storedPaths.length > 0 ? storedPaths : getDefaultFolders(),
    };
  }

  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const storedPaths = uniqueFolderPaths(Array.isArray(parsed.folders) ? parsed.folders : []);
    return {
      folders: storedPaths.length > 0 ? storedPaths : getDefaultFolders(),
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { folders: getDefaultFolders() };
    }

    if (error instanceof SyntaxError) {
      return { folders: getDefaultFolders() };
    }

    throw error;
  }
};

const writeStore = async (payload) => {
  const nextPayload = {
    folders: uniqueFolderPaths(payload.folders || []),
  };

  if (getPool()) {
    const rows = nextPayload.folders.map((folderPath, index) => ({
      path: folderPath,
      parent_path: getParentPath(folderPath),
      sort_order: index,
    }));

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows: existingRows } = await client.query('SELECT path FROM admin_tracked_folders', []);

      for (const row of rows) {
        await client.query(
          `INSERT INTO admin_tracked_folders (path, parent_path, sort_order)
           VALUES ($1, $2, $3)
           ON CONFLICT (path)
           DO UPDATE SET parent_path = EXCLUDED.parent_path, sort_order = EXCLUDED.sort_order`,
          [row.path, row.parent_path, row.sort_order]
        );
      }

      const nextPathSet = new Set(rows.map((row) => row.path));
      const pathsToDelete = existingRows
        .map((row) => normalizePath(row?.path))
        .filter((folderPath) => folderPath && !nextPathSet.has(folderPath));

      if (pathsToDelete.length > 0) {
        await client.query('DELETE FROM admin_tracked_folders WHERE path = ANY($1::text[])', [pathsToDelete]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return true;
  }

  try {
    await fs.writeFile(STORE_PATH, `${JSON.stringify(nextPayload, null, 2)}\n`, 'utf8');
    return true;
  } catch (error) {
    if (isReadOnlyStoreError(error)) {
      warnReadOnlyStore();
      return false;
    }

    throw error;
  }
};

const getParentPath = (folderPath) => {
  const normalized = normalizePath(folderPath);
  const lastSlashIndex = normalized.lastIndexOf('/');

  if (lastSlashIndex === -1) {
    return '';
  }

  return normalized.slice(0, lastSlashIndex);
};

export const trackFolder = async (folderPath) => {
  const normalizedFolder = normalizePath(folderPath);

  if (!normalizedFolder) {
    return;
  }

  const store = await readStore();
  if (!store.folders.includes(normalizedFolder)) {
    store.folders.push(normalizedFolder);
    await writeStore(store);
  }
};

export const untrackFolder = async (folderPath) => {
  const normalizedFolder = normalizePath(folderPath);
  const store = await readStore();
  store.folders = store.folders.filter(
    (entry) => entry !== normalizedFolder && !entry.startsWith(`${normalizedFolder}/`)
  );
  await writeStore(store);
};

export const renameTrackedFolder = async (fromFolder, toFolder) => {
  const normalizedFrom = normalizePath(fromFolder);
  const normalizedTo = normalizePath(toFolder);

  if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) {
    return;
  }

  const store = await readStore();
  let hasChanges = false;

  store.folders = store.folders.map((entry) => {
    if (entry === normalizedFrom) {
      hasChanges = true;
      return normalizedTo;
    }

    if (entry.startsWith(`${normalizedFrom}/`)) {
      hasChanges = true;
      return `${normalizedTo}${entry.slice(normalizedFrom.length)}`;
    }

    return entry;
  });

  if (hasChanges) {
    await writeStore(store);
  }
};

export const listTrackedSubfolders = async (parentFolder) => {
  const normalizedParent = normalizePath(parentFolder);
  const store = await readStore();

  return store.folders.filter((entry) => getParentPath(entry) === normalizedParent);
};

export const reorderTrackedSubfolders = async (parentFolder, orderedFolderPaths) => {
  const normalizedParent = normalizePath(parentFolder);
  const normalizedOrderedPaths = uniqueFolderPaths(orderedFolderPaths || []).filter(
    (entry) => getParentPath(entry) === normalizedParent
  );

  if (!normalizedParent || normalizedOrderedPaths.length === 0) {
    return;
  }

  const store = await readStore();
  const siblingFolders = store.folders.filter((entry) => getParentPath(entry) === normalizedParent);

  if (siblingFolders.length === 0) {
    return;
  }

  const nextSiblingOrder = [
    ...normalizedOrderedPaths.filter((entry) => siblingFolders.includes(entry)),
    ...siblingFolders.filter((entry) => !normalizedOrderedPaths.includes(entry)),
  ];

  if (getPool()) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const [index, folderPath] of nextSiblingOrder.entries()) {
        await client.query(
          `INSERT INTO admin_tracked_folders (path, parent_path, sort_order)
           VALUES ($1, $2, $3)
           ON CONFLICT (path)
           DO UPDATE SET parent_path = EXCLUDED.parent_path, sort_order = EXCLUDED.sort_order`,
          [folderPath, normalizedParent, index]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return;
  }

  let siblingIndex = 0;
  store.folders = store.folders.map((entry) => {
    if (getParentPath(entry) !== normalizedParent) {
      return entry;
    }

    const nextEntry = nextSiblingOrder[siblingIndex];
    siblingIndex += 1;
    return nextEntry || entry;
  });

  await writeStore(store);
};

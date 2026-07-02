import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const storePath = path.join(process.cwd(), 'server', 'external-media-store.json');
const SUPABASE_EXTERNAL_MEDIA_TABLE = String(process.env.SUPABASE_EXTERNAL_MEDIA_TABLE || 'admin_external_media').trim();
const EXTERNAL_MEDIA_DEBUG_HTTP_ENABLED = String(process.env.ADMIN_DEBUG_HTTP || '').trim().toLowerCase() === 'true';

let supabaseExternalMediaClient = null;
let supabaseExternalMediaClientResolved = false;
let warnedReadOnlyStore = false;

// #region debug-point C:external-store-reporter
const reportExternalMediaDebug = (hypothesisId, location, msg, data = {}) =>
  !EXTERNAL_MEDIA_DEBUG_HTTP_ENABLED
    ? Promise.resolve()
    : fetch('http://127.0.0.1:7777/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: 'youtube-video-502',
          runId: 'pre-fix',
          hypothesisId,
          location,
          msg: `[DEBUG] ${msg}`,
          data,
          ts: Date.now(),
        }),
      }).catch(() => {});
// #endregion

const normalizePath = (value) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .trim();

const sanitizeText = (value) => String(value || '').trim();

const parseManualOrder = (value) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

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
  console.warn('[external-media-store] Local external media store is read-only; configure Supabase persistence for production.');
};

const ensureStoreShape = (payload) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return {
    items: items
      .filter((item) => item && typeof item === 'object' && item.id)
      .map((item) => ({
        id: String(item.id),
        type: 'youtube',
        folder: normalizePath(item.folder),
        url: sanitizeText(item.url),
        youtubeId: sanitizeText(item.youtubeId),
        title: sanitizeText(item.title),
        alt: sanitizeText(item.alt),
        altEn: sanitizeText(item.altEn),
        tags: Array.isArray(item.tags) ? item.tags.map((tag) => sanitizeText(tag)).filter(Boolean) : [],
        order: parseManualOrder(item.order),
        createdAt: sanitizeText(item.createdAt) || new Date().toISOString(),
      })),
  };
};

const sortExternalItems = (items) =>
  [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const leftOrder = parseManualOrder(left?.order);
    const rightOrder = parseManualOrder(right?.order);

    if (leftOrder !== null && rightOrder !== null && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    if (leftOrder !== null) {
      return -1;
    }

    if (rightOrder !== null) {
      return 1;
    }

    const leftDate = new Date(left?.createdAt || 0).getTime();
    const rightDate = new Date(right?.createdAt || 0).getTime();
    return rightDate - leftDate;
  });

const getSupabaseExternalMediaClient = () => {
  if (supabaseExternalMediaClientResolved) {
    return supabaseExternalMediaClient;
  }

  supabaseExternalMediaClientResolved = true;

  const url = String(process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url || !serviceRoleKey) {
    supabaseExternalMediaClient = null;
    return supabaseExternalMediaClient;
  }

  supabaseExternalMediaClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseExternalMediaClient;
};

const toSupabaseRow = (item) => ({
  id: String(item.id),
  type: 'youtube',
  folder: normalizePath(item.folder),
  url: sanitizeText(item.url),
  youtube_id: sanitizeText(item.youtubeId),
  title: sanitizeText(item.title),
  alt: sanitizeText(item.alt),
  alt_en: sanitizeText(item.altEn),
  tags: Array.isArray(item.tags) ? item.tags.map((tag) => sanitizeText(tag)).filter(Boolean) : [],
  sort_order: parseManualOrder(item.order),
  created_at: sanitizeText(item.createdAt) || new Date().toISOString(),
});

const fromSupabaseRow = (row) => ({
  id: String(row?.id || ''),
  type: 'youtube',
  folder: normalizePath(row?.folder),
  url: sanitizeText(row?.url),
  youtubeId: sanitizeText(row?.youtube_id),
  title: sanitizeText(row?.title),
  alt: sanitizeText(row?.alt),
  altEn: sanitizeText(row?.alt_en),
  tags: Array.isArray(row?.tags) ? row.tags.map((tag) => sanitizeText(tag)).filter(Boolean) : [],
  order: parseManualOrder(row?.sort_order),
  createdAt: sanitizeText(row?.created_at) || new Date().toISOString(),
});

const readStore = async () => {
  try {
    const raw = await fs.readFile(storePath, 'utf8');
    return ensureStoreShape(JSON.parse(raw));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { items: [] };
    }

    throw error;
  }
};

const writeStore = async (payload) => {
  const nextPayload = ensureStoreShape(payload);
  // #region debug-point C:write-store-attempt
  void reportExternalMediaDebug('C', 'server/external-media-store.js:writeStore:attempt', 'Attempting external media store write', {
    storePath,
    itemCount: Array.isArray(nextPayload?.items) ? nextPayload.items.length : null,
  });
  // #endregion
  try {
    await fs.writeFile(storePath, `${JSON.stringify(nextPayload, null, 2)}\n`, 'utf8');
  } catch (error) {
    // #region debug-point C:write-store-error
    void reportExternalMediaDebug('C', 'server/external-media-store.js:writeStore:error', 'External media store write failed', {
      storePath,
      itemCount: Array.isArray(nextPayload?.items) ? nextPayload.items.length : null,
      code: error?.code || null,
      message: error instanceof Error ? error.message : String(error || ''),
    });
    // #endregion
    if (isReadOnlyStoreError(error)) {
      warnReadOnlyStore();
    }
    throw error;
  }
  // #region debug-point C:write-store-success
  void reportExternalMediaDebug('C', 'server/external-media-store.js:writeStore:success', 'External media store write succeeded', {
    storePath,
    itemCount: Array.isArray(nextPayload?.items) ? nextPayload.items.length : null,
  });
  // #endregion
  return nextPayload;
};

const readRemoteItems = async (builder) => {
  const { data, error } = await builder;

  if (error) {
    throw new Error(error.message || 'Impossible de lire les videos externes depuis Supabase.');
  }

  return sortExternalItems((data || []).map((row) => fromSupabaseRow(row)));
};

const getYoutubeIdFromUrl = (value) => {
  const raw = sanitizeText(value);

  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase();

    if (hostname === 'youtu.be') {
      return sanitizeText(url.pathname.split('/').filter(Boolean)[0]);
    }

    if (
      hostname === 'youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'music.youtube.com' ||
      hostname === 'youtube-nocookie.com'
    ) {
      if (url.pathname === '/watch') {
        return sanitizeText(url.searchParams.get('v'));
      }

      const pathParts = url.pathname.split('/').filter(Boolean);

      if (pathParts[0] === 'shorts' || pathParts[0] === 'embed' || pathParts[0] === 'live') {
        return sanitizeText(pathParts[1]);
      }
    }
  } catch {
    return null;
  }

  return null;
};

const isValidYoutubeId = (value) => /^[a-zA-Z0-9_-]{11}$/.test(String(value || '').trim());

export const getExternalMediaStorePath = () => storePath;

export const getExternalMediaItems = async () => {
  const supabase = getSupabaseExternalMediaClient();

  if (supabase) {
    return readRemoteItems(supabase.from(SUPABASE_EXTERNAL_MEDIA_TABLE).select('*'));
  }

  const payload = await readStore();
  return sortExternalItems(payload.items);
};

export const listExternalMediaByFolder = async (folder) => {
  const normalizedFolder = normalizePath(folder);
  const supabase = getSupabaseExternalMediaClient();

  if (supabase) {
    return readRemoteItems(supabase.from(SUPABASE_EXTERNAL_MEDIA_TABLE).select('*').eq('folder', normalizedFolder));
  }

  const items = await getExternalMediaItems();
  return items.filter((item) => item.folder === normalizedFolder);
};

export const listExternalMediaByRoot = async (root) => {
  const normalizedRoot = normalizePath(root);
  const supabase = getSupabaseExternalMediaClient();

  if (supabase) {
    return readRemoteItems(
      supabase
        .from(SUPABASE_EXTERNAL_MEDIA_TABLE)
        .select('*')
        .or(`folder.eq.${normalizedRoot},folder.like.${normalizedRoot}/%`)
    );
  }

  const items = await getExternalMediaItems();
  return items.filter((item) => item.folder === normalizedRoot || item.folder.startsWith(`${normalizedRoot}/`));
};

export const createExternalYoutubeItem = async ({ folder, url, title, alt, altEn, tags, order }) => {
  const normalizedFolder = normalizePath(folder);
  const youtubeId = getYoutubeIdFromUrl(url);
  // #region debug-point B:create-external-youtube-item
  void reportExternalMediaDebug('B', 'server/external-media-store.js:createExternalYoutubeItem', 'Preparing external YouTube item', {
    folderInput: folder || null,
    normalizedFolder,
    youtubeId,
    hasTitle: Boolean(sanitizeText(title)),
    hasAlt: Boolean(sanitizeText(alt)),
    hasAltEn: Boolean(sanitizeText(altEn)),
    tagCount: Array.isArray(tags) ? tags.length : 0,
    persistence: getSupabaseExternalMediaClient() ? 'supabase' : 'local-json',
  });
  // #endregion

  if (!normalizedFolder) {
    throw new Error('Le dossier cible est obligatoire.');
  }

  if (!youtubeId || !isValidYoutubeId(youtubeId)) {
    throw new Error('Le lien YouTube est invalide ou non pris en charge.');
  }

  const item = {
    id: randomUUID(),
    type: 'youtube',
    folder: normalizedFolder,
    url: sanitizeText(url),
    youtubeId,
    title: sanitizeText(title),
    alt: sanitizeText(alt),
    altEn: sanitizeText(altEn),
    tags: Array.isArray(tags) ? tags.map((tag) => sanitizeText(tag)).filter(Boolean) : [],
    order: parseManualOrder(order),
    createdAt: new Date().toISOString(),
  };

  const supabase = getSupabaseExternalMediaClient();

  if (supabase) {
    const { data, error } = await supabase
      .from(SUPABASE_EXTERNAL_MEDIA_TABLE)
      .insert(toSupabaseRow(item))
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Impossible d enregistrer la video externe dans Supabase.');
    }

    return fromSupabaseRow(data);
  }

  const payload = await readStore();
  payload.items.push(item);
  await writeStore(payload);
  return item;
};

export const deleteExternalMediaItem = async (id) => {
  const normalizedId = sanitizeText(id);
  const supabase = getSupabaseExternalMediaClient();

  if (supabase) {
    const { data: existingItem, error: lookupError } = await supabase
      .from(SUPABASE_EXTERNAL_MEDIA_TABLE)
      .select('id')
      .eq('id', normalizedId)
      .maybeSingle();

    if (lookupError) {
      throw new Error(lookupError.message || 'Impossible de verifier la video externe dans Supabase.');
    }

    if (!existingItem?.id) {
      throw new Error('Le media externe est introuvable.');
    }

    const { error } = await supabase.from(SUPABASE_EXTERNAL_MEDIA_TABLE).delete().eq('id', normalizedId);

    if (error) {
      throw new Error(error.message || 'Impossible de supprimer la video externe depuis Supabase.');
    }

    return;
  }

  const payload = await readStore();
  const nextItems = payload.items.filter((item) => item.id !== normalizedId);

  if (nextItems.length === payload.items.length) {
    throw new Error('Le media externe est introuvable.');
  }

  await writeStore({ items: nextItems });
};

export const updateExternalMediaItem = async (id, updates = {}) => {
  const normalizedId = sanitizeText(id);
  const supabase = getSupabaseExternalMediaClient();

  if (supabase) {
    const remoteUpdates = {};

    if (Object.prototype.hasOwnProperty.call(updates, 'order')) {
      remoteUpdates.sort_order = parseManualOrder(updates.order);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'alt')) {
      remoteUpdates.alt = sanitizeText(updates.alt);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'altEn')) {
      remoteUpdates.alt_en = sanitizeText(updates.altEn);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
      remoteUpdates.title = sanitizeText(updates.title);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'tags')) {
      remoteUpdates.tags = Array.isArray(updates.tags) ? updates.tags.map((tag) => sanitizeText(tag)).filter(Boolean) : [];
    }

    const { data, error } = await supabase
      .from(SUPABASE_EXTERNAL_MEDIA_TABLE)
      .update(remoteUpdates)
      .eq('id', normalizedId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Impossible de mettre a jour la video externe dans Supabase.');
    }

    return fromSupabaseRow(data);
  }

  const payload = await readStore();
  const item = payload.items.find((entry) => entry.id === normalizedId);

  if (!item) {
    throw new Error('Le media externe est introuvable.');
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'order')) {
    item.order = parseManualOrder(updates.order);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'alt')) {
    item.alt = sanitizeText(updates.alt);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'altEn')) {
    item.altEn = sanitizeText(updates.altEn);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
    item.title = sanitizeText(updates.title);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'tags')) {
    item.tags = Array.isArray(updates.tags) ? updates.tags.map((tag) => sanitizeText(tag)).filter(Boolean) : [];
  }

  await writeStore(payload);
  return item;
};

export const renameExternalMediaFolder = async (fromFolder, toFolder) => {
  const normalizedFrom = normalizePath(fromFolder);
  const normalizedTo = normalizePath(toFolder);

  if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) {
    return;
  }

  const supabase = getSupabaseExternalMediaClient();

  if (supabase) {
    const items = await listExternalMediaByRoot(normalizedFrom);
    const impactedItems = items.filter(
      (item) => item.folder === normalizedFrom || item.folder.startsWith(`${normalizedFrom}/`)
    );

    await Promise.all(
      impactedItems.map((item) =>
        supabase
          .from(SUPABASE_EXTERNAL_MEDIA_TABLE)
          .update({
            folder:
              item.folder === normalizedFrom
                ? normalizedTo
                : `${normalizedTo}${item.folder.slice(normalizedFrom.length)}`,
          })
          .eq('id', item.id)
      )
    );
    return;
  }

  const payload = await readStore();
  let hasChanges = false;

  payload.items.forEach((item) => {
    if (item.folder === normalizedFrom) {
      item.folder = normalizedTo;
      hasChanges = true;
      return;
    }

    if (item.folder.startsWith(`${normalizedFrom}/`)) {
      item.folder = `${normalizedTo}${item.folder.slice(normalizedFrom.length)}`;
      hasChanges = true;
    }
  });

  if (hasChanges) {
    await writeStore(payload);
  }
};

export const reorderExternalMediaItems = async (items) => {
  const normalizedItems = (Array.isArray(items) ? items : []).map((item, index) => ({
    id: sanitizeText(item?.id),
    order: parseManualOrder(item?.order) ?? index,
  }));
  const supabase = getSupabaseExternalMediaClient();

  if (supabase) {
    await Promise.all(
      normalizedItems
        .filter((item) => item.id)
        .map((item) =>
          supabase.from(SUPABASE_EXTERNAL_MEDIA_TABLE).update({ sort_order: item.order }).eq('id', item.id)
        )
    );
    return;
  }

  const payload = await readStore();
  const orderMap = new Map(normalizedItems.map((item) => [item.id, item.order]));

  payload.items.forEach((item) => {
    if (orderMap.has(item.id)) {
      item.order = orderMap.get(item.id);
    }
  });

  await writeStore(payload);
};

export const toExternalVideoAsset = (item) => ({
  assetId: item.id,
  publicId: item.id,
  assetSource: 'external',
  externalType: 'youtube',
  resourceType: 'external-video',
  folder: item.folder,
  format: 'youtube',
  width: 1280,
  height: 720,
  bytes: 0,
  createdAt: item.createdAt,
  tags: item.tags || [],
  context: {
    alt: item.alt,
    alt_en: item.altEn,
    title: item.title,
    url: item.url,
  },
  order: item.order,
  secureUrl: item.url,
  displayTitle: item.title || item.alt || `YouTube ${item.youtubeId}`,
  thumbnailUrl: `https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`,
  embedUrl: `https://www.youtube-nocookie.com/embed/${item.youtubeId}?rel=0`,
});

export const toExternalPortfolioItem = (item, root, locale, toCategoryLabel, defaultAltPrefix) => {
  const relativePath = item.folder.startsWith(`${root}/`) ? item.folder.slice(root.length + 1) : item.folder;
  const [folder] = relativePath.split('/');
  const category = folder || 'autres';
  const alt = locale === 'en' ? item.altEn || item.alt : item.alt || item.altEn;
  const categoryLabel = toCategoryLabel(category);

  return {
    id: item.id,
    category,
    categoryLabel,
    mediaType: 'video',
    order: item.order,
    alt: alt || `${defaultAltPrefix}${categoryLabel}`,
    width: 1280,
    height: 720,
    src: `https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`,
    srcset: '',
    posterSrc: `https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`,
    posterSrcset: '',
    lightboxKind: 'youtube',
    lightboxSrc: item.url,
    embedSrc: `https://www.youtube-nocookie.com/embed/${item.youtubeId}?rel=0&autoplay=1`,
    fullSrc: item.url,
  };
};

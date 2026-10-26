export const BACKEND_URL = window.location.origin.includes("localhost") ? "http://localhost:5000" : "https://everest-academy-production.up.railway.app";

export function getAdminSession() {
  try {
    const raw = localStorage.getItem("admin_session") || localStorage.getItem("admin") || localStorage.getItem("adminUser") || "{}";
    const o = JSON.parse(raw);
    return { userId: o.userId || o.id || o.admin_id || o._id || "", token: o.token || o.session_token || o.sessionToken || "" };
  } catch { return {}; }
}

export function getAdminHeaders() {
  const s = getAdminSession();
  return { "Content-Type": "application/json", "x-user-id": s.userId || "", "x-session-token": s.token || "" };
}

let pendingMutations = 0;
const pendingListeners = new Set();

function emitPending() {
  pendingListeners.forEach((fn) => { try { fn(pendingMutations); } catch { /* ignore */ } });
}

function beginMutation() { pendingMutations++; emitPending(); }
function endMutation() { pendingMutations = Math.max(0, pendingMutations - 1); emitPending(); }

export function getPendingCount() { return pendingMutations; }

export function subscribePending(fn) {
  pendingListeners.add(fn);
  return () => pendingListeners.delete(fn);
}

// ─── Loading feedback for every button ───
// ActionGuard calls markUserAction() on each click. Any request that starts
// shortly after that click counts as "the action the admin just triggered", so
// the global loading overlay can stay visible until that request finishes.
// Background refetches (cache revalidation, keep-alive pages) do NOT count.
const ACTION_WINDOW_MS = 1500;
let lastActionAt = 0;
let activeActionRequests = 0;
const actionListeners = new Set();

export function markUserAction() { lastActionAt = Date.now(); }

export function getActionRequestCount() { return activeActionRequests; }

export function subscribeAction(fn) {
  actionListeners.add(fn);
  return () => actionListeners.delete(fn);
}

function emitAction() {
  actionListeners.forEach((fn) => { try { fn(activeActionRequests); } catch { /* ignore */ } });
}

function beginActionRequest() {
  if (Date.now() - lastActionAt > ACTION_WINDOW_MS) return false;
  activeActionRequests++;
  emitAction();
  return true;
}

function endActionRequest(tracked) {
  if (!tracked) return;
  activeActionRequests = Math.max(0, activeActionRequests - 1);
  emitAction();
}

// ─── GET cache ───
// Every page used to refetch all of its data from Railway on each visit, which
// made moving between admin pages feel slow. GET responses are now memoised:
//  • FRESH_MS  → served straight from memory, no network at all.
//  • STALE_MS  → served instantly while a silent refresh runs in the background,
//                so the next visit already has up-to-date data.
// Any mutation (POST/PUT/DELETE) wipes the cache so admins always see their own
// changes immediately.
const GET_CACHE = new Map();
const INFLIGHT = new Map();
const FRESH_MS = 20 * 1000;
const STALE_MS = 5 * 60 * 1000;

function cacheKey(url) {
  const s = getAdminSession();
  return `${s.userId || "anon"}|${url}`;
}

function cloneData(data) {
  if (data === null || typeof data !== "object") return data;
  try { return structuredClone(data); } catch { try { return JSON.parse(JSON.stringify(data)); } catch { return data; } }
}

export function clearApiCache() { GET_CACHE.clear(); }

async function rawApi(url, opts, method) {
  const headers = { ...getAdminHeaders(), ...(opts.headers || {}) };
  const tracked = beginActionRequest();
  try {
    const r = await fetch(url, { headers, ...opts });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    if (data && data.session_expired) {
      localStorage.removeItem("admin_session");
      window.location.reload();
      throw new Error("Session expired");
    }
    if (!r.ok) {
      const msg = (data && data.error) ? data.error : `Request failed (${r.status})`;
      const err = new Error(msg);
      // Keep the parsed body so callers can use extra fields (e.g. candidates).
      if (data) err.data = data;
      err.status = r.status;
      throw err;
    }
    return data;
  } finally {
    endActionRequest(tracked);
  }
}

export async function api(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BACKEND_URL}${path}`;
  const method = String(opts.method || "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD";
  const useCache = method === "GET" && opts.cache !== false;
  if (isMutation) beginMutation();
  try {
    if (!useCache) return await rawApi(url, opts, method);

    const key = cacheKey(url);
    const hit = GET_CACHE.get(key);
    const age = hit ? Date.now() - hit.ts : Infinity;

    if (hit && age < FRESH_MS) return cloneData(hit.data);

    if (hit && age < STALE_MS) {
      if (!INFLIGHT.has(key)) {
        const p = rawApi(url, opts, method)
          .then((d) => { GET_CACHE.set(key, { data: d, ts: Date.now() }); return d; })
          .catch(() => hit.data)
          .finally(() => INFLIGHT.delete(key));
        INFLIGHT.set(key, p);
      }
      return cloneData(hit.data);
    }

    if (INFLIGHT.has(key)) return cloneData(await INFLIGHT.get(key));

    const p = rawApi(url, opts, method)
      .then((d) => { GET_CACHE.set(key, { data: d, ts: Date.now() }); return d; })
      .finally(() => INFLIGHT.delete(key));
    INFLIGHT.set(key, p);
    return cloneData(await p);
  } finally {
    if (isMutation) {
      endMutation();
      clearApiCache();
    }
  }
}

export async function uploadApi(formData) {
  const uploadUrl = window.location.origin.includes("localhost")
    ? `${BACKEND_URL}/api/upload`
    : '/upload.php';
  const s = getAdminSession();
  const headers = {};
  if (s.userId) headers["x-user-id"] = s.userId;
  if (s.token) headers["x-session-token"] = s.token;
  beginMutation();
  const tracked = beginActionRequest();
  let r;
  try {
    r = await fetch(uploadUrl, { method: "POST", headers, body: formData });
  } finally {
    endMutation();
    endActionRequest(tracked);
  }
  if (!r.ok) throw new Error("Upload failed");
  return r.json();
}

const BUNNY_LIBRARY_ID = "706401";
const BUNNY_API_KEY = "6e7edf56-4918-4a5b-9f8060488a19-7765-415b";
const BUNNY_CDN_HOST = "vz-c77ef25f-4d4.b-cdn.net";

// ─── Resume-aware session storage (survives reloads/network drops) ───
function bunnyFileKey(file) {
  return `everest-bunny-session-${file.name}-${file.size}-${file.lastModified || 0}`;
}

function getBunnySession(file) {
  try {
    const raw = localStorage.getItem(bunnyFileKey(file));
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.videoId ? s : null;
  } catch { return null; }
}

function setBunnySession(file, videoId) {
  try { localStorage.setItem(bunnyFileKey(file), JSON.stringify({ videoId, updatedAt: Date.now() })); } catch {}
}

function clearBunnySession(file) {
  try { localStorage.removeItem(bunnyFileKey(file)); } catch {}
}

async function createBunnyVideo(title) {
  const h = getAdminHeaders();
  const createRes = await fetch(`${BACKEND_URL}/api/bunny/create`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!createRes.ok) throw new Error("Failed to create video entry");
  const { videoId } = await createRes.json();
  return videoId;
}

async function getBunnyTusCredentials(videoId) {
  const h = getAdminHeaders();
  const credRes = await fetch(`${BACKEND_URL}/api/bunny/tus-credentials/${videoId}`, { headers: h });
  if (!credRes.ok) throw new Error("Failed to get upload credentials");
  return credRes.json();
}

function runBunnyTusUpload(file, videoId, cred, onProgress, onStatus) {
  return new Promise((resolve, reject) => {
    import("tus-js-client").then(({ Upload }) => {
      const upload = new Upload(file, {
        endpoint: cred.uploadEndpoint,
        retryDelays: [0, 1000, 2000, 5000, 10000, 30000, 60000, 120000, 300000, 600000],
        chunkSize: 25 * 1024 * 1024,
        removeFingerprintOnSuccess: true,
        fingerprint: (f) => Promise.resolve(`everest-bunny-${videoId}-${f.name}-${f.size}`),
        headers: {
          AuthorizationSignature: cred.signature,
          AuthorizationExpire: cred.expirationTime,
          VideoId: videoId,
          LibraryId: cred.libraryId,
        },
        metadata: { filetype: file.type, title: file.name },
        onProgress: (bytesUploaded, bytesTotal) => {
          if (bytesTotal && onProgress) onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
        },
        onError: reject,
        onSuccess: () => resolve(`https://${BUNNY_CDN_HOST}/${videoId}/playlist.m3u8`),
      });
      upload.findPreviousUploads().then((prev) => {
        if (prev.length) {
          upload.resumeFromPreviousUpload(prev[0]);
          if (onStatus) onStatus("resuming");
        }
        upload.start();
      }).catch(() => upload.start());
    }).catch(reject);
  });
}

// Direct browser-to-Bunny TUS upload with real resumability.
// Reuses the same Video ID for the same file so a failed/interrupted
// upload resumes from where it stopped instead of restarting.
export async function uploadVideoToBunny(file, onProgress, onStatus) {
  const session = getBunnySession(file);
  let videoId = session ? session.videoId : null;

  const attempt = async (createFresh) => {
    if (createFresh) {
      if (onStatus) onStatus("creating");
      videoId = await createBunnyVideo(file.name);
      setBunnySession(file, videoId);
    }
    const cred = await getBunnyTusCredentials(videoId);
    const url = await runBunnyTusUpload(file, videoId, cred, onProgress, onStatus);
    clearBunnySession(file);
    return url;
  };

  try {
    return await attempt(!session);
  } catch (err) {
    // Resume target is gone on Bunny's side (deleted/expired session) → start fresh once
    const st = (err && err.originalResponse && err.originalResponse.getStatus)
      ? err.originalResponse.getStatus()
      : (err && err.originalResponse && err.originalResponse.status) || (err && err.status);
    if (session && (st === 404 || st === 410)) {
      clearBunnySession(file);
      return await attempt(true);
    }
    throw err;
  }
}

export function getBunnyMp4Url(m3u8Url) {
  if (!m3u8Url || !m3u8Url.includes("b-cdn.net")) return m3u8Url;
  return m3u8Url.replace("/playlist.m3u8", "/360p.mp4");
}

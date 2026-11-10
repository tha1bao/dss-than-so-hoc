// Gọi REST API. Token JWT giữ trong sessionStorage (đóng tab là đăng xuất); không lưu dữ liệu HS ở trình duyệt.
const KEY = 'dss.session';

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY)) ?? null; } catch { return null; }
}
export function setSession(s) {
  try { if (s) sessionStorage.setItem(KEY, JSON.stringify(s)); else sessionStorage.removeItem(KEY); } catch { /* chế độ riêng tư */ }
}

export class ApiError extends Error {
  constructor(status, message, requestId, fields) { super(message); this.status = status; this.requestId = requestId; this.fields = fields ?? null; }
}

export async function api(path, { method = 'GET', body } = {}) {
  const s = getSession();
  const res = await fetch(`/api${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(s?.token ? { Authorization: `Bearer ${s.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* không phải JSON */ }
  if (!res.ok) {
    if (res.status === 401 && s) { setSession(null); window.dispatchEvent(new Event('dss:logout')); }
    throw new ApiError(res.status, data?.error ?? `Lỗi ${res.status}`, data?.requestId, data?.fields);
  }
  return data;
}

let kbPromise = null;
/** Tri thức cho engine phía client (công khai, cache theo phiên). */
export const getKnowledge = (force = false) => {
  if (force || !kbPromise) kbPromise = api('/knowledge').catch((e) => { kbPromise = null; throw e; });
  return kbPromise;
};

const layerCache = {};
export const getLayer = (name) => (layerCache[name] ??= api(`/layers/${name}`).catch((e) => { delete layerCache[name]; throw e; }));
export const clearLayers = () => { for (const k of Object.keys(layerCache)) delete layerCache[k]; };

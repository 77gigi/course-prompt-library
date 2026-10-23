const MAGIC = new Uint8Array([67, 80, 76, 49]); // CPL1
const KEY_NAME = 'coursePromptImageKey';
const urlCache = new Map();

function base64UrlToBytes(value) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value || '')) throw new Error('案例图专属链接无效');
  const text = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(text + '=');
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export function imageKey() {
  const fromLink = new URLSearchParams(location.hash.replace(/^#/, '')).get('imgkey');
  if (fromLink) {
    try { base64UrlToBytes(fromLink); localStorage.setItem(KEY_NAME, fromLink); return fromLink; }
    catch { return ''; }
  }
  const saved = localStorage.getItem(KEY_NAME) || '';
  try { base64UrlToBytes(saved); return saved; } catch { return ''; }
}

async function cryptoKey(raw) {
  return crypto.subtle.importKey('raw', base64UrlToBytes(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function protectedImageUrl(path) {
  if (!path) return '';
  if (!path.endsWith('.enc')) throw new Error('图片未加密，不能在学生页面显示');
  const key = imageKey();
  if (!key) throw new Error('需要专属链接查看案例图');
  const cacheKey = `${key}:${path}`;
  if (!urlCache.has(cacheKey)) urlCache.set(cacheKey, (async () => {
    const response = await fetch(new URL(path, document.baseURI));
    if (!response.ok) throw new Error('案例图读取失败');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 33 || !MAGIC.every((value, index) => bytes[index] === value)) throw new Error('案例图格式不正确');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(4, 16) }, await cryptoKey(key), bytes.slice(16));
    const type = /\.png\.enc$/i.test(path) ? 'image/png' : /\.webp\.enc$/i.test(path) ? 'image/webp' : 'image/jpeg';
    return URL.createObjectURL(new Blob([plain], { type }));
  })().catch(error => { urlCache.delete(cacheKey); throw error; }));
  return urlCache.get(cacheKey);
}

export async function encryptImage(file) {
  const key = imageKey();
  if (!key) throw new Error('请用专属管理链接打开后再上传案例图');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cryptoKey(key), await file.arrayBuffer()));
  const output = new Uint8Array(16 + encrypted.length);
  output.set(MAGIC, 0);
  output.set(iv, 4);
  output.set(encrypted, 16);
  return new Blob([output], { type: 'application/octet-stream' });
}

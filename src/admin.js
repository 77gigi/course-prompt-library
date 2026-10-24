import { createApi } from './api.js';
import { makeSeedRows } from './catalog.js';
import { lockToken, unlockToken } from './teacher-vault.js';
import { encryptImage, imageKey, protectedImageUrl } from './protected-images.js';

const $ = selector => document.querySelector(selector);
const api = createApi(window.PROMPT_LIBRARY_CONFIG || {});
const form = $('#entry-form');
let entries = [];
let series = [];
let currentSlug = '';
let currentId = '';
let imageObjectUrl = '';
let previewRequest = 0;
const VAULT_KEY = 'promptTeacherVaultV1';

function showLogin() {
  const hasVault = Boolean(localStorage.getItem(VAULT_KEY));
  $('#login-panel').hidden = false;
  $('#setup-fields').hidden = hasVault;
  $('#login-token').required = !hasVault;
  $('#password-confirm').required = !hasVault;
  $('#login-password').autocomplete = hasVault ? 'current-password' : 'new-password';
  $('#login-heading').textContent = hasVault ? '输入密码进入教师管理' : '首次连接这台电脑';
  $('#login-description').textContent = hasVault ? '输入你在这台电脑上设置的密码。' : '填入 GitHub 授权密钥，并设置本机解锁密码。以后只需输入密码。';
  $('#login-submit').textContent = hasVault ? '解锁教师管理' : '连接并保存';
  $('#reset-vault').hidden = !hasVault;
}

function message(text, error = false) {
  const box = $('#admin-message');
  box.textContent = text;
  box.classList.toggle('error', error);
}

function saveSession(session) {
  sessionStorage.setItem('promptAdminSession', JSON.stringify({ accessToken: session }));
}

function readSession() {
  try { return JSON.parse(sessionStorage.getItem('promptAdminSession') || 'null'); } catch { return null; }
}

async function teacherToken() {
  const session = readSession();
  if (!session?.accessToken) throw new Error('请先登录教师账号');
  return session.accessToken;
}

function field(name) { return form.elements.namedItem(name); }

function renderList() {
  const query = $('#admin-search').value.trim().toLocaleLowerCase();
  const list = $('#admin-list'); list.replaceChildren();
  const filtered = entries.filter(entry => `${entry.title} ${entry.course} ${entry.category}`.toLocaleLowerCase().includes(query));
  for (const entry of filtered) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = entry.slug === currentSlug ? 'active' : '';
    const title = document.createElement('strong'); title.textContent = entry.title;
    const detail = document.createElement('small'); detail.textContent = `${entry.course} · ${entry.category}`;
    const status = document.createElement('span'); status.className = `status ${entry.status}`;
    status.textContent = ({ published: '已发布', draft: '草稿', archived: '已归档' })[entry.status] || entry.status;
    button.append(title, detail, status);
    button.addEventListener('click', () => selectEntry(entry));
    list.append(button);
  }
  $('#total-label').textContent = `${entries.length} 条提示词`;
}

function updateImagePreview(src) {
  const image = $('#editor-preview');
  const request = ++previewRequest;
  image.hidden = true;
  image.removeAttribute('src');
  if (!src) return;
  if (src.startsWith('blob:')) { image.src = src; image.hidden = false; return; }
  protectedImageUrl(src).then(url => {
    if (request === previewRequest) { image.src = url; image.hidden = false; }
  }).catch(() => { if (request === previewRequest) image.hidden = true; });
}

function selectEntry(entry) {
  currentSlug = entry.slug;
  currentId = entry.id;
  for (const name of ['course','category','title','operation','body','seriesId','status','sourceLabel','sourceCredit','imagePath']) {
    field(name).value = entry[name] || '';
  }
  $('#image-file').value = '';
  updateImagePreview(entry.imagePath);
  $('#form-heading').textContent = '编辑提示词';
  $('#edit-status').textContent = entry.status === 'published' ? '已发布' : entry.status === 'archived' ? '已归档' : '草稿';
  $('#archive-button').hidden = entry.status === 'archived';
  renderList();
  if (innerWidth < 850) form.scrollIntoView({ behavior: 'smooth' });
}

function newEntry() {
  currentSlug = '';
  currentId = '';
  form.reset();
  field('status').value = 'draft';
  $('#image-file').value = '';
  updateImagePreview('');
  $('#form-heading').textContent = '新增提示词';
  $('#edit-status').textContent = '草稿';
  $('#archive-button').hidden = true;
  renderList();
  if (innerWidth < 850) form.scrollIntoView({ behavior: 'smooth' });
}

async function loadAll() {
  const token = await teacherToken();
  const result = await api.listAll(token);
  entries = result.entries;
  series = result.series;
  $('#series-common').value = series.find(item => item.id === 'ip-boards')?.commonPrompt || '';
  renderList();
}

async function openWorkspace() {
  const session = readSession();
  if (!session?.accessToken) { showLogin(); return; }
  const token = await teacherToken();
  await api.verifyTeacher(token);
  $('#login-panel').hidden = true;
  $('#workspace-panel').hidden = false;
  $('#logout-button').hidden = false;
  await loadAll();
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  message('正在登录…');
  try {
    const stored = localStorage.getItem(VAULT_KEY);
    const password = $('#login-password').value;
    if (!stored && password !== $('#password-confirm').value) throw new Error('两次输入的密码不一致');
    const token = stored ? await unlockToken(JSON.parse(stored), password) : $('#login-token').value.trim();
    await api.verifyTeacher(token);
    if (!stored) localStorage.setItem(VAULT_KEY, JSON.stringify(await lockToken(token, password)));
    saveSession(token);
    $('#login-form').reset();
    await openWorkspace();
    message(imageKey() ? '已登录教师管理页面' : '已登录；当前链接没有案例图密钥，上传图片请用教师专属链接。', !imageKey());
  } catch (error) { message(error.message, true); }
});

$('#logout-button').addEventListener('click', () => {
  sessionStorage.removeItem('promptAdminSession');
  $('#workspace-panel').hidden = true;
  $('#logout-button').hidden = true;
  $('#login-form').reset();
  showLogin();
  message('已退出教师管理');
});

$('#reset-vault').addEventListener('click', () => {
  if (!confirm('清除本机保存的授权？之后需要重新填写 GitHub 授权密钥并设置密码。不会删除课程内容。')) return;
  localStorage.removeItem(VAULT_KEY);
  sessionStorage.removeItem('promptAdminSession');
  $('#login-form').reset();
  showLogin();
  message('已清除本机授权，请重新连接。');
});

$('#admin-search').addEventListener('input', renderList);
$('#new-button').addEventListener('click', newEntry);
$('#image-file').addEventListener('change', () => {
  if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
  const file = $('#image-file').files[0];
  imageObjectUrl = file ? URL.createObjectURL(file) : '';
  updateImagePreview(imageObjectUrl || field('imagePath').value);
});
field('imagePath').addEventListener('change', () => { if (!$('#image-file').files[0]) updateImagePreview(field('imagePath').value); });

form.addEventListener('submit', async event => {
  event.preventDefault();
  const entry = Object.fromEntries(new FormData(form).entries());
  entry.slug = currentSlug || `teacher-${crypto.randomUUID()}`;
  entry.id = currentId || undefined;
  entry.createdAt = entries.find(item => item.slug === currentSlug)?.createdAt;
  entry.course = entry.course.trim(); entry.category = entry.category.trim(); entry.title = entry.title.trim(); entry.body = entry.body.trim();
  if (!entry.course || !entry.category || !entry.title || !entry.body) { message('请填写课程、类型、标题和提示词正文', true); return; }
  message('正在保存…');
  try {
    const token = await teacherToken();
    const file = $('#image-file').files[0];
    if (file) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('案例图请使用 PNG、JPEG 或 WebP');
      if (file.size > 8 * 1024 * 1024) throw new Error('案例图请小于 8 MB');
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
      entry.imagePath = await api.uploadImage(token, await encryptImage(file), `teacher/${crypto.randomUUID()}.${extension}.enc`);
    }
    if (entry.imagePath && !entry.imagePath.endsWith('.enc')) throw new Error('案例图只能使用加密图片路径；请直接上传图片');
    const saved = await api.upsertEntry(token, entry);
    await loadAll();
    selectEntry(entries.find(item => item.slug === saved.slug) || saved);
    message('已保存。已发布的内容刷新学生页面后可见。');
  } catch (error) { message(error.message, true); }
});

$('#archive-button').addEventListener('click', async () => {
  if (!currentSlug || !confirm('归档后学生看不到这条提示词，之后仍可重新发布。确定归档？')) return;
  try {
    await api.archiveEntry(await teacherToken(), currentSlug);
    await loadAll();
    selectEntry(entries.find(item => item.slug === currentSlug));
    message('已归档。');
  } catch (error) { message(error.message, true); }
});

$('#save-series').addEventListener('click', async () => {
  try {
    await api.upsertSeries(await teacherToken(), { id: 'ip-boards', title: 'IP展板设计统一要求', commonPrompt: $('#series-common').value.trim() });
    await loadAll();
    message('六版展板的共用要求已更新。');
  } catch (error) { message(error.message, true); }
});

async function importEntries(data) {
  const token = await teacherToken();
  if (data.series) {
    const set = Array.isArray(data.series) ? data.series : [data.series];
    for (const item of set) await api.upsertSeries(token, item);
  }
  const rows = makeSeedRows(Array.isArray(data) ? data : data.entries || []);
  const imported = [];
  for (const row of rows) {
    const item = { ...row };
    if (item.imagePath && !item.imagePath.endsWith('.enc')) throw new Error(`${item.title} 的图片未加密；请先导入文字，再逐条上传案例图`);
    imported.push(item);
    message(`正在准备：${imported.length}/${rows.length}`);
  }
  await api.replaceEntries(token, imported);
  await loadAll();
  message(`已导入 ${imported.length} 条。相同编号会更新，不会重复创建。`);
}

$('#json-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  if (!confirm('导入 JSON？相同编号的条目将被文件内容覆盖。')) { event.target.value = ''; return; }
  try { await importEntries(JSON.parse(await file.text())); }
  catch (error) { message(`导入失败：${error.message}`, true); }
  event.target.value = '';
});

$('#export-button').addEventListener('click', async () => {
  try {
    const data = await api.listAll(await teacherToken());
    const content = JSON.stringify({ exportedAt: new Date().toISOString(), entries: data.entries, series: data.series }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `课程提示词库备份-${new Date().toISOString().slice(0,10)}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('备份已导出。图片存放在内容仓库中，备份文件包含图片路径。');
  } catch (error) { message(error.message, true); }
});

if (!api.configured) $('#unconfigured-panel').hidden = false;
else openWorkspace().then(() => {
  if (!imageKey()) message('当前链接没有案例图密钥；文字可编辑，查看或上传图片请使用教师专属链接。', true);
}).catch(error => { sessionStorage.removeItem('promptAdminSession'); showLogin(); message(error.message, true); });


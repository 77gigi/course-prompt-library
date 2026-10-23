import { validateName, filterEntries, composePrompt, makeSeedRows } from './catalog.js';
import { imageKey, protectedImageUrl } from './protected-images.js';

const $ = selector => document.querySelector(selector);
let entries = [];
let series = null;
let selectedCategory = '';
let selectedEntry = null;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function imageFor(entry, className = '') {
  if (!entry.imagePath) return node('div', `image-placeholder ${className}`, 'IP · DESIGN');
  if (!entry.imagePath.endsWith('.enc')) return node('div', `image-placeholder ${className}`, '图片未加密');
  if (!imageKey()) return node('div', `image-placeholder ${className}`, '专属链接可看案例图');
  const image = node('img', className);
  image.alt = `${entry.title}的案例效果图`;
  image.loading = 'lazy';
  protectedImageUrl(entry.imagePath).then(url => { image.src = url; }).catch(() => {
    image.replaceWith(node('div', `image-placeholder ${className}`, '案例图暂时无法打开'));
  });
  image.addEventListener('error', () => image.replaceWith(node('div', `image-placeholder ${className}`, '暂无预览图')));
  return image;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function renderFilters() {
  const courses = [...new Set(entries.map(item => item.course))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const courseSelect = $('#course-select');
  const currentCourse = courseSelect.value;
  courseSelect.replaceChildren(new Option('全部课程', ''));
  courses.forEach(course => courseSelect.add(new Option(course, course)));
  courseSelect.value = courses.includes(currentCourse) ? currentCourse : '';
  const categories = [...new Set(entries.filter(item => !courseSelect.value || item.course === courseSelect.value).map(item => item.category))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  if (selectedCategory && !categories.includes(selectedCategory)) selectedCategory = '';
  const list = $('#category-list');
  list.replaceChildren();
  for (const category of ['', ...categories]) {
    const button = node('button', `category-button ${selectedCategory === category ? 'selected' : ''}`, category || '全部类型');
    button.type = 'button';
    button.setAttribute('aria-pressed', selectedCategory === category ? 'true' : 'false');
    button.addEventListener('click', () => { selectedCategory = category; renderFilters(); renderCards(); });
    list.append(button);
  }
  $('#entry-count').textContent = entries.length;
  $('#course-count').textContent = courses.length;
}

function renderCards() {
  const shown = filterEntries(entries, $('#search-input').value, $('#course-select').value, selectedCategory);
  $('#result-count').textContent = `找到 ${shown.length} 条`;
  const grid = $('#card-grid');
  grid.replaceChildren();
  $('#empty-state').hidden = shown.length > 0;
  for (const entry of shown) {
    const card = node('article', 'prompt-card');
    const media = node('div', 'card-media'); media.append(imageFor(entry));
    const overlay = node('span', 'card-overlay', '查看模板 ↗'); media.append(overlay);
    const content = node('div', 'card-body');
    content.append(node('span', 'card-category', entry.category));
    content.append(node('h3', '', entry.title));
    content.append(node('p', '', entry.operation || '查看与复制模板'));
    const meta = node('div', 'card-meta'); meta.append(node('span', '', entry.course), node('span', '', '↗'));
    content.append(meta); card.append(media, content);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `查看${entry.title}提示词`);
    card.addEventListener('click', () => openDetail(entry));
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail(entry); } });
    grid.append(card);
  }
}

function openDetail(entry) {
  selectedEntry = entry;
  const wrap = $('#detail-content'); wrap.replaceChildren();
  const media = node('div', 'detail-media'); media.append(imageFor(entry));
  const body = node('div', 'detail-body');
  body.append(node('div', 'detail-tagline', `${entry.course}  /  ${entry.category}`));
  body.append(node('h2', '', entry.title));
  const source = [entry.sourceLabel, entry.sourceCredit ? `文档标注来源：${entry.sourceCredit}` : ''].filter(Boolean).join(' · ');
  if (source) body.append(node('p', 'detail-source', source));
  const hint = node('div', 'prompt-hint', '复制后，请把【方括号】中的内容替换为你的实际项目资料。');
  const pre = node('pre', 'prompt-text', composePrompt(entry, series));
  const actions = node('div', 'detail-actions');
  const copy = node('button', 'primary-button', '复制提示词'); copy.type = 'button'; copy.addEventListener('click', copySelected);
  actions.append(copy); body.append(hint, pre, actions);
  wrap.append(media, body);
  $('#detail-dialog').showModal();
}

async function copySelected() {
  if (!selectedEntry) return;
  try {
    await navigator.clipboard.writeText(composePrompt(selectedEntry, series));
    showToast('已复制，可以粘贴使用');
  } catch { showToast('复制失败，请手动选中文本复制'); }
}

function showNameDialog() {
  const dialog = $('#name-dialog');
  $('#student-name').value = sessionStorage.getItem('studentName') || '';
  $('#name-error').textContent = '';
  if (!dialog.open) dialog.showModal();
}

function updateVisitor() {
  const name = sessionStorage.getItem('studentName');
  $('#visitor-name').textContent = name ? `${name}，你好` : '';
  $('#change-name').hidden = !name;
  if (!name) showNameDialog();
}

async function loadContent() {
  const [catalogResponse, seriesResponse] = await Promise.all([fetch('./src/data/catalog.json', { cache: 'no-cache' }), fetch('./src/data/ip-series.json', { cache: 'no-cache' })]);
  if (!catalogResponse.ok || !seriesResponse.ok) throw new Error('暂时无法读取课程内容，请稍后刷新');
  entries = makeSeedRows(await catalogResponse.json()).filter(entry => entry.status === 'published');
  series = await seriesResponse.json();
}

$('#name-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('#student-name').value.trim();
  if (!validateName(name)) { $('#name-error').textContent = '请输入 2 至 30 个字的姓名'; return; }
  sessionStorage.setItem('studentName', name);
  $('#name-dialog').close();
  updateVisitor();
});
$('#change-name').addEventListener('click', showNameDialog);
$('#course-select').addEventListener('change', () => { selectedCategory = ''; renderFilters(); renderCards(); });
$('#search-input').addEventListener('input', renderCards);
$('#clear-filters').addEventListener('click', () => { $('#course-select').value = ''; $('#search-input').value = ''; selectedCategory = ''; renderFilters(); renderCards(); });
$('#close-detail').addEventListener('click', () => $('#detail-dialog').close());
$('#detail-dialog').addEventListener('click', event => { if (event.target === $('#detail-dialog')) $('#detail-dialog').close(); });

updateVisitor();
loadContent().then(() => { renderFilters(); renderCards(); }).catch(error => { $('#empty-state').hidden = false; $('#empty-state').querySelector('p').textContent = error.message; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});

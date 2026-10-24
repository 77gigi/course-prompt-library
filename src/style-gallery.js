const root = document.querySelector('#visual-library');
const tabs = [...root.querySelectorAll('.visual-tab')];
const panel = root.querySelector('#visual-gallery-panel');
const promptPanel = root.querySelector('#prompt-panel');
const search = root.querySelector('#visual-search');
const filters = root.querySelector('#visual-filters');
const grid = root.querySelector('#visual-grid');
const count = root.querySelector('#visual-count');
const more = root.querySelector('#visual-more');
const dialog = document.querySelector('#visual-dialog');
const detail = document.querySelector('#visual-detail');
const selectedBox = root.querySelector('#selected-visuals');
const output = root.querySelector('#prompt-output');
const categoryOrder = {
  styles: ['FA','FB','FC','FD','FE','FF','FG','FH','FI'],
  layouts: ['ip-character','social-card','infographic','comic-storyboard','ecommerce'],
  colors: ['blue','green','red','yellow','purple','orange','pink','brown','gray','black','white']
};
const state = {tab:'styles', category:'', query:'', limit:30, selected:{styles:null, layouts:null, colors:null}};
let libraries = {styles:[], layouts:[], colors:[]};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function typeLabel(type) { return {styles:'风格',layouts:'图型',colors:'色彩'}[type]; }
function nameFor(item, type) { return type === 'styles' ? item.zh : item.name; }
function setReferenceImage(image, item) {
  image.src=item.image;
  image.addEventListener('error',()=>{
    if (image.dataset.fallback || !item.image.startsWith('https://handraw-style.com/')) return;
    image.dataset.fallback='1';
    image.src=item.image.replace('https://handraw-style.com/','https://raw.githubusercontent.com/yang0/handraw-style/master/');
  });
}
function categoryFor(item, type) { return type === 'styles' ? item.group : item.category; }
function matches(item, type) {
  if (state.category && categoryFor(item,type) !== state.category) return false;
  const q = state.query.toLocaleLowerCase('zh-CN');
  if (!q) return true;
  return [item.id,item.legacy,item.groupName,item.categoryName,item.zh,item.name,item.traits,item.keywords?.join(' '),item.nameEn,item.originalName].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN').includes(q);
}
function itemsFor() {
  const type = state.tab;
  const all = libraries[type].filter(item => matches(item,type));
  if (type === 'styles' && !state.category && !state.query) {
    return {all, shown:[...all.filter(item => item.featured), ...all.filter(item => !item.featured)].slice(0,state.limit)};
  }
  return {all, shown:all.slice(0,state.limit)};
}
function renderFilters() {
  filters.replaceChildren();
  const type = state.tab;
  const list = libraries[type];
  const options = [{value:'',label:'全部'}];
  const keys = [...new Set(list.map(item => categoryFor(item,type)))];
  const ordered = [...(categoryOrder[type] || []).filter(key => keys.includes(key)), ...keys.filter(key => !(categoryOrder[type] || []).includes(key))];
  for (const key of ordered) {
    const item = list.find(x => categoryFor(x,type) === key);
    options.push({value:key,label:item.groupName || item.categoryName || key});
  }
  for (const option of options) {
    const button = el('button','style-filter',option.label);
    button.type = 'button';
    button.classList.toggle('is-active',state.category === option.value);
    button.setAttribute('aria-pressed',String(state.category === option.value));
    button.addEventListener('click',() => {state.category=option.value;state.limit=30;renderFilters();renderCards();});
    filters.append(button);
  }
}
function renderCards() {
  grid.replaceChildren();
  const type = state.tab;
  const {all,shown} = itemsFor();
  count.textContent = `显示 ${shown.length} / ${all.length} 项`;
  if (!all.length) grid.append(el('p','style-empty','没有找到相符的内容，请换个关键词。'));
  for (const item of shown) {
    const card = el('button','style-tile');
    card.type='button';
    card.setAttribute('aria-label',`查看${typeLabel(type)} ${item.id} ${nameFor(item,type)}`);
    const image = el('img');
    setReferenceImage(image,item);
    image.alt=`${item.id} ${nameFor(item,type)}示例图`;
    image.loading='lazy';
    image.decoding='async';
    const info=el('span','style-tile-info');
    info.append(el('span','style-tile-id',item.id),el('strong','style-tile-name',nameFor(item,type)),el('span','style-tile-category',item.groupName || item.categoryName));
    card.append(image,info);
    card.addEventListener('click',() => openDetail(item,type));
    grid.append(card);
  }
  more.hidden=shown.length >= all.length;
}
function setTab(type) {
  state.tab=type;state.category='';state.query='';state.limit=30;search.value='';
  tabs.forEach(tab => {const active=tab.dataset.tab === type;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));});
  const isPrompt=type==='prompts';panel.hidden=isPrompt;promptPanel.hidden=!isPrompt;
  if (!isPrompt) {
    search.placeholder={styles:'搜索编号、彩铅、水墨、剪纸……',layouts:'搜索编号、IP角色卡、海报、漫画……',colors:'搜索编号、蓝色、红色、主题色……'}[type];
    renderFilters();renderCards();
  } else renderSelected();
}
function selectedLabel(type) {
  const item=state.selected[type];
  return item ? `${item.id} · ${nameFor(item,type)}` : `未选${typeLabel(type)}`;
}
function visualTraits(item) {
  const parts=item.zh.split(' · ').filter(part=>!/(人物|动物|女孩|男孩|少女|角色|场景|情节|肖像|人像|人体|服饰|道具)/.test(part));
  return parts.length ? parts.join('、') : item.groupName;
}
function renderSelected() {
  selectedBox.replaceChildren();
  for (const type of ['styles','layouts','colors']) {
    const button=el('button','selected-chip',selectedLabel(type));
    button.type='button';button.title=`选择${typeLabel(type)}`;
    button.addEventListener('click',()=>{setTab(type);root.scrollIntoView({behavior:'smooth'});});
    selectedBox.append(button);
  }
}
function addSelection(item,type) {
  state.selected[type]=item;
  if (type==='layouts') {
    root.querySelector('#prompt-kind').value={
      'ip-character':'IP角色展板','comic-storyboard':'漫画分镜',infographic:'信息图',
      'social-card':'海报',ecommerce:'文创应用展示'
    }[item.category] || 'IP角色展板';
    if (item.category!=='ecommerce') root.querySelector('#prompt-mode').value='graphic';
  }
  renderSelected();
  const button=detail.querySelector('.visual-select');
  if (button) button.textContent=`已选为${typeLabel(type)} ✓`;
}
async function copyText(value) {
  try {await navigator.clipboard.writeText(value);return true;}
  catch {
    const input=el('textarea');input.value=value;document.body.append(input);input.select();
    const ok=document.execCommand('copy');input.remove();return ok;
  }
}
function openDetail(item,type) {
  detail.replaceChildren();
  const image=el('img','visual-detail-image');setReferenceImage(image,item);image.alt=`${item.id} ${nameFor(item,type)}示例图`;
  const body=el('div','visual-detail-body');
  body.append(el('span','visual-detail-id',`${typeLabel(type)} · ${item.id}`),el('h2','',nameFor(item,type)));
  const subtitle=el('p','visual-detail-subtitle',item.groupName || item.categoryName);body.append(subtitle);
  if (type==='styles') {
    body.append(el('h3','','中文视觉特征'),el('p','',item.traits || '原项目未提供文字特征，请结合示例图观察线条、材质、色彩和构图。'));
    body.append(el('p','visual-source-name',`原索引名称：${item.originalName}；参考作者／风格：${item.reference}`));
  } else if (type==='layouts') {
    body.append(el('h3','','图型排版说明'),el('p','',item.prompt));
  } else {
    body.append(el('p','',item.quote),el('p','',item.prompt));
  }
  const actions=el('div','visual-detail-actions');
  const select=el('button','primary-button visual-select',`选用这个${typeLabel(type)}`);select.type='button';select.addEventListener('click',()=>addSelection(item,type));actions.append(select);
  const copy=el('button','style-more',type==='layouts'?'复制图型提示词':type==='colors'?'复制色彩提示词':'复制风格特征');copy.type='button';
  copy.addEventListener('click',async()=>{const value=type==='styles'?`风格名称：${item.originalName}。核心风格特征：${item.traits}`:item.prompt;const ok=await copyText(value);copy.textContent=ok?'已复制 ✓':'复制失败，请手动选择';});actions.append(copy);
  body.append(actions,el('p','visual-detail-note','请借鉴视觉方法，独立创作自己的主题、角色与内容。'));
  detail.append(image,body);dialog.showModal();
}
function buildPrompt() {
  const kind=root.querySelector('#prompt-kind').value;
  const theme=root.querySelector('#prompt-theme').value.trim();
  const words=root.querySelector('#prompt-text').value.trim();
  const ratio=root.querySelector('#prompt-ratio').value;
  const mode=root.querySelector('#prompt-mode').value;
  if (!theme) {output.textContent='请先填写作品主题与具体内容。';root.querySelector('#prompt-theme').focus();return;}
  const {styles,layouts,colors}=state.selected;
  const parts=[`作品类型：${kind}。`,`主题：${theme}`];
  if (styles) parts.push(`风格名称：${styles.originalName}。视觉特征：${visualTraits(styles)}。请只参考线条、媒介、质感与色彩，不复制示例图中的人物、道具或场景。`);
  if (layouts) {
    const body=layouts.prompt.startsWith(layouts.name) ? layouts.prompt.slice(layouts.name.length).replace(/^[。．\s]+/,'') : layouts.prompt;
    const layoutText=body
      .replace(/主题：\{[^}]+\}[^\n]*/g,'')
      .split('\n')
      .filter(line=>!/^\s*(默认|IP默认)/.test(line))
      .join('\n').trim();
    parts.push(`图型：${layouts.name}。${layoutText}`);
  }
  if (colors) parts.push(colors.prompt);
  if (ratio) parts.push(`画幅：${ratio}。`);
  if (words) parts.push(`必须准确呈现的文字：${words}。`);
  parts.push(mode==='graphic'?'画面与文字共同构图；文字位置、层级和可读性要与图像协调。':'以画面为主；除明确要求外，不在图中添加文字。');
  parts.push('作品主体、造型、动作和故事以我填写的主题为准。');
  output.textContent=parts.join('\n');
}

for (const tab of tabs) tab.addEventListener('click',()=>setTab(tab.dataset.tab));
search.addEventListener('input',()=>{state.query=search.value.trim();state.limit=30;renderCards();});
more.addEventListener('click',()=>{state.limit+=30;renderCards();});
document.querySelector('#close-visual').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog) dialog.close();});
root.querySelector('#build-prompt').addEventListener('click',buildPrompt);
root.querySelector('#copy-prompt').addEventListener('click',async()=>{const value=output.textContent;if(!value || value.startsWith('请先')) return;const button=root.querySelector('#copy-prompt');button.textContent=await copyText(value)?'已复制 ✓':'复制失败';setTimeout(()=>button.textContent='复制提示词',1800);});

try {
  const urls=['style-gallery','layout-gallery','color-gallery'].map(x=>`./src/data/${x}.json`);
  const responses=await Promise.all(urls.map(url=>fetch(url)));
  if(responses.some(response=>!response.ok)) throw new Error('数据加载失败');
  const [styles,layouts,colors]=await Promise.all(responses.map(response=>response.json()));
  libraries={styles,layouts,colors};
  setTab('styles');
} catch(error) {
  count.textContent='画廊暂时无法加载';
  grid.append(el('p','style-empty','请刷新页面后重试。'));
  console.error(error);
}

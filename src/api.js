const API_ROOT = 'https://api.github.com';

function encodeBytes(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

function encodeText(value) { return encodeBytes(new TextEncoder().encode(value)); }
function decodeText(value) {
  const binary = atob(String(value).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, letter => letter.charCodeAt(0)));
}

export function createApi(config, fetcher = globalThis.fetch) {
  const owner = String(config?.repoOwner || '').trim();
  const repo = String(config?.repoName || '').trim();
  const branch = String(config?.branch || 'main').trim();
  const configured = Boolean(owner && repo && branch);
  const prefix = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  function requireTeacher(token) {
    if (!configured) throw new Error('尚未连接免费内容仓库');
    if (!token) throw new Error('请先填写教师管理密钥');
  }

  async function request(path, token, { method = 'GET', body } = {}) {
    requireTeacher(token);
    const response = await fetcher(`${API_ROOT}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) {
      const message = response.status === 401 ? '管理密钥无效或已过期' :
        response.status === 403 ? '管理密钥没有该仓库的写入权限' :
        response.status === 409 ? '内容刚被其他设备修改，请刷新后重试' :
        result?.message || `请求失败（${response.status}）`;
      throw new Error(message);
    }
    return result;
  }

  async function getFile(token, path) {
    const safePath = path.split('/').map(encodeURIComponent).join('/');
    const result = await request(`${prefix}/contents/${safePath}?ref=${encodeURIComponent(branch)}`, token);
    if (result.type !== 'file' || !result.content) throw new Error(`无法读取 ${path}`);
    return { content: decodeText(result.content), sha: result.sha };
  }

  async function writeFile(token, path, content, message, sha) {
    const safePath = path.split('/').map(encodeURIComponent).join('/');
    return request(`${prefix}/contents/${safePath}`, token, {
      method: 'PUT',
      body: { message, content, branch, ...(sha ? { sha } : {}) },
    });
  }

  async function verifyTeacher(token) {
    await request(`${prefix}?ref=${encodeURIComponent(branch)}`, token);
    await getFile(token, 'src/data/catalog.json');
    return true;
  }

  async function listAll(token) {
    const [catalog, seriesFile] = await Promise.all([
      getFile(token, 'src/data/catalog.json'),
      getFile(token, 'src/data/ip-series.json'),
    ]);
    const entries = JSON.parse(catalog.content);
    const series = JSON.parse(seriesFile.content);
    if (!Array.isArray(entries)) throw new Error('提示词目录格式不正确');
    return { entries, series: [series] };
  }

  async function upsertEntry(token, entry) {
    const file = await getFile(token, 'src/data/catalog.json');
    const entries = JSON.parse(file.content);
    const index = entries.findIndex(item => item.slug === entry.slug);
    const saved = { ...entry, id: entry.id || entry.slug, createdAt: entry.createdAt || new Date().toISOString() };
    if (index >= 0) entries[index] = { ...entries[index], ...saved };
    else entries.unshift(saved);
    await writeFile(token, 'src/data/catalog.json', encodeText(JSON.stringify(entries, null, 2) + '\n'), `更新提示词：${saved.title}`, file.sha);
    return saved;
  }

  async function replaceEntries(token, imported) {
    const file = await getFile(token, 'src/data/catalog.json');
    const entries = JSON.parse(file.content);
    const bySlug = new Map(entries.map(item => [item.slug, item]));
    for (const item of imported) bySlug.set(item.slug, { ...(bySlug.get(item.slug) || {}), ...item, id: item.id || item.slug });
    const merged = [...bySlug.values()];
    await writeFile(token, 'src/data/catalog.json', encodeText(JSON.stringify(merged, null, 2) + '\n'), `批量导入 ${imported.length} 条提示词`, file.sha);
    return merged.length;
  }

  async function archiveEntry(token, slug) {
    const file = await getFile(token, 'src/data/catalog.json');
    const entries = JSON.parse(file.content);
    const target = entries.find(item => item.slug === slug);
    if (!target) throw new Error('找不到这条提示词');
    target.status = 'archived';
    await writeFile(token, 'src/data/catalog.json', encodeText(JSON.stringify(entries, null, 2) + '\n'), `归档提示词：${target.title}`, file.sha);
    return target;
  }

  async function upsertSeries(token, series) {
    const file = await getFile(token, 'src/data/ip-series.json');
    await writeFile(token, 'src/data/ip-series.json', encodeText(JSON.stringify(series, null, 2) + '\n'), '更新 IP 展板共用要求', file.sha);
    return series;
  }

  async function uploadImage(token, blob, path) {
    requireTeacher(token);
    const content = encodeBytes(new Uint8Array(await blob.arrayBuffer()));
    await writeFile(token, `public/examples/${path}`, content, `添加案例图：${path}`);
    return `public/examples/${path}`;
  }

  return { configured, verifyTeacher, listAll, upsertEntry, replaceEntries, archiveEntry, upsertSeries, uploadImage };
}

export function normalize(text) {
  return String(text ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

export function validateName(name) {
  const value = String(name ?? '').trim();
  return value.length >= 2 && value.length <= 30;
}

export function filterEntries(entries, query = '', course = '', category = '') {
  const terms = normalize(query).split(' ').filter(Boolean);
  return entries.filter(entry => {
    if (course && entry.course !== course) return false;
    if (category && entry.category !== category) return false;
    const haystack = normalize([entry.title, entry.category, entry.course, entry.body, entry.prompt, entry.operation].join(' '));
    return terms.every(term => haystack.includes(term));
  });
}

export function composePrompt(entry, series) {
  const common = entry.seriesId && series?.id === entry.seriesId ? series.commonPrompt?.trim() : '';
  const body = String(entry.body ?? entry.prompt ?? '').trim();
  return [entry.title ? `本次主题：${entry.title}` : '', common, body].filter(Boolean).join('\n\n');
}

export function makeSeedRows(seed) {
  const seen = new Set();
  return seed.map(entry => {
    const slug = String(entry.slug ?? entry.id ?? '').trim();
    if (!slug || seen.has(slug)) throw new Error(`缺少或重复的条目编号：${slug}`);
    seen.add(slug);
    return { ...entry, slug };
  });
}

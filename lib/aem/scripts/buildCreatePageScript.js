/**
 * buildCreatePageScript
 *
 * Generates the DevTools snippet that creates a new AEM research page
 * for the given article. The snippet creates the page, sets its
 * description / display date / read time, writes authors, thumbnail,
 * and tags, by POSTing to /bin/wcmcommand and the jcr:content sling
 * endpoint with the CSRF token from the active AEM session.
 *
 * It auto-discovers a "sibling" reference page so it can detect the
 * correct property names for read-time, authors and extra image nodes
 * (those vary between MSCI templates).
 *
 * Extracted verbatim from the original inline implementation in
 * ArticlePage; see buildPublishAssetsScript for the same pattern.
 */

// Escape for inlining user-supplied strings into a JS template literal.
function esc(s) {
  return (s || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
}

// Author name → URL-safe slug (kept local so this module stays self-contained).
function toAuthorSlug(name) {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function buildCreatePageScript(article) {
  const slug = article.slug || ''
  const title = esc(article.headline || '')
  const metaDesc = esc(article.meta_description || '')
  const readTime = article.read_time ? parseInt(article.read_time, 10) : ''
  const publishDate = article.publish_date || ''
  const parentPath = '/content/msci/us/en/research-and-insights/blog-post'
  const damBase = '/content/dam/web/msci-com/research-and-insights/blog-post'
  const authors = article.authors || []
  const contributorBase = '/content/dam/web/msci-com/research-and-insights/contributor'
  const authorsJson = esc(JSON.stringify(authors.map(a => {
    if (a.content_fragment_path) return a.content_fragment_path
    const aSlug = toAuthorSlug(a.name)
    return aSlug ? `${contributorBase}/${aSlug}/${aSlug}` : null
  }).filter(Boolean)))
  const tags = article.tags?.all_tags || []
  const tagsJson = esc(JSON.stringify(tags))
  const allBanners = Object.values(article.banner_paths || {})
  const banner1x1 = allBanners.find(b => b?.filename?.includes('1x1'))
  const thumbnailDamPath = banner1x1?.filename ? `${damBase}/${slug}/banners/${banner1x1.filename}` : ''

  return `
(async () => {
  const token = (await fetch('/libs/granite/csrf/token.json').then(r=>r.json())).token;
  const templatePath = '/conf/webmasters-aem/settings/wcm/templates/research-page2';
  const parentPath = '${parentPath}';
  const pagePath = parentPath + '/${slug}';
  const jcrContent = pagePath + '/jcr:content';
  const siblingBase = '/content/msci/us/en/research-and-insights/blog-post';
  let r;

  async function post(path, params) {
    return fetch(path, { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  }
  const ok = r => r.status === 200 || r.status === 201;

  // ── Discovery: one sibling fetch used by steps 4, 5 and 6 ──
  let siblingProps = null;    // flat jcr:content properties of a reference sibling
  let siblingAuthors = null;  // authors.2.json of that sibling
  try {
    const list = await fetch(siblingBase + '.1.json', { headers: { 'CSRF-Token': token } }).then(r => r.json());
    for (const key of Object.keys(list).filter(k => !k.startsWith('jcr:') && !k.startsWith(':')).slice(0, 20)) {
      try {
        const props = await fetch(siblingBase + '/' + key + '/jcr:content.2.json', { headers: { 'CSRF-Token': token } }).then(r => r.json());
        const authRes = await fetch(siblingBase + '/' + key + '/jcr:content/authors.2.json', { headers: { 'CSRF-Token': token } });
        if (authRes.ok) { siblingAuthors = await authRes.json(); siblingProps = props; break; }
      } catch(e) { /* try next */ }
    }
  } catch(e) { /* no siblings */ }

  // ── Step 1: Create page ──
  console.log('1️⃣ Creating page "${slug}"...');
  const s = (await fetch('/bin/wcmcommand', { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ cmd: 'createPage', parentPath, title: \`${title}\`, label: '${slug}', template: templatePath }).toString() })).status;
  if (s === 200 || s === 201) { console.log('   ✅ Created'); }
  else if (s === 500) { console.log('   ⚠️ Already exists — updating properties'); }
  else { console.error('   ❌ Failed: HTTP', s); return; }

  // ── Step 2: Description ──
  console.log('2️⃣ Setting description...');
  try {
    r = await post(jcrContent, new URLSearchParams({ 'jcr:description': \`${metaDesc}\` }));
    console.log('   Description:', ok(r) ? '✅' : '❌ ' + r.status);
  } catch(e) { console.error('   ❌', e.message); }

  // ── Step 3: Display Date ──
  console.log('3️⃣ Setting display date...');
  try {
    const pubDate = '${publishDate}';
    if (!pubDate) { console.log('   ⚠️ No publication date — skipping'); } else {
      const p = new URLSearchParams({ displayDate: pubDate + 'T00:00:00.000Z', 'displayDate@TypeHint': 'Date' });
      r = await post(jcrContent, p);
      console.log('   Display date:', ok(r) ? '✅ ' + pubDate : '❌ ' + r.status);
    }
  } catch(e) { console.error('   ❌', e.message); }

  // ── Step 4: Read/Listen/Watch Time ──
  console.log('4️⃣ Setting read time...');
  try {
    const rt = ${readTime || 0};
    if (!rt) { console.log('   ⚠️ No read time — skipping'); } else {
      const rtCandidates = ['time', 'readListenWatchTime', 'readTime', 'rlwTime'];
      const rtProp = (siblingProps && rtCandidates.find(c => c in siblingProps && Number(siblingProps[c]) > 0)) || 'time';
      r = await post(jcrContent, new URLSearchParams({ [rtProp]: String(rt), [rtProp + '@TypeHint']: 'Long' }));
      console.log('   Read time:', ok(r) ? '✅ ' + rt + ' min' : '❌ ' + r.status);
    }
  } catch(e) { console.error('   ❌', e.message); }

  // ── Step 5: Authors ──
  console.log('5️⃣ Setting authors...');
  try {
    const authorPaths = JSON.parse(\`${authorsJson}\`);
    if (!authorPaths.length) { console.log('   ⚠️ No authors — skipping'); } else {
      // Discover author property name from sibling, fallback to probe
      let authorProp = null;
      if (siblingAuthors) {
        const items = Object.keys(siblingAuthors).filter(k => k.startsWith('item'));
        if (items.length) {
          const props = Object.keys(siblingAuthors[items[0]]).filter(k => !k.startsWith('jcr:') && !k.startsWith('sling:') && !k.startsWith(':'));
          if (props.length) authorProp = props[0];
        }
      }
      if (!authorProp) {
        const probePath = jcrContent + '/authors/__probe__';
        for (const c of ['profilePath', 'fragmentPath', 'contentFragment', 'fileReference', 'author']) {
          await fetch(probePath, { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ 'jcr:primaryType': 'nt:unstructured', [c]: '/probe' }).toString() });
          const probe = await fetch(probePath + '.json', { headers: { 'CSRF-Token': token } }).then(r => r.json()).catch(() => ({}));
          if (probe[c] === '/probe') { authorProp = c; break; }
        }
        await fetch(probePath, { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: ':operation=delete' });
        if (!authorProp) { authorProp = 'profilePath'; }
      }

      await fetch(jcrContent + '/authors', { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: ':operation=delete' });
      for (let i = 0; i < authorPaths.length; i++) {
        r = await fetch(jcrContent + '/authors/item' + i, { method: 'POST', headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ 'jcr:primaryType': 'nt:unstructured', [authorProp]: authorPaths[i] }).toString() });
        console.log('   Author ' + (i + 1) + ':', ok(r) ? '✅' : '❌ ' + r.status, authorPaths[i].split('/').pop());
      }
    }
  } catch(e) { console.error('   ❌', e.message); }

  // ── Step 6: Thumbnail ──
  console.log('6️⃣ Setting thumbnail...');
  try {
    const thumbPath = '${thumbnailDamPath}';
    if (!thumbPath) { console.log('   ⚠️ No 1x1 banner — skipping'); } else {
      // Set the two standard image nodes
      r = await post(jcrContent + '/cq:featuredimage', new URLSearchParams({ fileReference: thumbPath }));
      console.log('   cq:featuredimage:', ok(r) ? '✅' : '❌ ' + r.status);
      r = await post(jcrContent + '/image', new URLSearchParams({ fileReference: thumbPath }));
      console.log('   image:', ok(r) ? '✅' : '❌ ' + r.status);

      // Set any extra image node found in siblings (e.g. cq:featuredImage with capital I)
      if (siblingProps) {
        const extraNodes = Object.entries(siblingProps).filter(([k, v]) =>
          typeof v === 'object' && v !== null && typeof v.fileReference === 'string' &&
          v.fileReference.includes('/content/dam/') && k !== 'image' && k.toLowerCase() !== 'cq:featuredimage'
        );
        for (const [nodeName] of extraNodes) {
          r = await post(jcrContent + '/' + nodeName, new URLSearchParams({ fileReference: thumbPath }));
          console.log('   ' + nodeName + ':', ok(r) ? '✅' : '❌ ' + r.status);
        }
      }
    }
  } catch(e) { console.error('   ❌', e.message); }

  // ── Step 7: Tags (direct mapping, preserve existing) ──
  console.log('7️⃣ Setting tags...');
  try {
    // Category → AEM namespace mapping
    const catToNs = {
      'asset class': 'asset-class',
      'research format': 'research-format',
      'format': 'research-format',
      'line of business': 'line-of-business',
      'theme': 'theme',
      'topic': 'topic',
      'marketing program': 'marketing-program',
      'campaign': 'page_campaign',
      'research type': 'research-type',
      'type': 'research-type',
    };

    // Research Type: extracted name → AEM slug
    const researchTypeMap = {
      'commentary': 'commentary',
      'insights in action': 'product-insight',
      'research insights': 'research',
      'blog': 'blog',
    };

    function slugify(str) {
      return str.toLowerCase().trim()
        .replace(/&/g, '-and-')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    function resolveSlug(namespace, value) {
      // Campaign: use only text before parenthesis as slug
      if (namespace === 'page_campaign') {
        const parenIdx = value.indexOf('(');
        const raw = parenIdx !== -1 ? value.substring(0, parenIdx).trim() : value.trim();
        return slugify(raw);
      }
      // Research Type: use manual mapping
      if (namespace === 'research-type') {
        const mapped = researchTypeMap[value.toLowerCase().trim()];
        if (mapped) return mapped;
      }
      return slugify(value);
    }

    // 6a. Read existing tags from page
    const pageJson = await fetch(jcrContent + '.json', { headers: { 'CSRF-Token': token } }).then(r => r.json());
    const existingTags = Array.isArray(pageJson['cq:tags']) ? pageJson['cq:tags']
      : pageJson['cq:tags'] ? [pageJson['cq:tags']] : [];
    console.log('   Existing tags (' + existingTags.length + '):');
    existingTags.forEach(t => console.log('     ✓', t));

    // 6b. Resolve each article tag
    const articleTags = JSON.parse(\`${tagsJson}\`);
    const newTags = [];
    const skipped = [];
    const notFound = [];

    for (const tag of articleTags) {
      const sep = tag.indexOf(' : ');
      if (sep === -1) { notFound.push({ tag, reason: 'bad format (no " : " separator)' }); continue; }
      const category = tag.substring(0, sep).trim();
      const value = tag.substring(sep + 3).trim();
      const namespace = catToNs[category.toLowerCase()];
      if (!namespace) { notFound.push({ tag, reason: 'unknown category "' + category + '"' }); continue; }

      const valueSlug = resolveSlug(namespace, value);
      const tagId = namespace + ':' + valueSlug;

      // Already on page?
      if (existingTags.includes(tagId)) {
        skipped.push({ tag, tagId });
        continue;
      }

      // Verify tag exists in AEM
      const check = await fetch('/content/cq:tags/' + namespace + '/' + valueSlug + '.json', {
        headers: { 'CSRF-Token': token }
      });
      if (check.ok) {
        newTags.push({ tag, tagId });
        console.log('   ✅ "' + tag + '" → ' + tagId);
      } else {
        notFound.push({ tag, reason: tagId + ' does not exist in AEM (HTTP ' + check.status + ')' });
      }
    }

    if (skipped.length) {
      console.log('   \\n   Already on page (' + skipped.length + '):');
      skipped.forEach(t => console.log('     ⏭', t.tag, '→', t.tagId));
    }
    if (notFound.length) {
      console.log('   \\n   Skipped — not found (' + notFound.length + '):');
      notFound.forEach(t => console.log('     ⚠️', t.tag, '—', t.reason));
    }

    // 6c. Merge and save
    if (newTags.length === 0) {
      console.log('   \\n   No new tags to add.');
    } else {
      const allTags = [...existingTags, ...newTags.map(t => t.tagId)];
      console.log('   \\n   Saving ' + allTags.length + ' total (' + existingTags.length + ' existing + ' + newTags.length + ' new)...');
      const p = new URLSearchParams();
      allTags.forEach(t => p.append('cq:tags', t));
      p.set('cq:tags@TypeHint', 'String[]');
      r = await post(jcrContent, p);
      console.log('   Tags save:', ok(r) ? '✅ Done' : '❌ Status ' + r.status);
      if (!ok(r)) console.log('   Response:', await r.text());
    }
  } catch(e) { console.error('   ❌ Tags error:', e.message, e); }

  // ── Summary ──
  console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Edit page: /editor.html' + pagePath + '.html');
  console.log('📂 Sites view: /ui#/aem/sites.html' + parentPath);
  console.log('🖼 DAM assets: /ui#/aem/assets.html${damBase}/${slug}');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
})();
`.trim()
}

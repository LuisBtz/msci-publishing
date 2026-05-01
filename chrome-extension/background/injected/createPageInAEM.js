/**
 * createPageInAEM (INJECTED)
 *
 * Creates a research page on AEM Author and wires up its metadata:
 * description, display date, read time, authors, thumbnail and tags.
 * Before setting authors and read time it "probes" a sibling page to
 * discover the exact property names used by the current template —
 * different MSCI templates disagree on whether authors live under
 * `profilePath`, `fragmentPath`, etc.
 *
 * SELF-CONTAINED: serialized into the page via chrome.scripting, so
 * no imports, no closure variables, no module-level helpers.
 */
export async function createPageInAEM(params) {
    const logs = [];
    const log = (m) => logs.push({ type: 'log', message: m });
    const logErr = (m) => logs.push({ type: 'error', message: m });
    const logWarn = (m) => logs.push({ type: 'warn', message: m });
    try {
        const { slug, title, metaDesc, readTime, publishDate, authorPaths, tags, thumbnailDamPath } = params;
        log('🔑 Fetching CSRF token...');
        const token = (await fetch('/libs/granite/csrf/token.json').then((r) => r.json())).token;
        if (!token)
            throw new Error('Could not get CSRF token');
        const templatePath = '/conf/webmasters-aem/settings/wcm/templates/research-page2';
        const parentPath = '/content/msci/us/en/research-and-insights/blog-post';
        const pagePath = parentPath + '/' + slug;
        const jcrContent = pagePath + '/jcr:content';
        const siblingBase = '/content/msci/us/en/research-and-insights/blog-post';
        async function post_(path, p) {
            return fetch(path, {
                method: 'POST',
                headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: p.toString(),
            });
        }
        const ok = (r) => r.status === 200 || r.status === 201;
        log('🔍 Discovering sibling page properties...');
        let siblingProps = null;
        let siblingAuthors = null;
        try {
            const list = await fetch(siblingBase + '.1.json', { headers: { 'CSRF-Token': token } }).then((r) => r.json());
            for (const key of Object.keys(list)
                .filter((k) => !k.startsWith('jcr:') && !k.startsWith(':'))
                .slice(0, 20)) {
                try {
                    const props = await fetch(siblingBase + '/' + key + '/jcr:content.2.json', {
                        headers: { 'CSRF-Token': token },
                    }).then((r) => r.json());
                    const authRes = await fetch(siblingBase + '/' + key + '/jcr:content/authors.2.json', {
                        headers: { 'CSRF-Token': token },
                    });
                    if (authRes.ok) {
                        siblingAuthors = await authRes.json();
                        siblingProps = props;
                        break;
                    }
                }
                catch (e) { }
            }
        }
        catch (e) { }
        log(`\n1️⃣ Creating page "${slug}"...`);
        const s = (await fetch('/bin/wcmcommand', {
            method: 'POST',
            headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ cmd: 'createPage', parentPath, title, label: slug, template: templatePath }).toString(),
        })).status;
        if (s === 200 || s === 201)
            log('   ✅ Created');
        else if (s === 500)
            logWarn('   ⚠️ Already exists — updating properties');
        else {
            logErr('   ❌ Failed: HTTP ' + s);
            return { success: false, logs, error: 'Page creation failed' };
        }
        let r;
        log('\n2️⃣ Setting description...');
        try {
            r = await post_(jcrContent, new URLSearchParams({ 'jcr:description': metaDesc || '' }));
            log('   Description: ' + (ok(r) ? '✅' : '❌ HTTP ' + r.status));
        }
        catch (e) {
            logErr('   ❌ ' + e.message);
        }
        log('\n3️⃣ Setting display date...');
        try {
            if (!publishDate) {
                logWarn('   ⚠️ No publication date — skipping');
            }
            else {
                const p = new URLSearchParams({
                    displayDate: publishDate + 'T00:00:00.000Z',
                    'displayDate@TypeHint': 'Date',
                });
                r = await post_(jcrContent, p);
                log('   Display date: ' + (ok(r) ? '✅ ' + publishDate : '❌ HTTP ' + r.status));
            }
        }
        catch (e) {
            logErr('   ❌ ' + e.message);
        }
        log('\n4️⃣ Setting read time...');
        try {
            const rt = readTime || 0;
            if (!rt) {
                logWarn('   ⚠️ No read time — skipping');
            }
            else {
                const rtCandidates = ['time', 'readListenWatchTime', 'readTime', 'rlwTime'];
                const rtProp = (siblingProps && rtCandidates.find((c) => c in siblingProps && Number(siblingProps[c]) > 0)) || 'time';
                r = await post_(jcrContent, new URLSearchParams({ [rtProp]: String(rt), [rtProp + '@TypeHint']: 'Long' }));
                log('   Read time: ' + (ok(r) ? '✅ ' + rt + ' min' : '❌ HTTP ' + r.status));
            }
        }
        catch (e) {
            logErr('   ❌ ' + e.message);
        }
        log('\n5️⃣ Setting authors...');
        try {
            if (!authorPaths || !authorPaths.length) {
                logWarn('   ⚠️ No authors — skipping');
            }
            else {
                let authorProp = null;
                if (siblingAuthors) {
                    const items = Object.keys(siblingAuthors).filter((k) => k.startsWith('item'));
                    if (items.length) {
                        const props = Object.keys(siblingAuthors[items[0]]).filter((k) => !k.startsWith('jcr:') && !k.startsWith('sling:') && !k.startsWith(':'));
                        if (props.length)
                            authorProp = props[0];
                    }
                }
                if (!authorProp) {
                    const probePath = jcrContent + '/authors/__probe__';
                    for (const c of ['profilePath', 'fragmentPath', 'contentFragment', 'fileReference', 'author']) {
                        await fetch(probePath, {
                            method: 'POST',
                            headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: new URLSearchParams({ 'jcr:primaryType': 'nt:unstructured', [c]: '/probe' }).toString(),
                        });
                        const probe = await fetch(probePath + '.json', { headers: { 'CSRF-Token': token } })
                            .then((r) => r.json())
                            .catch(() => ({}));
                        if (probe[c] === '/probe') {
                            authorProp = c;
                            break;
                        }
                    }
                    await fetch(probePath, {
                        method: 'POST',
                        headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: ':operation=delete',
                    });
                    if (!authorProp)
                        authorProp = 'profilePath';
                }
                await fetch(jcrContent + '/authors', {
                    method: 'POST',
                    headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: ':operation=delete',
                });
                for (let i = 0; i < authorPaths.length; i++) {
                    r = await fetch(jcrContent + '/authors/item' + i, {
                        method: 'POST',
                        headers: { 'CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({ 'jcr:primaryType': 'nt:unstructured', [authorProp]: authorPaths[i] }).toString(),
                    });
                    log('   Author ' +
                        (i + 1) +
                        ': ' +
                        (ok(r) ? '✅' : '❌ HTTP ' + r.status) +
                        ' ' +
                        authorPaths[i].split('/').pop());
                }
            }
        }
        catch (e) {
            logErr('   ❌ ' + e.message);
        }
        log('\n6️⃣ Setting thumbnail...');
        try {
            if (!thumbnailDamPath) {
                logWarn('   ⚠️ No 1x1 banner — skipping');
            }
            else {
                r = await post_(jcrContent + '/cq:featuredimage', new URLSearchParams({ fileReference: thumbnailDamPath }));
                log('   cq:featuredimage: ' + (ok(r) ? '✅' : '❌ HTTP ' + r.status));
                r = await post_(jcrContent + '/image', new URLSearchParams({ fileReference: thumbnailDamPath }));
                log('   image: ' + (ok(r) ? '✅' : '❌ HTTP ' + r.status));
                if (siblingProps) {
                    const extraNodes = Object.entries(siblingProps).filter(([k, v]) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const val = v;
                        return typeof val === 'object' &&
                            val !== null &&
                            typeof val.fileReference === 'string' &&
                            val.fileReference.includes('/content/dam/') &&
                            k !== 'image' &&
                            k.toLowerCase() !== 'cq:featuredimage';
                    });
                    for (const [nodeName] of extraNodes) {
                        r = await post_(jcrContent + '/' + nodeName, new URLSearchParams({ fileReference: thumbnailDamPath }));
                        log('   ' + nodeName + ': ' + (ok(r) ? '✅' : '❌ HTTP ' + r.status));
                    }
                }
            }
        }
        catch (e) {
            logErr('   ❌ ' + e.message);
        }
        log('\n7️⃣ Setting tags...');
        try {
            const catToNs = {
                'asset class': 'asset-class',
                'research format': 'research-format',
                format: 'research-format',
                'line of business': 'line-of-business',
                theme: 'theme',
                topic: 'topic',
                'marketing program': 'marketing-program',
                campaign: 'page_campaign',
                'research type': 'research-type',
                type: 'research-type',
            };
            const researchTypeMap = {
                commentary: 'commentary',
                'insights in action': 'product-insight',
                'research insights': 'research',
                blog: 'blog',
            };
            function slugify(str) {
                return str
                    .toLowerCase()
                    .trim()
                    .replace(/&/g, '-and-')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '');
            }
            function resolveSlug(namespace, value) {
                if (namespace === 'page_campaign') {
                    const pi = value.indexOf('(');
                    const raw = pi !== -1 ? value.substring(0, pi).trim() : value.trim();
                    return slugify(raw);
                }
                if (namespace === 'research-type') {
                    const mapped = researchTypeMap[value.toLowerCase().trim()];
                    if (mapped)
                        return mapped;
                }
                return slugify(value);
            }
            const pageJson = await fetch(jcrContent + '.json', { headers: { 'CSRF-Token': token } }).then((r) => r.json());
            const existingTags = Array.isArray(pageJson['cq:tags'])
                ? pageJson['cq:tags']
                : pageJson['cq:tags']
                    ? [pageJson['cq:tags']]
                    : [];
            log('   Existing tags (' + existingTags.length + ')');
            const newTags = [];
            const skipped = [];
            const notFound = [];
            for (const tag of tags || []) {
                const sep = tag.indexOf(' : ');
                if (sep === -1) {
                    notFound.push({ tag, reason: 'bad format' });
                    continue;
                }
                const category = tag.substring(0, sep).trim();
                const value = tag.substring(sep + 3).trim();
                const namespace = catToNs[category.toLowerCase()];
                if (!namespace) {
                    notFound.push({ tag, reason: 'unknown category "' + category + '"' });
                    continue;
                }
                const valueSlug = resolveSlug(namespace, value);
                const tagId = namespace + ':' + valueSlug;
                if (existingTags.includes(tagId)) {
                    skipped.push({ tag, tagId });
                    continue;
                }
                const check = await fetch('/content/cq:tags/' + namespace + '/' + valueSlug + '.json', {
                    headers: { 'CSRF-Token': token },
                });
                if (check.ok) {
                    newTags.push({ tag, tagId });
                    log('   ✅ "' + tag + '" → ' + tagId);
                }
                else {
                    notFound.push({ tag, reason: tagId + ' not found (HTTP ' + check.status + ')' });
                }
            }
            if (skipped.length) {
                log('   ⏭ Already on page: ' + skipped.length);
                skipped.forEach((t) => log('     • ' + t.tag));
            }
            if (notFound.length) {
                logWarn('   ⚠️ Skipped (not found): ' + notFound.length);
                notFound.forEach((t) => logWarn('     • ' + t.tag + ' — ' + t.reason));
            }
            if (newTags.length === 0) {
                log('   No new tags to add.');
            }
            else {
                const allTags = [...existingTags, ...newTags.map((t) => t.tagId)];
                log('   Saving ' + allTags.length + ' total...');
                const p = new URLSearchParams();
                allTags.forEach((t) => p.append('cq:tags', t));
                p.set('cq:tags@TypeHint', 'String[]');
                r = await post_(jcrContent, p);
                log('   Tags save: ' + (r.status === 200 ? '✅ Done' : '❌ HTTP ' + r.status));
            }
        }
        catch (e) {
            logErr('   ❌ Tags error: ' + e.message);
        }
        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('📝 Edit page: /editor.html' + pagePath + '.html');
        log('📂 Sites view: /ui#/aem/sites.html' + parentPath);
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return { success: true, logs };
    }
    catch (err) {
        logErr('💥 Fatal error: ' + err.message);
        return { success: false, logs, error: err.message };
    }
}

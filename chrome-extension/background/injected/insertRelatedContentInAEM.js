/**
 * insertRelatedContentInAEM (INJECTED)
 *
 * Populates the 3 grid cards inside the existing gridcontainer with
 * related content data (title, description, CTA link/label).
 *
 * Expected page structure (from template):
 *   root/main/container_X  [Theme Container v2]
 *     └─ node0 [responsivegrid]
 *         └─ gridcontainer [webmasters-aem/components/gridcontainer]
 *             ├─ gridcard_* (card 1)
 *             ├─ gridcard_* (card 2)
 *             └─ gridcard_* (card 3)
 *
 * Properties written per card (from sibling probe):
 *   teaserTitle, teaserDescription, ctaLink, ctaLabel, variant=tertiary
 *
 * SELF-CONTAINED: serialized into the page — no imports / closures.
 */
export async function insertRelatedContentInAEM(slug, relatedItems) {
    const logs = [];
    const log = (m) => logs.push({ type: 'log', message: m });
    const logErr = (m) => logs.push({ type: 'error', message: m });
    const logWarn = (m) => logs.push({ type: 'warn', message: m });
    console.groupCollapsed('[RelatedContent] insert into ' + slug);
    try {
        log('Conectando con AEM…');
        const token = (await fetch('/libs/granite/csrf/token.json').then((r) => r.json())).token;
        if (!token)
            throw new Error('No se pudo obtener el token CSRF');
        const parentPath = '/content/msci/us/en/research-and-insights/blog-post';
        const jcrContent = parentPath + '/' + slug + '/jcr:content';
        // Helper: Sling POST
        async function slingPost(path, params) {
            return fetch(path, {
                method: 'POST',
                headers: {
                    'CSRF-Token': token,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                },
                body: params.toString(),
            });
        }
        // ── Step 1: Find the gridcontainer ─────────────────────────────
        log('Buscando gridcontainer…');
        const pageTree = await fetch(jcrContent + '.infinity.json', {
            headers: { 'CSRF-Token': token },
        }).then((r) => r.json());
        if (!pageTree)
            throw new Error('No se pudo leer la página');
        const GRIDCONTAINER_TYPE = 'webmasters-aem/components/gridcontainer';
        const GRIDCARD_TYPE = 'webmasters-aem/components/gridcard';
        const CONTAINER_TYPE = 'webmasters-aem/components/container/v2/container';
        let gridcontainerPath = null;
        function findGridContainer(node, path) {
            if (!node || typeof node !== 'object')
                return null;
            if ((node['sling:resourceType'] || '') === GRIDCONTAINER_TYPE) {
                return path;
            }
            for (const [k, v] of Object.entries(node)) {
                if (k.startsWith('jcr:') || k.startsWith('sling:') || k.startsWith('cq:') || k.startsWith(':'))
                    continue;
                if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                    const found = findGridContainer(v, path + '/' + k);
                    if (found)
                        return found;
                }
            }
            return null;
        }
        gridcontainerPath = findGridContainer(pageTree, jcrContent);
        if (!gridcontainerPath) {
            logErr('No se encontró un gridcontainer en la página.');
            logErr('Asegúrate de que la página tiene la sección de Related Content del template.');
            return { success: false, logs, error: 'Gridcontainer not found' };
        }
        log('Gridcontainer encontrado: …' + gridcontainerPath.split('/').slice(-4).join('/'));
        // ── Step 2: Find existing gridcard children ────────────────────
        log('Buscando gridcards existentes…');
        let gcNode;
        try {
            gcNode = await fetch(gridcontainerPath + '.infinity.json', {
                headers: { 'CSRF-Token': token },
            }).then((r) => r.json());
        }
        catch (e) {
            throw new Error('No se pudo leer el gridcontainer: ' + e.message);
        }
        const existingCardKeys = Object.keys(gcNode)
            .filter((k) => k.startsWith('gridcard') && typeof gcNode[k] === 'object')
            .sort();
        log('Cards existentes: ' + existingCardKeys.length + ' (' + existingCardKeys.join(', ') + ')');
        // We need exactly 3 cards. If they exist, update them. If not, create them.
        const cardPaths = [];
        if (existingCardKeys.length >= 3) {
            // Use the first 3 existing cards
            for (let i = 0; i < 3; i++) {
                cardPaths.push(gridcontainerPath + '/' + existingCardKeys[i]);
            }
            log('Usando ' + 3 + ' cards existentes.');
        }
        else {
            // Use existing + create missing ones
            for (let i = 0; i < existingCardKeys.length; i++) {
                cardPaths.push(gridcontainerPath + '/' + existingCardKeys[i]);
            }
            for (let i = existingCardKeys.length; i < 3; i++) {
                const cardName = 'gridcard_rc_' + i;
                const cardPath = gridcontainerPath + '/' + cardName;
                log('Creando card: ' + cardName + '…');
                const createParams = new URLSearchParams();
                createParams.set('jcr:primaryType', 'nt:unstructured');
                createParams.set('sling:resourceType', GRIDCARD_TYPE);
                // Template defaults
                createParams.set('cardStyle', 'teaser');
                createParams.set('displayStyle', 'primaryProfile');
                createParams.set('linkType', 'page');
                createParams.set('linkTarget', '_self');
                createParams.set('bgColor', 'ms-bg-gray-50 ms-text-black');
                createParams.set('aspectRatio', 'adaptive');
                createParams.set('aspectRatioDesktop', '1/1');
                createParams.set('aspectRatioMobile', '1/1');
                createParams.set('assetType', 'image');
                createParams.set('hasMdColSpan', 'true');
                createParams.set('mdColSpan', '4');
                createParams.set('hasLgColSpan', 'true');
                createParams.set('lgColSpan', '4');
                createParams.set('statisticTitleSize', 'small');
                createParams.set('linkedListType', 'tags');
                createParams.set('linkedListTitleTarget', '_self');
                createParams.set('linkedListItemsUseReference', 'false');
                createParams.set('linkedListTitleDescriptionUseReference', 'false');
                createParams.set('linkedListTitleIcon', ' ');
                createParams.set('linkedListIcon', ' ');
                createParams.set('altTextTeaserAssetDamCheck', 'true');
                createParams.set('altTextGraphicAssetDamCheck', 'true');
                createParams.set('altTextDesktopAssetDamCheck', 'true');
                createParams.set('altTextMobileAssetDamCheck', 'true');
                createParams.set('pagePathTeaserCheck', 'false');
                createParams.set('textIsRich', '[true,true]');
                const res = await slingPost(cardPath, createParams);
                if (!res.ok) {
                    logErr('Error creando card ' + cardName + ': HTTP ' + res.status);
                    continue;
                }
                log('  Card creada ✓');
                cardPaths.push(cardPath);
            }
        }
        if (cardPaths.length < relatedItems.length) {
            logWarn('Solo hay ' + cardPaths.length + ' cards para ' + relatedItems.length + ' items.');
        }
        // ── Step 3: Populate each card ─────────────────────────────────
        log('\nInsertando contenido en ' + Math.min(cardPaths.length, relatedItems.length) + ' cards…');
        const updatedPaths = [];
        for (let i = 0; i < Math.min(3, relatedItems.length, cardPaths.length); i++) {
            const item = relatedItems[i];
            const cardPath = cardPaths[i];
            const cardName = cardPath.split('/').pop();
            log('\n━━ Card ' + (i + 1) + ' (' + cardName + ') ━━');
            log('  Título: ' + (item.title || '(sin título)'));
            log('  CTA: ' + (item.ctaLabel || 'Learn more'));
            log('  Link: ' + (item.ctaLink || '(sin link)'));
            const params = new URLSearchParams();
            // Content properties
            params.set('teaserTitle', (item.title || '').replace(/\s*\|\s*MSCI.*$/i, ''));
            params.set('ctaLink', item.ctaLink || '');
            params.set('ctaLabel', item.ctaLabel || 'Learn more');
            params.set('variant', 'tertiary');
            params.set('pagePathTeaserCheck', 'false');
            params.set('centerAlignContent', 'false');
            params.set('removeLeftMargin', 'false');
            params.set('removeRightMargin', 'false');
            // RTE description — 3 props required for rendering without Done
            const desc = (item.description || '').trim();
            if (desc) {
                const SPAN_CLASS = 'ms-body-l-sm lg:ms-body-l-lg ms-font-regular';
                // 1. teaserDescription — plain HTML
                const teaserDescription = '<p>' + desc + '</p>\r\n';
                // 2. derivedDomTeaser — HTML with styled spans
                const derivedDomTeaser = '<p><span class="' + SPAN_CLASS + '">' + desc + '</span></p>\r\n';
                // 3. textAsJsonForTeaser — JSON AST
                const textAsJsonForTeaser = JSON.stringify({
                    root: {
                        children: [
                            {
                                tag: 'P',
                                className: '',
                                tailwindStyles: '',
                                typography: '',
                                color: '',
                                children: [
                                    {
                                        tag: 'SPAN',
                                        className: SPAN_CLASS,
                                        tailwindStyles: SPAN_CLASS,
                                        typography: 'body-l',
                                        children: [
                                            { tag: 'text', textContent: desc },
                                        ],
                                    },
                                ],
                                id: '',
                            },
                            { tag: 'text', textContent: '\n' },
                        ],
                    },
                });
                params.set('teaserDescription', teaserDescription);
                params.set('derivedDomTeaser', derivedDomTeaser);
                params.set('textAsJsonForTeaser', textAsJsonForTeaser);
            }
            const res = await slingPost(cardPath, params);
            if (res.ok) {
                log('  ✅ Card actualizada');
                updatedPaths.push(cardPath);
            }
            else {
                logErr('  ❌ Error HTTP ' + res.status);
            }
        }
        // ── Step 4: Verify ─────────────────────────────────────────────
        log('\n━━ Verificación ━━');
        try {
            const verifyNode = await fetch(gridcontainerPath + '.infinity.json', {
                headers: { 'CSRF-Token': token },
            }).then((r) => r.json());
            const verifyCards = Object.keys(verifyNode)
                .filter((k) => k.startsWith('gridcard') && typeof verifyNode[k] === 'object')
                .sort();
            for (const ck of verifyCards) {
                const card = verifyNode[ck];
                const title = card.teaserTitle || '(vacío)';
                const link = card.ctaLink || '(sin link)';
                const cta = card.ctaLabel || '(sin CTA)';
                log('  ' + ck + ': "' + title + '" → ' + cta + ' [' + link.split('/').pop() + ']');
            }
            console.log('[RelatedContent] verification:', verifyNode);
        }
        catch (e) {
            logWarn('Error en verificación: ' + e.message);
        }
        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('✅ ' + updatedPaths.length + ' card(s) de related content insertadas.');
        return { success: true, logs, updatedPaths, gridcontainerPath };
    }
    catch (err) {
        console.error('[RelatedContent] fatal', err);
        logErr('Error: ' + err.message);
        return { success: false, logs, error: err.message };
    }
    finally {
        console.groupEnd();
    }
}

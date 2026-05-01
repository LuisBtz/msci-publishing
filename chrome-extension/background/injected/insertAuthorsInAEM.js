/**
 * insertAuthorsInAEM (INJECTED)
 *
 * Creates the author Content Fragment structure inside the page's
 * existing container_4 (the author section wrapper that comes from
 * the research-page2 template).
 *
 * Structure created per pair of authors:
 *   container_4/node0/cf_container_N  [container v2, 2 cols]
 *     ├─ node0 [responsivegrid] → contentfragment_0  (author left)
 *     └─ node1 [responsivegrid] → contentfragment_1  (author right)
 *
 * Content Fragment properties (from sibling probe):
 *   fragmentPath, displayMode=multi, paragraphScope=all,
 *   variationName=master, displayStyle=authorProfile
 *
 * SELF-CONTAINED: serialized into the page — no imports / closures.
 */
export async function insertAuthorsInAEM(slug, authorPaths) {
    const logs = [];
    const log = (m) => logs.push({ type: 'log', message: m });
    const logErr = (m) => logs.push({ type: 'error', message: m });
    const logWarn = (m) => logs.push({ type: 'warn', message: m });
    console.groupCollapsed('[Authors] insert into ' + slug);
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
        // ── Step 1: Find container_4 ────────────────────────────────────
        log('Buscando el contenedor de autores (container_4)…');
        const pageTree = await fetch(jcrContent + '.infinity.json', {
            headers: { 'CSRF-Token': token },
        }).then((r) => r.json());
        if (!pageTree)
            throw new Error('No se pudo leer la página');
        // Walk the tree to find the author section container.
        // It's typically container_4 directly under root/main, but we search
        // for any container v2 that sits at the right level and does NOT
        // already contain body content (RTEs, images, vegaEmbedChart).
        const CONTAINER_TYPE = 'webmasters-aem/components/container/v2/container';
        const CF_TYPE = 'webmasters-aem/components/contentfragment';
        // Strategy: Look for container_4 first (most common), then fall back
        // to scanning for a container that already holds content fragments
        // or is empty and sits after the body section.
        let authorGridPath = null;
        // Direct lookup: root/main/container_4/node0
        const rootMain = pageTree.root && pageTree.root.main;
        if (rootMain) {
            // Try container_4 first (most common in siblings)
            for (const candidateName of ['container_4', 'container_5', 'container_3']) {
                const candidate = rootMain[candidateName];
                if (candidate && (candidate['sling:resourceType'] || '') === CONTAINER_TYPE) {
                    const grid = candidate.node0;
                    if (grid) {
                        authorGridPath = jcrContent + '/root/main/' + candidateName + '/node0';
                        log('Encontrado: ' + candidateName + '/node0');
                        break;
                    }
                }
            }
        }
        // Fallback: walk the tree looking for containers that hold CFs
        if (!authorGridPath) {
            log('container_4 no encontrado directamente, buscando por Content Fragments existentes…');
            function findCFParentGrid(node, path) {
                if (!node || typeof node !== 'object')
                    return null;
                const resType = node['sling:resourceType'] || '';
                if (resType === CF_TYPE) {
                    // Found a CF — the author grid is 2 levels up (cf → responsivegrid → 2col container → responsivegrid)
                    // We want the responsivegrid that contains the 2-col containers
                    return null; // will be handled by parent
                }
                if (resType === CONTAINER_TYPE && String(node.numOfColumns) === '2') {
                    // This is a 2-col container with CFs inside — the parent grid is what we want
                    return path.substring(0, path.lastIndexOf('/'));
                }
                for (const [k, v] of Object.entries(node)) {
                    if (k.startsWith('jcr:') || k.startsWith('sling:') || k.startsWith('cq:') || k.startsWith(':'))
                        continue;
                    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                        const found = findCFParentGrid(v, path + '/' + k);
                        if (found)
                            return found;
                    }
                }
                return null;
            }
            authorGridPath = findCFParentGrid(pageTree, jcrContent);
            if (authorGridPath) {
                log('Encontrado grid de autores existente: …' + authorGridPath.split('/').slice(-4).join('/'));
            }
        }
        if (!authorGridPath) {
            logErr('No se encontró el contenedor de autores en la página.');
            logErr('Asegúrate de que la página fue creada con el template research-page2.');
            return { success: false, logs, error: 'Author container not found' };
        }
        console.log('[Authors] author grid path:', authorGridPath);
        // ── Step 2: Clean up existing CF containers ─────────────────────
        // Check if there are already cf_container_* nodes and remove them
        log('Verificando contenedores existentes…');
        let gridNode;
        try {
            gridNode = await fetch(authorGridPath + '.2.json', {
                headers: { 'CSRF-Token': token },
            }).then((r) => r.json());
        }
        catch (e) {
            gridNode = {};
        }
        const existingCfContainers = Object.keys(gridNode).filter((k) => k.startsWith('cf_container') && typeof gridNode[k] === 'object');
        if (existingCfContainers.length > 0) {
            log('Eliminando ' + existingCfContainers.length + ' contenedor(es) de autores existente(s)…');
            for (const name of existingCfContainers) {
                const delRes = await slingPost(authorGridPath + '/' + name, new URLSearchParams({ ':operation': 'delete' }));
                if (delRes.ok)
                    log('  Eliminado: ' + name + ' ✓');
                else
                    logWarn('  No se pudo eliminar ' + name + ': HTTP ' + delRes.status);
            }
        }
        // ── Step 3: Create 2-col containers with Content Fragments ──────
        const pairs = [];
        for (let i = 0; i < authorPaths.length; i += 2) {
            pairs.push(authorPaths.slice(i, i + 2));
        }
        log('\n' + authorPaths.length + ' autor(es) → ' + pairs.length + ' fila(s) de 2 columnas');
        const createdPaths = [];
        for (let pairIdx = 0; pairIdx < pairs.length; pairIdx++) {
            const pair = pairs[pairIdx];
            const containerName = 'cf_container_' + (pairIdx * 2);
            const containerPath = authorGridPath + '/' + containerName;
            log('\n━━ Fila ' + (pairIdx + 1) + '/' + pairs.length + ' (' + containerName + ') ━━');
            // 3a. Create the 2-column Theme Container v2
            log('Creando contenedor de 2 columnas…');
            const containerParams = new URLSearchParams();
            containerParams.set('jcr:primaryType', 'nt:unstructured');
            containerParams.set('sling:resourceType', CONTAINER_TYPE);
            containerParams.set('numOfColumns', '2');
            containerParams.set('theme', 'inherit');
            containerParams.set('defaultMargin', '0');
            containerParams.set('defaultRowGap', '1');
            containerParams.set('mediumMargin', 'md:0');
            containerParams.set('largeMargin', 'lg:0');
            containerParams.set('mediumRowGap', 'md:1');
            containerParams.set('largeRowGap', 'lg:1');
            containerParams.set('hasMediumMargins', 'false');
            containerParams.set('hasLargeMargins', 'false');
            containerParams.set('hasRowGap', 'false');
            containerParams.set('hasMediumRowGap', 'false');
            containerParams.set('hasLargeRowGap', 'false');
            let res = await slingPost(containerPath, containerParams);
            if (!res.ok && res.status !== 200 && res.status !== 201) {
                logErr('  Error creando contenedor: HTTP ' + res.status);
                continue;
            }
            log('  Contenedor creado ✓');
            // 3b. Ensure node0 and node1 (responsivegrid) exist
            for (let colIdx = 0; colIdx < 2; colIdx++) {
                if (colIdx >= pair.length)
                    break; // odd author count, skip node1
                const gridName = 'node' + colIdx;
                const gridPath = containerPath + '/' + gridName;
                // Check if AEM auto-created it
                let gridExists = false;
                try {
                    const checkRes = await fetch(gridPath + '.json', { headers: { 'CSRF-Token': token } });
                    if (checkRes.ok) {
                        const node = await checkRes.json();
                        gridExists = (node['sling:resourceType'] || '').includes('responsivegrid');
                    }
                }
                catch (e) { /* not found */ }
                if (!gridExists) {
                    const gridParams = new URLSearchParams();
                    gridParams.set('jcr:primaryType', 'nt:unstructured');
                    gridParams.set('sling:resourceType', 'wcm/foundation/components/responsivegrid');
                    res = await slingPost(gridPath, gridParams);
                    if (!res.ok && res.status !== 200 && res.status !== 201) {
                        logErr('  Error creando ' + gridName + ': HTTP ' + res.status);
                        continue;
                    }
                    log('  ' + gridName + ' creado ✓');
                }
                else {
                    log('  ' + gridName + ' ya existía ✓');
                }
                // 3c. Create the Content Fragment inside this grid
                const cfName = 'contentfragment_' + colIdx;
                const cfPath = gridPath + '/' + cfName;
                const authorPath = pair[colIdx];
                const authorSlug = authorPath.split('/').pop();
                log('  Insertando CF: ' + authorSlug + '…');
                const cfParams = new URLSearchParams();
                cfParams.set('jcr:primaryType', 'nt:unstructured');
                cfParams.set('sling:resourceType', CF_TYPE);
                cfParams.set('fragmentPath', authorPath);
                cfParams.set('displayMode', 'multi');
                cfParams.set('paragraphScope', 'all');
                cfParams.set('variationName', 'master');
                cfParams.set('displayStyle', 'authorProfile');
                res = await slingPost(cfPath, cfParams);
                if (res.ok) {
                    log('  ✅ ' + cfName + ' → ' + authorSlug);
                }
                else {
                    logErr('  ❌ ' + cfName + ': HTTP ' + res.status);
                }
            }
            createdPaths.push(containerPath);
        }
        // ── Step 4: Verify ──────────────────────────────────────────────
        log('\n━━ Verificación ━━');
        try {
            const verifyRes = await fetch(authorGridPath + '.infinity.json', {
                headers: { 'CSRF-Token': token },
            });
            if (verifyRes.ok) {
                const tree = await verifyRes.json();
                const cfContainers = Object.keys(tree).filter((k) => k.startsWith('cf_container') && typeof tree[k] === 'object');
                log('Contenedores de autores: ' + cfContainers.length);
                let totalCFs = 0;
                for (const name of cfContainers) {
                    const container = tree[name];
                    for (const nodeName of ['node0', 'node1']) {
                        const grid = container[nodeName];
                        if (!grid)
                            continue;
                        const cfs = Object.keys(grid).filter((k) => k.startsWith('contentfragment') && typeof grid[k] === 'object');
                        for (const cfKey of cfs) {
                            const cf = grid[cfKey];
                            const fp = cf.fragmentPath || '(sin fragmentPath)';
                            log('  ' + name + '/' + nodeName + '/' + cfKey + ' → ' + fp.split('/').pop());
                            totalCFs++;
                        }
                    }
                }
                log('Total Content Fragments: ' + totalCFs + '/' + authorPaths.length);
                console.log('[Authors] verification tree:', tree);
            }
        }
        catch (e) {
            logWarn('Error en verificación: ' + e.message);
        }
        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('✅ ' + createdPaths.length + ' fila(s) de autores insertadas.');
        log('Refrescando editor…');
        return { success: true, logs, createdPaths, authorGridPath };
    }
    catch (err) {
        console.error('[Authors] fatal', err);
        logErr('Error: ' + err.message);
        return { success: false, logs, error: err.message };
    }
    finally {
        console.groupEnd();
    }
}

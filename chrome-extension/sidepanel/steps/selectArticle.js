/**
 * selectArticle
 *
 * When the user clicks an article card on step 1 we run two parallel
 * checks against AEM (DAM folder + page existence) and store the
 * results on the article object. Then we always go to step 2 (Process)
 * where the orchestrator uses these results to handle conflicts.
 */
import { setSelectedArticle, resetSessionSets } from '../state.js';
import { sendBackground } from '../api/background.js';
import { showValidationOverlay, hideValidationOverlay } from '../ui/validationOverlay.js';
import { goToStep } from './navigation.js';
export async function selectArticle(article) {
    setSelectedArticle(article);
    // Reset per-article session state.
    resetSessionSets();
    delete article._damCheck;
    delete article._pageCheck;
    showValidationOverlay('Checking AEM status...');
    try {
        const [damCheck, pageCheck] = await Promise.all([
            sendBackground({ type: 'CHECK_DAM_ASSETS', slug: article.slug }),
            sendBackground({ type: 'CHECK_PAGE_EXISTS', slug: article.slug }),
        ]);
        article._damCheck = damCheck || { success: false };
        article._pageCheck = pageCheck || { success: false };
    }
    catch (e) {
        article._damCheck = { success: false, error: e.message };
        article._pageCheck = { success: false, error: e.message };
    }
    finally {
        hideValidationOverlay();
    }
    // Always go to step 2 (Process) — the orchestrator handles conflicts
    goToStep(2);
}

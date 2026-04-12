/**
 * selectArticle
 *
 * When the user clicks an article card on step 1 we run two parallel
 * checks against AEM to decide which step to land on:
 *
 *   1. Are the assets already in the DAM?   → skip step 2
 *   2. Does the AEM page already exist?     → skip step 3
 *
 * The check results are stored on the article object so the step
 * populators can render the "already done" validation cards.
 */
import { state, setSelectedArticle, resetSessionSets } from '../state.js'
import { sendBackground } from '../api/background.js'
import { showValidationOverlay, hideValidationOverlay } from '../ui/validationOverlay.js'
import { goToStep } from './navigation.js'

export async function selectArticle(article) {
  setSelectedArticle(article)

  // Reset per-article session state.
  resetSessionSets()
  delete article._damCheck
  delete article._pageCheck

  showValidationOverlay('Validando estado en AEM…')
  try {
    const [damCheck, pageCheck] = await Promise.all([
      sendBackground({ type: 'CHECK_DAM_ASSETS', slug: article.slug }),
      sendBackground({ type: 'CHECK_PAGE_EXISTS', slug: article.slug }),
    ])
    article._damCheck = damCheck || { success: false }
    article._pageCheck = pageCheck || { success: false }
  } catch (e) {
    article._damCheck = { success: false, error: e.message }
    article._pageCheck = { success: false, error: e.message }
  } finally {
    hideValidationOverlay()
  }

  // Deepest reachable step — only skip when we positively verified
  // the prerequisite is already done.
  let target = 2
  if (article._damCheck?.exists) {
    state.completedSteps.add(2)
    target = 3
  }
  if (article._damCheck?.exists && article._pageCheck?.exists) {
    state.completedSteps.add(3)
    target = 4
  }

  goToStep(target)
}

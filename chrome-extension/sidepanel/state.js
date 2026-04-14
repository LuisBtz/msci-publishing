/**
 * Side panel shared state
 *
 * Module-singleton holding everything that lives for a side-panel
 * session: the loaded articles, the currently selected one, the
 * active step, the filter, and three Sets that track the wizard's
 * per-article navigation.
 *
 *   - completedSteps    steps marked "done" via success or validation
 *   - visitedSteps      steps the user has opened during this session
 *                       (clickable via the step indicator)
 *   - initializedSteps  steps where populateStepX() already ran, so
 *                       back/forward doesn't wipe the DOM state
 *
 * All side-panel modules import from here rather than passing state
 * around, matching the legacy single-file behavior.
 */
export const state = {
  articles: [],
  selectedArticle: null,
  currentStep: 1,
  currentFilter: 'all',
  completedSteps: new Set(),
  visitedSteps: new Set([1]),
  initializedSteps: new Set(),
  /** Global process logs keyed by section */
  processLogs: {
    assets: [],
    page: [],
    keyFindings: [],
    bodyContent: [],
    authors: [],
    relatedContent: [],
    footnotes: [],
    cleanup: [],
  },
  /** Final publish report object (saved to Supabase) */
  processReport: null,
}

export function setArticles(next) {
  state.articles = next
}

export function setSelectedArticle(a) {
  state.selectedArticle = a
}

export function setCurrentStep(n) {
  state.currentStep = n
}

export function setCurrentFilter(f) {
  state.currentFilter = f
}

export function resetSessionSets() {
  state.completedSteps.clear()
  state.initializedSteps.clear()
  state.visitedSteps.clear()
  state.visitedSteps.add(1)
  resetProcessState()
}

export function resetProcessState() {
  state.processLogs = {
    assets: [],
    page: [],
    keyFindings: [],
    bodyContent: [],
    authors: [],
    relatedContent: [],
    footnotes: [],
    cleanup: [],
  }
  state.processReport = null
}

export function setProcessReport(report) {
  state.processReport = report
}

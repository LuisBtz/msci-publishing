/**
 * Step navigation
 *
 * Three-step wizard: Select → Process → Report
 *
 *   - goToStep: switches the active step content, updates the step
 *     indicator classes and calls the right populateStepX() once per
 *     session (so back/forward preserves DOM state).
 *   - refreshStepBar: recomputes the indicator classes without
 *     changing the active step.
 *   - handleStepIndicatorClick: lets the user jump freely between
 *     visited/completed steps; clicking step 1 resets the session.
 */
import { state, setCurrentStep, setSelectedArticle, resetSessionSets } from '../state.js'
import { populateStep2 } from './step2Process.js'
import { populateStep3 } from './step3Report.js'

export function goToStep(step) {
  setCurrentStep(step)
  state.visitedSteps.add(step)

  document.querySelectorAll('#steps-bar .step').forEach((el) => {
    const s = parseInt((el as HTMLElement).dataset.step)
    el.classList.toggle('active', s === step)
    el.classList.toggle('completed', state.completedSteps.has(s) && s !== step)
    const reachable = s === 1 || state.visitedSteps.has(s) || state.completedSteps.has(s)
    el.classList.toggle('clickable', reachable)
  })

  document.querySelectorAll('.step-content').forEach((el) => {
    el.classList.toggle('active', el.id === `step-${step}`)
  })

  if (!state.initializedSteps.has(step)) {
    state.initializedSteps.add(step)
    if (step === 2) populateStep2()
    if (step === 3) populateStep3()
  }
}

export function refreshStepBar() {
  document.querySelectorAll('#steps-bar .step').forEach((el) => {
    const s = parseInt((el as HTMLElement).dataset.step)
    el.classList.toggle('active', s === state.currentStep)
    el.classList.toggle('completed', state.completedSteps.has(s) && s !== state.currentStep)
    const reachable = s === 1 || state.visitedSteps.has(s) || state.completedSteps.has(s)
    el.classList.toggle('clickable', reachable)
  })
}

export function handleStepIndicatorClick(stepEl: HTMLElement) {
  const s = parseInt(stepEl.dataset.step)
  if (!stepEl.classList.contains('clickable')) return
  if (s === state.currentStep) return
  if (s === 1) {
    // Back to article selection — clear per-article session state.
    setSelectedArticle(null)
    resetSessionSets()
    goToStep(1)
    return
  }
  goToStep(s)
}

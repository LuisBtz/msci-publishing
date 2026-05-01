/**
 * Sidepanel entry
 *
 * Bootstraps the Chrome extension side panel: loads the article list,
 * starts the AEM connection heartbeat, and wires the three-step wizard
 * (Select → Process → Report).
 *
 * All business logic lives in the step modules and api/ helpers —
 * this file is pure event-listener plumbing.
 */
import { state } from './state.js';
import { loadArticles } from './api/supabase.js';
import { checkAEMConnection } from './api/background.js';
import { renderArticles } from './ui/articleList.js';
import { goToStep, handleStepIndicatorClick } from './steps/navigation.js';
import { startProcess } from './steps/step2Process.js';
import { toggleGlobalLog } from './ui/globalLog.js';
import { loadAemEnv, setAemEnv } from './config.js';
function paintEnvToggle(env) {
    document.querySelectorAll('#aem-env-toggle .env-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.env === env);
    });
}
document.addEventListener('DOMContentLoaded', async () => {
    // Env must be loaded before any code reads AEM_HOST.
    const env = await loadAemEnv();
    paintEnvToggle(env);
    loadArticles();
    checkAEMConnection();
    setInterval(checkAEMConnection, 10000);
    // Env toggle
    document.querySelectorAll('#aem-env-toggle .env-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const next = btn.dataset.env;
            await setAemEnv(next);
            paintEnvToggle(next);
        });
    });
    // Refresh articles list
    document.getElementById('btn-refresh').addEventListener('click', loadArticles);
    // Search
    document.getElementById('search-input').addEventListener('input', renderArticles);
    // Filter chips
    document.querySelectorAll('.chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
            chip.classList.add('active');
            state.currentFilter = chip.dataset.filter;
            renderArticles();
        });
    });
    // Back buttons
    document
        .getElementById('btn-back-2')
        .addEventListener('click', () => handleStepIndicatorClick(document.querySelector('#steps-bar .step[data-step="1"]')));
    document.getElementById('btn-back-3').addEventListener('click', () => goToStep(2));
    // Step indicator clicks
    document.querySelectorAll('#steps-bar .step').forEach((el) => {
        el.addEventListener('click', () => handleStepIndicatorClick(el));
    });
    // Step 2: Start automated process
    document.getElementById('btn-start-process').addEventListener('click', startProcess);
    // Global log toggle
    document.getElementById('global-log-toggle').addEventListener('click', toggleGlobalLog);
});

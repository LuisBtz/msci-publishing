/**
 * Service worker entry for the MSCI AEM Publisher extension.
 *
 * The side panel sends structured publish / create / check requests
 * via chrome.runtime.sendMessage; each handler in messageHandlers.js
 * dispatches the corresponding injected function into the active
 * AEM Author tab via chrome.scripting. Running inside the tab means
 * every fetch uses the user's AEM session cookies.
 *
 * This file only wires up the panel behavior and the onMessage
 * router — all the actual work lives in the other modules.
 */
import { handleMessage } from './messageHandlers.js';
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
chrome.runtime.onMessage.addListener(handleMessage);

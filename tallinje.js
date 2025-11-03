import { createAppHost } from '@math-visuals/core';
import tallinjeApp from './apps/tallinje/app.js';

const globalScope = typeof window !== 'undefined' ? window : undefined;
const documentRef = globalScope ? globalScope.document : undefined;

function resolveMountTarget() {
  if (!documentRef) return null;
  return (
    documentRef.querySelector('[data-math-visual-app-root="tallinje"]') ||
    documentRef.getElementById('numberLineSvg')?.closest('.wrap') ||
    documentRef.querySelector('.wrap') ||
    documentRef.body ||
    documentRef.documentElement ||
    null
  );
}

const host = createAppHost({
  onError(error) {
    if (globalScope && globalScope.console && typeof globalScope.console.error === 'function') {
      globalScope.console.error('[Tallinje] Uventet feil i app-host', error);
    }
  }
});

/** @type {(() => void)[]} */
const hostCleanupFns = [];
let mountedApp = null;
let legacyBridgeInitialized = false;

function registerHostCleanup(fn) {
  if (typeof fn === 'function') {
    hostCleanupFns.push(fn);
  }
}

function teardownMountedApp() {
  if (!mountedApp) return;
  try {
    mountedApp.teardown();
  } catch (error) {
    if (globalScope && globalScope.console && typeof globalScope.console.error === 'function') {
      globalScope.console.error('[Tallinje] Feil under nedbygging av app', error);
    }
  }
  mountedApp = null;
}

function ensureLegacyBridge() {
  if (!globalScope || legacyBridgeInitialized) return;
  legacyBridgeInitialized = true;

  const unsubscribeMode = host.bus.on('app-mode-changed', detail => {
    if (!detail || typeof globalScope.dispatchEvent !== 'function') return;
    try {
      globalScope.dispatchEvent(new CustomEvent('math-visuals:app-mode-changed', { detail }));
    } catch (error) {
      // Ignorer feil fra gamle lyttere
    }
  });
  registerHostCleanup(() => {
    unsubscribeMode();
    legacyBridgeInitialized = false;
  });

  if (typeof globalScope.addEventListener === 'function') {
    const handleBeforeUnload = () => runHostCleanup();
    globalScope.addEventListener('beforeunload', handleBeforeUnload, { once: true });
    registerHostCleanup(() => {
      globalScope.removeEventListener('beforeunload', handleBeforeUnload);
    });
  }
}

function mountTallinjeApp() {
  ensureLegacyBridge();
  const target = resolveMountTarget();
  if (!target) {
    if (globalScope && globalScope.console && typeof globalScope.console.warn === 'function') {
      globalScope.console.warn('[Tallinje] Fant ikke et mål for å montere appen.');
    }
    return null;
  }
  teardownMountedApp();
  mountedApp = host.mount(tallinjeApp, { target });
  return mountedApp;
}

function runHostCleanup() {
  teardownMountedApp();
  while (hostCleanupFns.length) {
    const fn = hostCleanupFns.pop();
    try {
      fn();
    } catch (error) {
      if (globalScope && globalScope.console && typeof globalScope.console.error === 'function') {
        globalScope.console.error('[Tallinje] Feil under opprydding', error);
      }
    }
  }
}

mountedApp = mountTallinjeApp();

if (globalScope) {
  const mathVisuals =
    globalScope.mathVisuals && typeof globalScope.mathVisuals === 'object'
      ? globalScope.mathVisuals
      : (globalScope.mathVisuals = {});

  mathVisuals.tallinjeHost = {
    mount: mountTallinjeApp,
    update(payload) {
      if (mountedApp && typeof mountedApp.update === 'function') {
        mountedApp.update(payload);
      }
    },
    teardown: runHostCleanup,
    bus: host.bus
  };
}

import { localAuth } from './auth/session';

const root = document.querySelector<HTMLElement>('#app');

function isStudioRoute(): boolean {
  return location.hash === '#/app' || location.hash.startsWith('#/app?');
}

/** The studio is private: only a Clerk-backed profile can open it. */
function hasStudioAccess(): boolean {
  return localAuth.active()?.provider === 'clerk';
}

function showBootError(error: unknown): void {
  console.error(error);
  if (!root) return;
  root.innerHTML = `
    <main class="boot-error">
      <h1>ShotInClean could not load.</h1>
      <p>The page failed to start. A refresh usually fixes a stale build.</p>
      <button type="button" onclick="location.reload()">Reload the page</button>
    </main>`;
}

if (root) {
  const studio = isStudioRoute();
  document.documentElement.dataset.route = studio ? 'studio' : 'landing';

  if (studio && !hasStudioAccess()) {
    try {
      sessionStorage.setItem('shotinclean.studioGate', '1');
    } catch {
      // The landing page still shows the sign-in card if storage is blocked.
    }
    location.replace(`${location.pathname}#account`);
  } else if (studio) {
    document.title = 'ShotInClean Studio';
    void import('./studio')
      .then(({ bootStudio }) => bootStudio(root))
      .catch(showBootError);
  } else {
    document.title = 'ShotInClean - screenshots and screen recordings, in your browser';
    void import('./landing/landing')
      .then(({ bootLanding }) => bootLanding(root))
      .catch(showBootError);
  }

  addEventListener('hashchange', () => {
    const nextStudio = isStudioRoute();
    if (nextStudio !== studio) location.reload();
  });
}

// Touch the local profile once per visit without writing on every render.
const profile = localAuth.active();
if (profile) localAuth.touch();

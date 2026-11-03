/**
 * "The session ended" signal (expiry, logout elsewhere, revocation). The Apollo error link raises it;
 * one listener in the providers clears the cache and opens /login. A browser event keeps the Apollo
 * client free of React and router references.
 */
const SESSION_ENDED = 'pos:session-ended';

export function notifySessionEnded(): void {
  window.dispatchEvent(new Event(SESSION_ENDED));
}

export function onSessionEnded(listener: () => void): () => void {
  window.addEventListener(SESSION_ENDED, listener);
  return () => {
    window.removeEventListener(SESSION_ENDED, listener);
  };
}

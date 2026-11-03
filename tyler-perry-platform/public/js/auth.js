/* Auth helpers — DEMO ONLY. No real authentication in this phase. */
(function() {
  'use strict';
  window.TP_AUTH = {
    isLoggedIn() { return false; },
    login() { console.warn('Demo only — authentication is not implemented.'); },
    logout() { console.warn('Demo only — authentication is not implemented.'); }
  };
})();
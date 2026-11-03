/* Auditions — DEMO ONLY. Sample data, no real applications accepted. */
(function() {
  'use strict';
  const DEMO = [
    { id: 'a1', title: 'On-Camera Auditions', tag: 'Demonstration', desc: 'Sample listing. No real audition is offered.' },
    { id: 'a2', title: 'Production Crew', tag: 'Demonstration', desc: 'Placeholder crew listing.' },
    { id: 'a3', title: 'Writing & Development', tag: 'Demonstration', desc: 'Placeholder writing opportunity.' }
  ];
  window.TP_AUDITIONS = { load() { return Promise.resolve(DEMO); } };
})();
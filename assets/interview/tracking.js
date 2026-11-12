(function () {
  'use strict';
  function send(name, values) {
    if (location.hostname !== 'texter.work' || typeof window.gtag !== 'function') return;
    window.gtag('event', name, Object.assign({ lp_language: document.documentElement.lang }, values || {}));
  }

  send('interview_lp_view');
  document.querySelectorAll('a[data-store]').forEach(function (link) {
    function record(event) {
      if (event.type === 'auxclick' && event.button !== 1) return;
      send('interview_store_click', { store: link.dataset.store, cta_location: link.dataset.location });
    }
    link.addEventListener('click', record);
    link.addEventListener('auxclick', record);
  });

  document.addEventListener('texter:interview-demo', function (event) {
    var item = event.detail;
    if (!item || !['question', 'source', 'audio'].includes(item.action) ||
        !['budget', 'change', 'access'].includes(item.question) || !['none', 'first', 'second', 'third'].includes(item.source)) return;
    send('interview_demo_action', { demo_action: item.action, question_id: item.question, source_id: item.source });
  });

  if (!('IntersectionObserver' in window)) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      send(entry.target.id === 'pricing' ? 'interview_pricing_view' : 'interview_demo_view');
      observer.unobserve(entry.target);
    });
  // Fire once the top quarter of the viewport has been passed. A ratio threshold never fires on sections
  // taller than several screens, so the trigger is a margin instead.
  }, { threshold: 0, rootMargin: '0px 0px -25% 0px' });
  ['pricing', 'interview-demo'].forEach(function (id) {
    var section = document.getElementById(id);
    if (section) observer.observe(section);
  });
})();

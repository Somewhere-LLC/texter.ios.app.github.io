(function () {
  'use strict';
  function send(name, values) {
    if (location.hostname !== 'texter.work' || typeof window.gtag !== 'function') return;
    window.gtag('event', name, values || {});
  }

  send('hearing_lp_view');
  document.querySelectorAll('a[data-store]').forEach(function (link) {
    function record(event) {
      if (event.type === 'auxclick' && event.button !== 1) return;
      send('hearing_store_click', { store: link.dataset.store, cta_location: link.dataset.location });
    }
    link.addEventListener('click', record);
    link.addEventListener('auxclick', record);
  });

  document.querySelectorAll('a[data-contact]').forEach(function (link) {
    link.addEventListener('click', function () {
      send('hearing_contact_click', { contact_type: link.dataset.contact });
    });
  });

  if (!('IntersectionObserver' in window)) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.15) return;
      send(entry.target.id === 'pricing' ? 'hearing_pricing_view' : 'hearing_contact_view');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  ['pricing', 'contact'].forEach(function (id) {
    var section = document.getElementById(id);
    if (section) observer.observe(section);
  });
})();

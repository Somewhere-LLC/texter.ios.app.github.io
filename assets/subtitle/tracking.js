(function () {
  'use strict';
  function send(name, values) {
    if (location.hostname !== 'texter.work' || typeof window.gtag !== 'function') return;
    window.gtag('event', name, values || {});
  }

  send('subtitle_lp_view');
  document.querySelectorAll('a[data-store]').forEach(function (link) {
    function record(event) {
      if (event.type === 'auxclick' && event.button !== 1) return;
      send('subtitle_store_click', { store: link.dataset.store, cta_location: link.dataset.location });
    }
    link.addEventListener('click', record);
    link.addEventListener('auxclick', record);
  });

  // One event per sample per page view: the first time a visitor starts each video.
  document.querySelectorAll('video[data-sample]').forEach(function (video) {
    video.addEventListener('play', function () {
      send('subtitle_sample_play', { sample_id: video.dataset.sample });
    }, { once: true });
  });

  if (!('IntersectionObserver' in window)) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.15) return;
      send(entry.target.id === 'pricing' ? 'subtitle_pricing_view' : 'subtitle_sample_view');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  ['pricing', 'sample'].forEach(function (id) {
    var section = document.getElementById(id);
    if (section) observer.observe(section);
  });
})();

/* Fixed, fictional examples. No AI request or visitor audio is sent from this demo. */
(function () {
  'use strict';
  var demo = document.getElementById('interview-demo');
  if (!demo) return;
  var sources = {
    first: { date: '9月3日', iso: '2026-09-03', title: '第1回取材', quote: '予算は50万円を想定しています。' },
    second: { date: '10月1日', iso: '2026-10-01', title: '第2回取材', quote: 'まず30万円で試作し、読者の反応を見ます。' },
    third: { date: '11月5日', iso: '2026-11-05', title: '第3回取材', quote: '文字の大きさや読みやすさを整え、読者が使い続けられることを優先しています。' }
  };
  var examples = {
    budget: { answer: '初回は50万円を想定していましたが、2回目の取材では、まず30万円の試作から始める方針に変わっています。', sources: ['first', 'second'] },
    change: { answer: '初回は早く公開することを優先していました。3回目には、公開の速さだけでなく、読みやすさを整え、読者が使い続けられることを優先すると話しています。', sources: ['first', 'third'], quotes: { first: '最初は早く公開することを優先したいですね。' } },
    access: { answer: '2回目は、記事の文字を大きくして読みやすさを確かめたいと話しています。3回目にも、文字の大きさや読みやすさを整えることに触れています。', sources: ['second', 'third'], quotes: { second: '記事の文字を大きくして、読みやすさも確かめたいです。' } }
  };
  var selected = 'budget';
  var answer = document.getElementById('answer-text');
  var sourceList = document.getElementById('answer-sources');
  var buttons = demo.querySelectorAll('[data-question]');

  function announce(action, source) {
    demo.dispatchEvent(new CustomEvent('texter:interview-demo', {
      bubbles: true, detail: { action: action, question: selected, source: source || 'none' }
    }));
  }

  function sourceCard(id) {
    var item = sources[id];
    var link = document.createElement('a');
    link.className = 'source-card';
    link.href = '#source-' + id;
    link.dataset.source = id;
    var meta = document.createElement('span');
    var date = document.createElement('time');
    date.dateTime = item.iso;
    date.textContent = item.date;
    meta.append(date, ' · ' + item.title);
    var quote = document.createElement('q');
    quote.textContent = (examples[selected].quotes || {})[id] || item.quote;
    var action = document.createElement('span');
    action.className = 'source-action';
    action.textContent = '発言を開く ↗';
    link.append(meta, quote, action);
    return link;
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      selected = button.dataset.question;
      var example = examples[selected];
      if (!example) return;
      buttons.forEach(function (item) { item.setAttribute('aria-pressed', String(item === button)); });
      answer.textContent = example.answer;
      sourceList.replaceChildren.apply(sourceList, example.sources.map(sourceCard));
      announce('question');
    });
  });

  demo.addEventListener('click', function (event) {
    var link = event.target.closest('a[data-source]');
    if (!link || !sources[link.dataset.source]) return;
    var target = document.getElementById('source-' + link.dataset.source);
    target.open = true;
    // Keep the anchor's native scrolling/history behavior and put keyboard focus at the source.
    target.querySelector('summary').focus({ preventScroll: true });
    announce('source', link.dataset.source);
  });

  var players = demo.querySelectorAll('audio');
  players.forEach(function (player) {
    player.addEventListener('play', function () {
      players.forEach(function (other) { if (other !== player) other.pause(); });
      announce('audio', player.closest('details').id.replace('source-', ''));
    });
    player.addEventListener('error', function () {
      player.parentElement.querySelector('.audio-error').hidden = false;
    });
  });

  function openHashSource() {
    var target = document.getElementById(location.hash.slice(1));
    if (target && target.matches('.sources details')) target.open = true;
  }
  window.addEventListener('hashchange', openHashSource);
  openHashSource();
})();

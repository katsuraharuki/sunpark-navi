// 声で案内：道順を見ている時だけ。既定は OFF。押したらその場で今のカードを読み、以後はカードが変わるたびに読む。
// 日本語の声が端末に無ければ、ボタン自体を出さない（鳴らないボタンを置かない）。効果音（navi-sound.js）とは別。
(function () {
  'use strict';
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  var synth = window.speechSynthesis, voice = null, on = false, lastKey = '';
  try { on = sessionStorage.getItem('sunpark-voice') === 'true'; } catch (e) {}
  var main = document.getElementById('main'); if (!main) return;
  var bar = document.createElement('div'); bar.className = 'voice-bar'; bar.hidden = true;

  function pickVoice() {
    var vs = synth.getVoices() || [];
    voice = vs.filter(function (v) { return /^ja([-_]|$)/i.test(v.lang || ''); })[0] || null;
    return voice;
  }
  function current() {
    var t = document.querySelector('#main .card .card-text'), n = document.querySelector('#main .card .step-no');
    if (!t) return null;
    var text = t.textContent.trim(), sub = document.querySelector('#main .card.arrive .card-sub + .card-sub');
    if (sub) text += ' ' + sub.textContent.trim(); // 寄り道コースの「次は◯◯です」
    return { key: location.search + '|' + (n ? n.textContent : '') + '|' + text, text: text };
  }
  function speak(text) {
    if (!voice || !text) return;
    synth.cancel(); // 次へを続けて押した時は、前の読み上げを止めてから読む
    var u = new SpeechSynthesisUtterance(text); u.voice = voice; u.lang = voice.lang; u.rate = 1;
    synth.speak(u);
  }
  function save() { try { sessionStorage.setItem('sunpark-voice', String(on)); } catch (e) {} }
  function render() {
    var c = current();
    var slot = document.getElementById('route-voice-setting');
    bar.hidden = !(slot && c && voice);
    if (bar.hidden) return;
    if (bar.parentNode !== slot) slot.appendChild(bar);
    bar.classList.toggle('prominent', !!document.querySelector('#main .seg.on[data-sf="1"]'));
    var html = on
      ? '<button type="button" id="voice-toggle" class="voice-btn on" aria-pressed="true">声で案内 ON</button><button type="button" id="voice-again" class="voice-again">もう一度聞く</button>'
      : '<button type="button" id="voice-toggle" class="voice-btn" aria-pressed="false">声で案内</button><span class="voice-hint">イヤホンがおすすめ</span>';
    if (bar.getAttribute('data-on') !== String(on)) { bar.innerHTML = html; bar.setAttribute('data-on', String(on)); bind(); }
  }
  function bind() {
    var t = document.getElementById('voice-toggle'), a = document.getElementById('voice-again');
    t.addEventListener('click', function () {
      on = !on; save();
      if (on) { var c = current(); if (c) { lastKey = c.key; speak(c.text); } } else synth.cancel();
      render();
    });
    if (a) a.addEventListener('click', function () { var c = current(); if (c) speak(c.text); });
  }
  function onChange() {
    render();
    var c = current();
    if (!c) { synth.cancel(); lastKey = ''; return; }
    if (on && voice && c.key !== lastKey) { lastKey = c.key; speak(c.text); }
  }
  function start() {
    var c = current(); if (c) lastKey = c.key; // 開いただけでは読まない
    render();
    new MutationObserver(onChange).observe(main, { childList: true, subtree: true });
  }
  if (pickVoice()) start();
  else if ('onvoiceschanged' in synth) {
    var started = false;
    synth.addEventListener('voiceschanged', function () { if (!started && pickVoice()) { started = true; start(); } });
  }
})();

/**
 * algo-common.js
 * アルゴリズム可視化サイト 共通JavaScriptフレームワーク
 * 基本情報技術者試験 科目B対策
 *
 * 各アルゴリズムHTMLファイルが定義すべきグローバル変数:
 *   window.ALGO_CODE      {string[]}   コードパネルに表示する行の配列
 *   window.TRACE_HEADERS  {string[]}   トレース表のカラム名配列
 *   window.generateSteps  {function}   ステップ配列を生成して返す関数
 *   window.renderViz      {function}   ステップ情報を受け取り可視化を描画する関数
 *
 * 各ステップオブジェクト:
 *   { codeLine: number, description: string, vizData: any, traceRow: {[header]: value} }
 */
(function () {
  var steps = [], cur = -1, playing = false, timer = null;

  function getDelay() {
    var v = +document.getElementById('speed-slider').value;
    // 1x=250ms, 10x=5ms の指数カーブ
    return Math.round(250 * Math.pow(5 / 250, (v - 1) / 9));
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function buildCode() {
    var c = document.getElementById('code-container');
    if (!c || !window.ALGO_CODE) return;
    c.innerHTML = window.ALGO_CODE.map(function (l, i) {
      return '<div class="code-line" data-line="' + i + '"><span class="ln">' + (i + 1) + '</span>' + esc(l) + '</div>';
    }).join('');
  }

  function hlLine(n) {
    document.querySelectorAll('.code-line').forEach(function (el) {
      el.classList.toggle('active', +el.dataset.line === n);
    });
    var el = document.querySelector('.code-line[data-line="' + n + '"]');
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function buildThead() {
    var tr = document.querySelector('#trace-table thead tr');
    if (!tr || !window.TRACE_HEADERS) return;
    tr.innerHTML = window.TRACE_HEADERS.map(function (h) {
      return '<th>' + esc(h) + '</th>';
    }).join('');
  }

  function updateTrace(upto) {
    var tbody = document.querySelector('#trace-table tbody');
    if (!tbody) return;
    tbody.innerHTML = steps.slice(0, upto + 1).map(function (s, i) {
      var cells = (window.TRACE_HEADERS || []).map(function (h) {
        var v = s.traceRow && s.traceRow[h] !== undefined ? s.traceRow[h] : '';
        return '<td>' + esc(String(v)) + '</td>';
      }).join('');
      return '<tr class="' + (i === upto ? 'cur' : '') + '">' + cells + '</tr>';
    }).join('');
    var row = tbody.querySelector('.cur');
    if (row) row.scrollIntoView({ block: 'nearest' });
  }

  window.renderStep = function (idx) {
    if (idx < 0 || idx >= steps.length) return;
    cur = idx;
    var s = steps[idx];
    hlLine(s.codeLine);
    if (window.renderViz) window.renderViz(s);
    updateTrace(idx);
    var msg = document.getElementById('info-msg');
    if (msg) msg.textContent = s.description || '';
    document.getElementById('step-counter').textContent = (idx + 1) + ' / ' + steps.length;
    document.getElementById('btn-prev').disabled = (idx === 0);
    document.getElementById('btn-next').disabled = (idx === steps.length - 1);
  };

  function stopPlay() {
    playing = false;
    clearTimeout(timer);
    var b = document.getElementById('btn-play');
    if (b) { b.textContent = '▶ 再生'; b.classList.remove('primary'); }
  }

  function schedNext() {
    if (!playing || cur >= steps.length - 1) { stopPlay(); return; }
    window.renderStep(cur + 1);
    timer = setTimeout(schedNext, getDelay());
  }

  function togglePlay() {
    playing = !playing;
    var b = document.getElementById('btn-play');
    b.textContent = playing ? '⏸ 一時停止' : '▶ 再生';
    b.classList.toggle('primary', playing);
    if (playing) {
      if (cur >= steps.length - 1) doReset();
      schedNext();
    } else {
      clearTimeout(timer);
    }
  }

  function doReset() {
    stopPlay();
    if (window.generateSteps) steps = window.generateSteps();
    window.renderStep(0);
  }

  document.addEventListener('DOMContentLoaded', function () {
    buildCode();
    buildThead();
    document.getElementById('btn-play').addEventListener('click', togglePlay);
    document.getElementById('btn-prev').addEventListener('click', function () { stopPlay(); window.renderStep(cur - 1); });
    document.getElementById('btn-next').addEventListener('click', function () { stopPlay(); window.renderStep(cur + 1); });
    document.getElementById('btn-reset').addEventListener('click', doReset);
    var speedSlider = document.getElementById('speed-slider');
    document.getElementById('speed-label').textContent = (+speedSlider.value).toFixed(1) + 'x';
    speedSlider.addEventListener('input', function () {
      var v = +this.value;
      document.getElementById('speed-label').textContent = (+v).toFixed(1) + 'x';
    });
    doReset();
  });
})();

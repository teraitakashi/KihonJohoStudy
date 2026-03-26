/**
 * algo-theme.js
 * テーマ切り替えモジュール（Dark / Alice）
 * localStorage にテーマを保存し、ページ再読み込み後も維持する
 */

/* ── テーマを即時適用（FOUC 防止） ── */
(function () {
  var saved = localStorage.getItem('algo-theme');
  if (saved === 'alice') {
    document.documentElement.setAttribute('data-theme', 'alice');
  }
})();

/* ── DOM 準備後に Toggle ボタンを注入 ── */
document.addEventListener('DOMContentLoaded', function () {
  var header = document.querySelector('header');
  if (!header) return;

  var btn = document.createElement('button');
  btn.id = 'theme-toggle';
  btn.className = 'ctrl-btn theme-toggle-btn';
  btn.title = 'テーマ切り替え';
  updateBtnLabel(btn);

  btn.addEventListener('click', function () {
    var isAlice = document.documentElement.getAttribute('data-theme') === 'alice';
    if (isAlice) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('algo-theme', 'default');
    } else {
      document.documentElement.setAttribute('data-theme', 'alice');
      localStorage.setItem('algo-theme', 'alice');
    }
    updateBtnLabel(btn);

    /* 可視化を再描画（renderViz が定義されている場合） */
    if (typeof window._currentStep !== 'undefined' && window._currentStep !== null && typeof window.renderViz === 'function') {
      window.renderViz(window._currentStep);
    }
  });

  header.appendChild(btn);
});

function updateBtnLabel(btn) {
  var isAlice = document.documentElement.getAttribute('data-theme') === 'alice';
  btn.textContent = isAlice ? '🌙 Dark' : '☕ Teatime';
}

/**
 * getVizColors()
 * 現在のテーマに対応した可視化カラーマップを返す
 * renderViz() の先頭で呼び出すことでテーマ切り替えに対応
 *
 * @returns {Object} カラーマップ
 */
window.getVizColors = function () {
  var s = getComputedStyle(document.documentElement);
  function v(name) { return s.getPropertyValue(name).trim(); }
  var isAlice = document.documentElement.getAttribute('data-theme') === 'alice';
  return {
    'default':  v('--viz-default'),
    'compare':  v('--viz-compare'),
    'swap':     v('--viz-swap'),
    'sorted':   v('--viz-sorted'),
    'min':      v('--viz-min'),
    'shift':    v('--viz-shift'),
    'key':      v('--viz-key'),
    'current':  v('--viz-current'),
    'pointer':  v('--viz-pointer'),
    'highlight':v('--viz-highlight'),
    'comp': [
      v('--viz-comp0'),
      v('--viz-comp1'),
      v('--viz-comp2'),
      v('--viz-comp3'),
      v('--viz-comp4'),
    ],
    'maze': {
      wall:      v('--viz-maze-wall'),
      unvisited: v('--viz-maze-unvisited'),
      frontier:  v('--viz-maze-frontier'),
      visited:   v('--viz-maze-visited'),
      current:   v('--viz-compare'),
      path:      v('--viz-sorted'),
      start:     v('--viz-default'),
      goal:      v('--viz-min'),
      border:    v('--viz-maze-border'),
      outer:     v('--viz-maze-outer'),
    },
    /* SVG/JS コード内ハードコード色用 */
    'nodeFill':       v('--viz-node-fill'),
    'edge':           v('--viz-edge'),
    'nodeText':       v('--viz-node-text'),
    'darkBg':         v('--viz-dark-bg'),
    'prioRootFill':   v('--viz-prio-root'),
    'prioRootStroke': v('--viz-prio-stroke'),
    /* rgba プレフィックス（JS 文字列内の rgba カラー動的生成用） */
    '_cmpRgba': isAlice ? 'rgba(232,160,32,'  : 'rgba(245,197,66,',
    '_srtRgba': isAlice ? 'rgba(200,112,144,' : 'rgba(62,207,106,',
    '_defRgba': isAlice ? 'rgba(104,152,208,' : 'rgba(79,142,247,',
    '_swpRgba': isAlice ? 'rgba(200,64,96,'   : 'rgba(224,92,92,',
    '_brdRgba': isAlice ? 'rgba(200,180,160,' : 'rgba(46,50,80,',
    '_sfcRgba': isAlice ? 'rgba(200,180,160,' : 'rgba(35,38,58,',   // 範囲外セル背景
    '_dimRgba': isAlice ? 'rgba(60,26,32,'    : 'rgba(136,146,176,', // 範囲外セルテキスト
    /* 共通 */
    'dim':   v('--dim'),
    'text':  v('--text'),
    'surface': v('--surface'),
    'surface2': v('--surface2'),
    'border':  v('--border'),
    'accent':  v('--accent'),
  };
};

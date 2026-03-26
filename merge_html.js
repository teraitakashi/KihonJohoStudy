/**
 * merge_html.js
 * copilot_work と copilot_work_alice の同名 HTML ファイルを
 * テーマ切り替え対応の単一ファイルに統合して copilot_work_merge へ出力する。
 *
 * 変換ルール:
 *   1. <head> に <script src="algo-theme.js"> を挿入
 *   2. renderViz() 内の colorMap を getVizColors() 呼び出しに変換
 *   3. JS 内のハードコードされた viz 色を CSS 変数参照に変換
 *   4. algo-maze.html, algo-union-find.html, algo-visualizer.html,
 *      index.html は個別処理
 */

const fs   = require('fs');
const path = require('path');

const SRC_WORK  = 'C:\\Users\\v011u\\copilot_work';
const SRC_ALICE = 'C:\\Users\\v011u\\copilot_work_alice';
const DST       = 'C:\\Users\\v011u\\copilot_work_merge';

// ───────────────────────────────────────────────────────────
// インラインスタイル色置換テーブル
// ───────────────────────────────────────────────────────────
const INLINE_COLOR_MAP = [
  ["color:#f5c542",                     "color:var(--viz-compare)"],
  ["color: #f5c542",                    "color:var(--viz-compare)"],
  ["color:#8892b0",                     "color:var(--dim)"],
  ["color: #8892b0",                    "color:var(--dim)"],
  ["color:#a0aec0",                     "color:var(--dim)"],
  ["color:#718096",                     "color:var(--dim)"],
  ["background:rgba(79,142,247,.55)",   "background:var(--viz-highlight)"],
  ["background:rgba(79,142,247,.5)",    "background:var(--viz-highlight)"],
];
const COLORMAP_RE = /var colorMap\s*=\s*\{[^}]+\}\s*;/gms;
const COLORMAP_REPLACEMENT =
  "var colorMap = window.getVizColors ? window.getVizColors() : {\n" +
  "    'default': '#4f8ef7', 'compare': '#f5c542', 'swap': '#e05c5c',\n" +
  "    'sorted': '#3ecf6a', 'min': '#f08c3a', 'shift': '#f08c3a',\n" +
  "    'key': '#7c5cbf', 'current': '#7c5cbf'\n" +
  "  };";

// ───────────────────────────────────────────────────────────
// CSS <style> ブロック内の暗い色 → アリス色 自動オーバーライド生成
// ───────────────────────────────────────────────────────────

// rgba プレフィックス変換（alpha はそのまま保持）
const CSS_ALICE_RGBA = [
  [/rgba\(245,197,66,([^)]+)\)/g,   (_, a) => `rgba(232,160,32,${a})`],   // compare
  [/rgba\(62,207,106,([^)]+)\)/g,   (_, a) => `rgba(200,112,144,${a})`],  // sorted
  [/rgba\(79,142,247,([^)]+)\)/g,   (_, a) => `rgba(104,152,208,${a})`],  // default
  [/rgba\(224,92,92,([^)]+)\)/g,    (_, a) => `rgba(200,64,96,${a})`],    // swap
  [/rgba\(46,50,80,([^)]+)\)/g,     (_, a) => `rgba(200,180,160,${a})`],  // brd/dark overlay
  [/rgba\(136,146,176,([^)]+)\)/g,  (_, a) => `rgba(60,26,32,${a})`],     // dim text
];
// 固定 hex 変換
const CSS_ALICE_HEX = [
  [/#1a1d27(?=[^0-9a-fA-F])/g, '#faebd7'],               // dark node fill → cream
  [/#23263a(?=[^0-9a-fA-F])/g, '#faebd7'],               // dark navy → cream
  [/#1e2233(?=[^0-9a-fA-F])/g, '#faebd7'],               // dark bg → cream
  [/#161922(?=[^0-9a-fA-F])/g, '#fffbf5'],               // darkest → surface
  [/#3a3010(?=[^0-9a-fA-F])/g, 'rgba(232,160,32,0.2)'],  // dark olive cur-row → amber tint
  [/#2a2510(?=[^0-9a-fA-F])/g, 'rgba(232,160,32,0.15)'], // dark olive highlight → amber tint
  [/#2a4a2a(?=[^0-9a-fA-F])/g, '#fce8f0'],               // dark green badge → alice pink
  [/#1e3a5f(?=[^0-9a-fA-F])/g, 'rgba(104,152,208,0.15)'],// dark blue active → light blue
  [/#2e3250(?=[^0-9a-fA-F])/g, '#c9a48a'],               // dark border → alice warm border
  [/#1a2035(?=[^0-9a-fA-F])/g, '#faebd7'],               // dark panel bg → cream
  [/#ccd6f6(?=[^0-9a-fA-F])/g, '#3c1a20'],               // near-white text → dark plum
  [/#cdd6f4(?=[^0-9a-fA-F])/g, '#3c1a20'],               // near-white text → dark plum
  [/#e2e8f0(?=[^0-9a-fA-F])/g, '#3c1a20'],               // light text → dark plum
  [/#5a6070(?=[^0-9a-fA-F])/g, '#9c6b72'],               // dark muted dim → alice dim
  [/#4f8ef7(?=[^0-9a-fA-F])/g, '#6898d0'],               // blue default → alice blue
  [/#3ecf6a(?=[^0-9a-fA-F])/g, '#c87090'],               // green sorted → alice rose
  [/#f5c542(?=[^0-9a-fA-F])/g, '#e8a020'],               // yellow compare → alice amber
  [/#6272a4(?=[^0-9a-fA-F])/g, '#9c6b72'],               // blue-gray dim → alice dim
];

function toAliceColor(str) {
  let r = str;
  for (const [re, rep] of CSS_ALICE_RGBA) r = r.replace(re, rep);
  for (const [re, rep] of CSS_ALICE_HEX)  r = r.replace(re, rep);
  return r;
}

/**
 * CSS <style> ブロック内のダーク色を検出し、
 * [data-theme="alice"] オーバーライドルールを自動生成してブロック末尾に追加する。
 * 変更されたプロパティ宣言のみ alice ルールに含める。
 */
function autoAliceCssOverrides(html) {
  return html.replace(/(<style>)([\s\S]*?)(<\/style>)/, (full, open, css, close) => {
    const aliceRules = [];
    // CSS ルール: セレクタ { 宣言 } を順次マッチ（@ルール・コメント除外）
    const ruleRe = /([^{}\n@][^{]*)\{([^}]*)\}/g;
    let m;
    while ((m = ruleRe.exec(css)) !== null) {
      const sel = m[1].trim();
      const decls = m[2];
      // コメントをセレクタから除去してから判定
      const cleanSel = sel.replace(/\/\*[\s\S]*?\*\//g, '').trim();
      // 既に alice スコープ済み、または空は無視
      if (!cleanSel || cleanSel.includes('data-theme')) continue;

      const aliceDecls = toAliceColor(decls);
      if (aliceDecls === decls) continue;

      // 変更されたプロパティ宣言のみ抽出
      const orig  = decls.split(';').map(s => s.trim()).filter(Boolean);
      const alice = aliceDecls.split(';').map(s => s.trim()).filter(Boolean);
      const changed = alice.filter((d, i) => d !== (orig[i] || ''));
      if (changed.length === 0) continue;

      // 複数セレクタはそれぞれに prefix を付ける（コメント除去済みクリーンセレクタ使用）
      const aliceSel = cleanSel.split(',')
        .map(s => `[data-theme="alice"] ${s.trim()}`)
        .join(',');
      aliceRules.push(`${aliceSel}{${changed.join(';')};}`);
    }

    if (aliceRules.length === 0) return full;
    return open + css + '\n' + aliceRules.join('\n') + '\n' + close;
  });
}


/**
 * ダークと alice 両オリジナルの <style> ブロックを直接比較し、
 * 差分から [data-theme="alice"] オーバーライドルールを生成する。
 * CSS_ALICE_HEX ルックアップテーブルで拾えない差分を補完する。
 */
function buildDiffOverrides(darkCss, aliceCss) {
  const ruleRe = /([^{}\n@][^{]*)\{([^}]*)\}/g;
  function parseRules(css) {
    const map = {};
    let m;
    ruleRe.lastIndex = 0;
    while ((m = ruleRe.exec(css)) !== null) {
      const sel = m[1].trim().replace(/\/\*[\s\S]*?\*\//g, '').trim();
      if (!sel || sel.includes('data-theme')) continue;
      map[sel] = m[2].split(';').map(s => s.trim()).filter(Boolean);
    }
    return map;
  }
  const dark = parseRules(darkCss);
  const alice = parseRules(aliceCss);
  const overrides = [];
  for (const [sel, aliceDecls] of Object.entries(alice)) {
    const darkDecls = dark[sel] || [];
    const changed = aliceDecls.filter(d => !darkDecls.includes(d));
    if (changed.length === 0) continue;
    const aliceSel = sel.split(',').map(s => `[data-theme="alice"] ${s.trim()}`).join(',');
    overrides.push(`${aliceSel}{${changed.join(';')};}`);
  }
  return overrides;
}

function readFile(filePath) {
  // 内部処理は LF に統一
  return fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
}

function writeFile(filePath, content) {
  // 出力は CRLF に統一
  const crlf = content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, crlf, 'utf-8');
}

function insertThemeScript(html) {
  const tag = '<script src="algo-theme.js"></script>\n';
  return html.replace('</head>', tag + '</head>');
}

function replaceColorMap(html) {
  // colorMap オブジェクトを getVizColors() 呼び出しに変換
  let result = html.replace(COLORMAP_RE, COLORMAP_REPLACEMENT);
  return result;
}

function replaceInlineColors(html) {
  let result = html;
  for (const [old, next] of INLINE_COLOR_MAP) {
    // すべての出現を置換
    while (result.includes(old)) {
      result = result.replace(old, next);
    }
  }
  return result;
}

// ───────────────────────────────────────────────────────────
// スクリプトセクション内ハードコード色の置換
// apply_alice_theme.py の GENERAL / DEFAULT_EXTRAS / MAZE_SPECIFIC に準拠
// ───────────────────────────────────────────────────────────
const SCRIPT_TAG_RE = /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi;

function substituteScriptColors(html, isMaze) {
  return html.replace(SCRIPT_TAG_RE, (full, open, body, close) => {
    // 外部スクリプトタグはスキップ
    if (open.includes('src=')) return full;

    let s = body;

    // ── MAZE ファイル専用: legend 用 colorMap 参照へ置換 ──────────────
    if (isMaze) {
      // テンプレートリテラル内 background 色 → colorMap.* に置換
      // （processMaze() が colorMap を vc.maze に変換した後に有効）
      s = s.replace(/background:rgba\(245,197,66,0\.5\)/g,   'background:${colorMap.frontier}');
      s = s.replace(/background:rgba\(79,142,247,0\.35\)/g,  'background:${colorMap.visited}');
      s = s.replace(/background:#4f8ef7(?=[^0-9a-fA-F])/g,  'background:${colorMap.start}');
      s = s.replace(/background:#f08c3a(?=[^0-9a-fA-F])/g,  'background:${colorMap.goal}');
      s = s.replace(/background:#3ecf6a(?=[^0-9a-fA-F])/g,  'background:${colorMap.path}');
      s = s.replace(/color:#8892b0(?=[^0-9a-fA-F])/g,       'color:var(--dim)');
      // 迷路セルテキスト色: rgba(255,255,255,0.8) → 動的参照（一般 hex 置換後に実施するためプレースホルダを使用しない）
      // NOTE: rgba fallback には hex コードを含まないようにする（二重置換防止）
      s = s.replace(/'rgba\(255,255,255,0\.8\)'/g,
        "(_C.nodeText||'rgba(255,255,255,0.8)')");
      // MAZE_SPECIFIC hex: maze 専用 CSS 変数へ
      s = s.replace(/#0f1117(?=[^0-9a-fA-F])/g, `'+(_C.maze?_C.maze.wall:'#0f1117')+'`);
      s = s.replace(/#0a0c12(?=[^0-9a-fA-F])/g, `'+(_C.maze?_C.maze.wall:'#0a0c12')+'`);
      s = s.replace(/#1a1d27(?=[^0-9a-fA-F])/g, `'+(_C.maze?_C.maze.unvisited:'#1a1d27')+'`);
      s = s.replace(/#3ecf6a(?=[^0-9a-fA-F])/g, `'+(_C.maze?_C.maze.path:'#3ecf6a')+'`);
    } else {
      // ── 非 MAZE: DEFAULT_EXTRAS ──────────────────────────────────────
      s = s.replace(/#0f1117(?=[^0-9a-fA-F])/g, `'+(_C.darkBg||'#0f1117')+'`);
      s = s.replace(/#1a1d27(?=[^0-9a-fA-F])/g, `'+(_C.nodeFill||'#1a1d27')+'`);
      s = s.replace(/#3ecf6a(?=[^0-9a-fA-F])/g, `'+(_C.sorted||'#3ecf6a')+'`);
    }

    // ── GENERAL rgba プレフィックス置換（maze/非 maze 共通） ──────────
    // （NOTE: rgba は hex より先に処理すること）
    // rgba(245,197,66,alpha) → _C._cmpRgba + alpha + ')'  ← 閉じ括弧を文字列内に含める
    s = s.replace(/rgba\(245,197,66,([^)]+)\)/g,
      (_, a) => `'+(_C._cmpRgba+'${a})')+'`);
    s = s.replace(/rgba\(62,207,106,([^)]+)\)/g,
      (_, a) => `'+(_C._srtRgba+'${a})')+'`);
    s = s.replace(/rgba\(79,142,247,([^)]+)\)/g,
      (_, a) => `'+(_C._defRgba+'${a})')+'`);
    s = s.replace(/rgba\(224,92,92,([^)]+)\)/g,
      (_, a) => `'+(_C._swpRgba+'${a})')+'`);
    s = s.replace(/rgba\(46,50,80,([^)]+)\)/g,
      (_, a) => `'+(_C._brdRgba+'${a})')+'`);
    s = s.replace(/rgba\(35,38,58,([^)]+)\)/g,
      (_, a) => `'+(_C._sfcRgba+'${a})')+'`);
    s = s.replace(/rgba\(136,146,176,([^)]+)\)/g,
      (_, a) => `'+(_C._dimRgba+'${a})')+'`);

    // ── GENERAL hex 置換 ─────────────────────────────────────────────
    // 長い（特殊）色から先に処理
    s = s.replace(/#23263a(?=[^0-9a-fA-F])/g, `'+(_C.nodeFill||'#23263a')+'`);
    s = s.replace(/#1a1d2e(?=[^0-9a-fA-F])/g, `'+(_C.nodeFill||'#1a1d2e')+'`);
    s = s.replace(/#2e3250(?=[^0-9a-fA-F])/g, `'+(_C.edge||'#2e3250')+'`);
    s = s.replace(/#f5c542(?=[^0-9a-fA-F])/g, `'+(_C.compare||'#f5c542')+'`);
    s = s.replace(/#4f8ef7(?=[^0-9a-fA-F])/g, `'+(_C.default||'#4f8ef7')+'`);
    s = s.replace(/#e05c5c(?=[^0-9a-fA-F])/g, `'+(_C.swap||'#e05c5c')+'`);
    s = s.replace(/#f08c3a(?=[^0-9a-fA-F])/g, `'+(_C.min||'#f08c3a')+'`);
    s = s.replace(/#e2e8f0(?=[^0-9a-fA-F])/g, `'+(_C.nodeText||'#e2e8f0')+'`);
    s = s.replace(/#8892b0(?=[^0-9a-fA-F])/g, `'+(_C.dim||'#8892b0')+'`);
    s = s.replace(/#0a0c12(?=[^0-9a-fA-F])/g, `'+(_C.darkBg||'#0a0c12')+'`);
    s = s.replace(/#181f2c(?=[^0-9a-fA-F])/g, `'+(_C.darkBg||'#181f2c')+'`);
    s = s.replace(/#c084fc(?=[^0-9a-fA-F])/g, `'+(_C.key||'#c084fc')+'`);
    s = s.replace(/#42A5F5(?=[^0-9a-fA-F])/g, `'+(_C.default||'#42A5F5')+'`);
    s = s.replace(/#FF6B35(?=[^0-9a-fA-F])/g, `'+(_C.compare||'#FF6B35')+'`);
    s = s.replace(/#38bdf8(?=[^0-9a-fA-F])/g, `'+(_C.default||'#38bdf8')+'`);
    s = s.replace(/#1a6e40(?=[^0-9a-fA-F])/g, `'+(_C.prioRootFill||'#1a6e40')+'`);
    s = s.replace(/#2ecc71(?=[^0-9a-fA-F])/g, `'+(_C.prioRootStroke||'#2ecc71')+'`);
    // visualizer 追加色
    s = s.replace(/#f6c90e(?=[^0-9a-fA-F])/g, `'+(_C.compare||'#f6c90e')+'`);
    s = s.replace(/#e74c3c(?=[^0-9a-fA-F])/g, `'+(_C.swap||'#e74c3c')+'`);
    s = s.replace(/#f39c12(?=[^0-9a-fA-F])/g, `'+(_C.min||'#f39c12')+'`);
    s = s.replace(/#2d3148(?=[^0-9a-fA-F])/g, `'+(_C.edge||'#2d3148')+'`);
    s = s.replace(/#1e2133(?=[^0-9a-fA-F])/g, `'+(_C.nodeFill||'#1e2133')+'`);
    s = s.replace(/#e8c4aa(?=[^0-9a-fA-F])/g, `'+(_C.border||'#e8c4aa')+'`);
    s = s.replace(/#a0aec0(?=[^0-9a-fA-F])/g, `'+(_C.dim||'#a0aec0')+'`);
    s = s.replace(/#718096(?=[^0-9a-fA-F])/g, `'+(_C.dim||'#718096')+'`);
    s = s.replace(/#4a5568(?=[^0-9a-fA-F])/g, `'+(_C.dim||'#4a5568')+'`);
    s = s.replace(/#cbd5e0(?=[^0-9a-fA-F])/g, `'+(_C.nodeText||'#cbd5e0')+'`);

    return open + s + close;
  });
}

// window.renderViz の先頭に var _C を注入する
function injectVarC(html) {
  // window.renderViz = function(...) { の直後に注入
  return html.replace(
    /(window\.renderViz\s*=\s*function\s*\([^)]*\)\s*\{)/,
    '$1\n  var _C = window.getVizColors ? window.getVizColors() : {};'
  );
}

function processStandardHtml(filename) {
  const srcPath   = path.join(SRC_WORK,  filename);
  const alicePath = path.join(SRC_ALICE, filename);
  let html = readFile(srcPath);
  html = insertThemeScript(html);
  html = substituteScriptColors(html, false); // colorMap 置換前に実施
  html = replaceColorMap(html);
  html = replaceInlineColors(html);
  html = injectVarC(html);
  // CSS <style> ブロック内の暗い色を alice 用に自動オーバーライド（ルックアップテーブル方式）
  html = autoAliceCssOverrides(html);

  // ダーク / alice オリジナルを直接比較して差分オーバーライドを追加（diff 方式）
  // → ルックアップテーブルで拾えない差分を補完する
  if (fs.existsSync(alicePath)) {
    const darkOrigCssM  = readFile(srcPath).match(/<style>([\s\S]*?)<\/style>/);
    const aliceOrigCssM = readFile(alicePath).match(/<style>([\s\S]*?)<\/style>/);
    if (darkOrigCssM && aliceOrigCssM) {
      const diffRules = buildDiffOverrides(darkOrigCssM[1], aliceOrigCssM[1]);
      if (diffRules.length > 0) {
        html = html.replace(/(<\/style>)/, diffRules.join('\n') + '\n$1');
      }
    }
  }

  // algo-binary-search.html: 可視化セルを linear-search と同スタイルに統一
  //  - セルフォントを 1.09rem → 1.40rem
  //  - wrapper gap: 2px → 5px（linear と統一）
  //  - インデックス文字: .69rem → .75rem（linear と統一）
  //  - compare opacity: .22 → .18（linear と統一）
  //  - found opacity: .28 → .22（linear と統一）
  //  - isOut（範囲外）: ダーク系 rgba ハードコード → CSS 変数（テーマ両対応）
  //  - in-range: 12% 不透明 rgba → CSS 変数ベース（はっきり見える）
  //  - 範囲バー: ダーク系 rgba → CSS 変数
  if (filename === 'algo-binary-search.html') {
    // フォントサイズ
    html = html.replace(
      /('width:54px;height:54px;[^']*font-size:)1\.09rem/,
      '$11.40rem'
    );
    // wrapper gap 2px → 5px
    html = html.replace(
      "wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';",
      "wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:5px;';"
    );
    // インデックスラベル .69rem → .75rem
    html = html.replace(
      "'width:54px;text-align:center;font-size:.69rem;color:var(--dim);font-family:Consolas,monospace;'",
      "'width:54px;text-align:center;font-size:.75rem;color:var(--dim);font-family:Consolas,monospace;'"
    );
    // compare opacity .22 → .18
    html = html.replace(
      /(_C\._cmpRgba\+)'\.22\)'/,
      "$1'.18)'"
    );
    // found opacity .28 → .22
    html = html.replace(
      /(_C\._srtRgba\+)'\.28\)'/,
      "$1'.22)'"
    );
    // isOut セル: 線形探索の visited と同スタイル (_defRgba .1/.3)
    html = html.replace(
      /cell\.style\.background = ''\+\(_C\._sfcRgba\+'\.5\)'\)\+'';[\r\n\s]+cell\.style\.borderColor = ''\+\(_C\._brdRgba\+'\.3\)'\)\+'';[\r\n\s]+cell\.style\.color = ''\+\(_C\._dimRgba\+'\.35\)'\)\+'';/,
      "cell.style.background = ''+(_C._defRgba+'.1)')+'';\n      cell.style.borderColor = ''+(_C._defRgba+'.3)')+'';\n      cell.style.color = 'var(--dim)';"
    );
    // in-range セル: _defRgba/.12 → surface2, _defRgba/.5 → accent border
    html = html.replace(
      /cell\.style\.background = ''\+\(_C\._defRgba\+'\.12\)'\)\+'';[\r\n\s]+cell\.style\.borderColor = ''\+\(_C\._defRgba\+'\.5\)'\)\+'';/,
      "cell.style.background = 'var(--surface2)';\n      cell.style.borderColor = 'var(--accent)';"
    );
    // 範囲バー isOut: _brdRgba/.2 → border var
    html = html.replace(
      /bar\.style\.background = ''\+\(_C\._brdRgba\+'\.2\)'\)\+'';/,
      "bar.style.background = 'var(--border)';"
    );
    // 範囲バー in-range: _defRgba/.5 → accent
    html = html.replace(
      /bar\.style\.background = ''\+\(_C\._defRgba\+'\.5\)'\)\+'';/,
      "bar.style.background = 'var(--accent)';"
    );
  }

  // algo-bit-ops.html: アリスモードでビットセルを明るい色に統一
  //  - normal1 (1ビット): 暗い t.one (#2E7D32等) → t.accent (明るい色) + アリス分岐
  //  - normal0 (0ビット): ハードコード暗色 → _sfcRgba/.5 + var(--dim)
  //  - ラベル色 #bbb → var(--dim)
  if (filename === 'algo-bit-ops.html') {
    // themes 定義の後に isAliceBit フラグを挿入
    html = html.replace(
      "const t = themes[d.operation];",
      "const t = themes[d.operation];\n  const isAliceBit = document.documentElement.getAttribute('data-theme')==='alice';"
    );
    // normal1: t.one(暗) → アリスでは t.accent(明)、ボーダーもテーマ対応
    html = html.replace(
      "case 'normal1':\n        bg = t.one;     fg = '#fff';  border = '1px solid rgba(255,255,255,0.22)'; break;",
      "case 'normal1':\n        bg = isAliceBit ? t.accent : t.one;\n        fg = isAliceBit ? '#fff' : '#fff';\n        border = isAliceBit ? '1px solid rgba(0,0,0,0.18)' : '1px solid rgba(255,255,255,0.22)'; break;"
    );
    // normal0: ハードコード暗色 → テーマ対応
    html = html.replace(
      "case 'normal0':\n        bg = '#252e3f'; fg = '#4a5a7a'; border = '1px solid rgba(255,255,255,0.07)'; break;",
      "case 'normal0':\n        bg = isAliceBit ? ''+(_C._sfcRgba+'.55)')+'' : '#252e3f';\n        fg = isAliceBit ? 'var(--dim)' : '#4a5a7a';\n        border = isAliceBit ? '1px solid '+''+(_C._brdRgba+'.35)')+'' : '1px solid rgba(255,255,255,0.07)'; break;"
    );
    // ラベル色 #bbb → var(--dim)
    html = html.replace(
      "padding-right:10px;font-family:monospace;white-space:nowrap;\">${label}</div>`",
      "padding-right:10px;font-family:monospace;white-space:nowrap;color:var(--dim);\">${label}</div>`"
    );
  }


  if (filename === 'algo-hash-table.html') {
    html = html.replace(/_C\._cmpRgba\+'\.12\)'/g, "_C._cmpRgba+'.35)'");
    html = html.replace(/_C\._defRgba\+'\.2\)'/g,  "_C._defRgba+'.25)'");
  }

  // algo-linked-list.html: current node .1 → .35、新ヘッド .15 → .25（opacity 統一）
  if (filename === 'algo-linked-list.html') {
    html = html.replace(/_C\._cmpRgba\+'\.1\)'/g,  "_C._cmpRgba+'.35)'");
    html = html.replace(/_C\._srtRgba\+'\.15\)'/g, "_C._srtRgba+'.25)'");
    html = html.replace(/_C\._swpRgba\+'\.15\)'/g, "_C._swpRgba+'.25)'");
  }

  // algo-prefix-sum.html: in-range bg .08 → .15（ほぼ不可視を改善）
  if (filename === 'algo-prefix-sum.html') {
    html = html.replace(/_C\._defRgba\+'\.08\)'/g, "_C._defRgba+'.15)'");
  }

  // algo-prime-factorization.html:
  // CHIP_COLORS がスクリプトレベルで _C を参照しており ReferenceError が発生するため
  // chipColor() 関数内で毎回 getVizColors() を呼び出す形に変換
  if (filename === 'algo-prime-factorization.html') {
    html = html.replace(
      /var CHIP_COLORS = \[([\s\S]*?)\];\nfunction chipColor\(prime\) \{([\s\S]*?return CHIP_COLORS\[[\s\S]*?\];)\n\}/,
      (_, colors, body) => {
        // '' + (_C.xxx||'fallback') + '' → _C.xxx||'fallback'
        const cleanColors = colors.replace(/''\+\((_C\.\w+\|[^)]+)\)\+''/g, '$1');
        return `function chipColor(prime) {\n  var _C = window.getVizColors ? window.getVizColors() : {};\n  var CHIP_COLORS = [${cleanColors}];\n${body}\n}`;
      }
    );
  }

  // algo-permutation.html: .perm-badge アリス配色オーバーライド（CSS var 使用で精密化）
  if (filename === 'algo-permutation.html') {
    html = html.replace(
      /(<\/style>)/,
      '[data-theme="alice"] .perm-badge{background:#fce8f0;color:var(--viz-sorted);border-color:var(--viz-sorted);}\n$1'
    );
  }

  // algo-magic-square.html: .ms-cell 系アリス配色オーバーライド
  // ダーク / アリス ともに flip-vertical に合わせて不透明度を上げ半透明に見えないよう修正
  if (filename === 'algo-magic-square.html') {
    // ダークモード: 基本CSS の rgba 不透明度を flip-vertical 相当に引き上げ
    html = html.replace(
      '.ms-cell.placed {\n  background: rgba(79,142,247,0.2);\n  border-color: #4f8ef7;\n  color: #e2e8f0;\n}',
      '.ms-cell.placed {\n  background: rgba(79,142,247,0.55);\n  border-color: #4f8ef7;\n  color: rgba(255,255,255,0.9);\n}'
    );
    html = html.replace(
      /\.ms-cell\.current \{\n  background: rgba\(245,197,66,0\.4\);[\s\S]*?\}/,
      '.ms-cell.current {\n  background: #f5c542;\n  border-color: #f5c542;\n  color: #1a1d27;\n}'
    );
    html = html.replace(
      '.ms-cell.next-pos {\n  background: rgba(62,207,106,0.15);\n  border-color: rgba(62,207,106,0.6);\n  color: transparent;\n}',
      '.ms-cell.next-pos {\n  background: rgba(62,207,106,0.35);\n  border-color: #3ecf6a;\n  color: transparent;\n}'
    );
    // アリスモード: 同等の不透明度でアリス配色を上書き
    html = html.replace(
      /(<\/style>)/,
      '[data-theme="alice"] .ms-cell{background:#faebd7;border-color:#c9a48a;}\n' +
      '[data-theme="alice"] .ms-cell.placed{background:rgba(104,152,208,0.55);border-color:#6898d0;color:rgba(255,255,255,0.9);}\n' +
      '[data-theme="alice"] .ms-cell.current{background:#c9a227;border-color:#c9a227;color:#3c1a20;}\n' +
      '[data-theme="alice"] .ms-cell.next-pos{background:rgba(200,112,144,0.35);border-color:#c87090;}\n' +
      '[data-theme="alice"] .ms-sum-ok{color:#c87090;}\n' +
      '[data-theme="alice"] .ms-magic-sum{color:#c87090;}\n' +
      '$1'
    );
  }

  // algo-fast-exp.html: 可視化エリア全体のアリス配色オーバーライド
  if (filename === 'algo-fast-exp.html') {
    html = html.replace(
      /(<\/style>)/,
      '[data-theme="alice"] .bin-bit{background:#faebd7;border-color:#c9a48a;color:#3c1a20;}\n' +
      '[data-theme="alice"] .bin-bit.active{background:#e8a020;border-color:#e8a020;color:#000;}\n' +
      '[data-theme="alice"] .bin-bit.done-bit{background:rgba(200,112,144,0.18);border-color:#c87090;color:#c87090;}\n' +
      '[data-theme="alice"] .bin-pos{color:#9c6b72;}\n' +
      '[data-theme="alice"] .result-display{color:#3c1a20;}\n' +
      '[data-theme="alice"] .result-display.done .val{color:#c87090;}\n' +
      '[data-theme="alice"] .iter-table th{background:#faebd7;border-bottom:1px solid #e8c4aa;}\n' +
      '[data-theme="alice"] .iter-table td{background:#fffbf5;border-bottom:1px solid #f0d8c8;color:#3c1a20;}\n' +
      '[data-theme="alice"] .iter-table tr.cur-row td{background:rgba(232,160,32,0.2);}\n' +
      '[data-theme="alice"] .iter-table tr.done-row td{background:rgba(200,112,144,0.15);color:#c87090;}\n' +
      '[data-theme="alice"] .var-chip{background:#faebd7;border-color:#e8c4aa;color:#3c1a20;}\n' +
      '[data-theme="alice"] .var-chip.highlight{background:rgba(232,160,32,0.2);}\n' +
      '$1'
    );
  }

  // prime-sieve: CSS 内 .state-composite アリス override を追加
  if (filename === 'algo-prime-sieve.html') {
    html = html.replace(
      '.state-composite{background:rgba(46,50,80,.6);color:rgba(136,146,176,.5);}',
      '.state-composite{background:rgba(46,50,80,.6);color:rgba(136,146,176,.5);}\n' +
      '[data-theme="alice"] .state-composite{background:rgba(200,180,160,.5);color:rgba(60,26,32,.5);}\n' +
      '[data-theme="alice"] .legend-dot[style*="rgba(46,50,80"]{background:rgba(200,180,160,.6)!important;}'
    );
  }

  return html;
}

// ───────────────────────────────────────────────────────────
function processMaze() {
  let html = readFile(path.join(SRC_WORK, 'algo-maze.html'));

  // alice の追加 CSS を [data-theme="alice"] で取り込む
  const extraCss =
    '<style>\n' +
    '[data-theme="alice"] #viz-container { padding: 12px; }\n' +
    '[data-theme="alice"] #info-msg {\n' +
    '  position: static;\n' +
    '  transform: none;\n' +
    '  text-align: center;\n' +
    '  margin: 0 auto 6px;\n' +
    '  flex-shrink: 0;\n' +
    '}\n' +
    '</style>';
  // work 版の既存 <style> を alice 対応版に差し替え
  html = html.replace('<style>#viz-container{padding:12px;}</style>', extraCss);

  // substituteScriptColors を colorMap 置換前に実施（maze モード）
  html = substituteScriptColors(html, true);

  // maze colorMap を getVizColors().maze に変換（CRLF 対応: [\s\S]*? を使用）
  const mazeMapRe = /const colorMap\s*=\s*\{[\s\S]*?goal:[\s\S]*?\};\s*/;
  const mazeMapReplacement =
    "const vc = window.getVizColors ? window.getVizColors() : null;\n" +
    "  const colorMap = vc ? vc.maze : {\n" +
    "    wall:      '#0f1117',\n" +
    "    unvisited: '#1a1d27',\n" +
    "    frontier:  'rgba(245,197,66,0.5)',\n" +
    "    visited:   'rgba(79,142,247,0.35)',\n" +
    "    current:   '#f5c542',\n" +
    "    path:      '#3ecf6a',\n" +
    "    start:     '#4f8ef7',\n" +
    "    goal:      '#f08c3a',\n" +
    "  };\n";
  html = html.replace(mazeMapRe, mazeMapReplacement);

  // ── 迷路サイズ: 10行×12列 ──
  html = html.replace(
    /const MAZE = \[\r?\n([\s\S]*?)\];\r?\nconst START/,
    'const MAZE = [\n' +
    '  [1,1,1,1,1,1,1,1,1,1,1,1],\n' +
    '  [1,0,0,0,1,0,0,0,0,0,0,1],\n' +
    '  [1,0,1,0,1,0,1,1,1,1,1,1],\n' +
    '  [1,0,1,0,0,0,1,0,0,0,1,1],\n' +
    '  [1,0,1,1,1,1,1,0,1,0,1,1],\n' +
    '  [1,0,0,0,0,0,0,0,1,0,0,1],\n' +
    '  [1,1,1,0,1,1,1,1,1,0,1,1],\n' +
    '  [1,0,0,0,1,0,0,0,0,0,0,1],\n' +
    '  [1,0,1,1,1,0,1,1,1,1,1,1],\n' +
    '  [1,1,1,1,1,1,1,1,1,1,1,1],\n' +
    '];\nconst START'
  );
  html = html.replace('const GOAL  = [9, 11];', 'const GOAL  = [7, 10];');

  // 迷路外枠の背景色を CSS 変数化
  html = html.replace(/background:#0a0c12;/g, 'background:var(--viz-maze-border);');
  html = html.replace(/border:1px solid #2e3250/g, 'border:1px solid var(--viz-maze-outer)');

  // ── アリスモード: かわいい見た目への分岐 ──
  // isAliceMaze フラグを renderViz 先頭に追加
  html = html.replace(
    /window\.renderViz = function\(step\) \{(\r?\n)\s*const \{ states \}/,
    "window.renderViz = function(step) {\n  const isAliceMaze = document.documentElement.getAttribute('data-theme') === 'alice';\n  const { states }"
  );

  // Start/Goal ラベル: S/G → alice時は🍀/❤️
  html = html.replace(
    /if \(r===START\[0\]&&c===START\[1\]\) label = 'S';\r?\n\s*else if \(r===GOAL\[0\]&&c===GOAL\[1\]\) label = 'G';/,
    "if (r===START[0]&&c===START[1]) label = isAliceMaze ? '🍀' : 'S';\n      else if (r===GOAL[0]&&c===GOAL[1]) label = isAliceMaze ? '❤️' : 'G';"
  );

  // 外枠グリッドスタイルをアリス分岐（dark: _C.maze.wall変数, alice: 金枠+影）
  // substituteScriptColors 後の実際の文字列に合わせてマッチ
  html = html.replace(
    /let html = `<div style="display:inline-grid;grid-template-columns:repeat\(\$\{states\[0\]\.length\},\$\{CELL\}px\);gap:2px;background:'\+\(_C\.maze\?_C\.maze\.wall:''\+\(_C\.darkBg\|\|'#0a0c12'\)\+''\)\+';padding:4px;border-radius:6px;border:1px solid '\+\(_C\.edge\|\|'#2e3250'\)\+'">`/,
    "const outerStyle = isAliceMaze\n" +
    "    ? `background:#1a4d2e;padding:6px;border-radius:12px;border:3px solid #c9a227;box-shadow:0 4px 20px rgba(26,77,46,.35)`\n" +
    "    : `background:${_C.maze?_C.maze.wall:(_C.darkBg||'#0a0c12')};padding:4px;border-radius:6px;border:1px solid ${_C.edge||'#2e3250'}`;\n" +
    "  let html = `<div style=\"display:inline-grid;grid-template-columns:repeat(${states[0].length},${CELL}px);gap:2px;${outerStyle}\">`"
  );

  // セルスタイル: border-radius / font-size / color をアリス分岐
  html = html.replace(
    /border-radius:\$\{isBorder\?'2px':'4px'\};/,
    "border-radius:\${isAliceMaze?(isBorder?'3px':'6px'):(isBorder?'2px':'4px')};"
  );
  html = html.replace(
    /font-size:\$\{CELL>24\?'\.98rem':'\.77rem'\};/,
    "font-size:\${label?(isAliceMaze?'1.1rem':'.98rem'):(CELL>24?'.98rem':'.77rem')};"
  );
  // color: isAliceMaze 分岐（単純な文字列置換で対応）
  html = html.replace(
    "color:${state==='start'?'#fff':state==='goal'?'#fff':state==='current'?'#000':(_C.nodeText||'rgba(255,255,255,0.8)')};",
    "color:\${isAliceMaze?'#3c1a20':(state==='start'?'#fff':state==='goal'?'#fff':state==='current'?'#000':(_C.nodeText||'rgba(255,255,255,0.8)'))};",
  );

  // 凡例ラベルをアリス分岐
  html = html.replace(
    `></span>S: スタート</span>`,
    `></span>\${isAliceMaze?'🍀 スタート':'S: スタート'}</span>`
  );
  html = html.replace(
    `></span>G: ゴール</span>`,
    `></span>\${isAliceMaze?'❤️ ゴール':'G: ゴール'}</span>`
  );

  html = insertThemeScript(html);
  html = injectVarC(html);
  return html;
}


// ───────────────────────────────────────────────────────────
// 特殊ファイル: algo-union-find.html
// alice 版の追加機能（operation label, COMP_COLORS）を取り込む
// ───────────────────────────────────────────────────────────
function processUnionFind() {
  // alice 版をベースにして CSS 変数化
  let html = readFile(path.join(SRC_ALICE, 'algo-union-find.html'));

  // COMP_COLORS を getVizColors().comp に変換
  html = html.replace(
    "var COMP_COLORS = ['#6898d0', '#c87090', '#c84060', '#b878d0', '#d08030'];",
    "var vc = window.getVizColors ? window.getVizColors() : null;\n" +
    "  var COMP_COLORS = vc ? vc.comp : ['#4f8ef7', '#3ecf6a', '#e05c5c', '#c084fc', '#f08c3a'];"
  );

  // alice の dim 色 → CSS 変数（オブジェクトリテラル内の fill 値）
  // fill: '#9c6b72' を動的取得に変換
  html = html.replace(
    /fill: '#9c6b72'/g,
    "fill: (getComputedStyle(document.documentElement).getPropertyValue('--dim').trim() || '#9c6b72')"
  );

  // isHL 時のハイライト色をテーマ対応
  html = html.replace(
    "var strokeColor = isHL ? '#e8a020' : baseColor;",
    "var strokeColor = isHL ? (window.getVizColors ? window.getVizColors()['compare'] : '#f5c542') : baseColor;"
  );
  html = html.replace(
    "var fillColor = isHL ? 'rgba(232,160,32,0.18)' : (baseColor + '22');",
    "var fillColor = isHL ? 'rgba(79,142,247,0.18)' : (baseColor + '22');"
  );
  html = html.replace(
    "var textColor = isHL ? '#e8a020' : '#3c1a20';",
    "var textColor = isHL ? (window.getVizColors ? window.getVizColors()['compare'] : '#f5c542') : (window.getVizColors ? window.getVizColors()['text'] : '#e2e8f0');"
  );

  html = insertThemeScript(html);
  html = substituteScriptColors(html, false);
  html = injectVarC(html);
  return html;
}
// インライン CSS ブロック全体を CSS 変数ベースに変換
// ───────────────────────────────────────────────────────────
const VIZ_CSS_MERGED =
`@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Lato:wght@400;700&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg,#0f1117); color: var(--text,#e2e8f0); font-family: var(--vz-font,'Segoe UI',system-ui,sans-serif); height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
header { background: var(--vz-hdr-bg,#1a1d27); padding: 12px 20px; display: flex; align-items: center; gap: 16px; border-bottom: var(--vz-hdr-border,1px solid #2d3148); flex-shrink: 0; }
header h1 { font-size: 1.1rem; color: var(--vz-h1,#4f8ef7); white-space: nowrap; font-family: var(--vz-title-font,inherit); }
select { background: var(--surface2,#252836); color: var(--text,#e2e8f0); border: 1px solid var(--border,#3d4166); padding: 6px 12px; border-radius: var(--vz-radius,6px); font-size: 0.9rem; cursor: pointer; }
.main { display: grid; grid-template-columns: 1fr 380px; flex: 1; overflow: hidden; padding-bottom: 60px; }
.left-panel { display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid var(--border,#2d3148); }
.viz-panel { background: var(--surface,#1a1d27); flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.viz-panel svg { flex: 1; width: 100%; min-height: 0; }
.description-bar { padding: 8px 16px; background: var(--surface2,#252836); font-size: 0.85rem; color: var(--dim,#a0aec0); min-height: 36px; border-top: 1px solid var(--border,#2d3148); flex-shrink: 0; }
.trace-panel { background: var(--surface,#1a1d27); border-top: 1px solid var(--border,#2d3148); overflow-y: auto; height: 200px; flex-shrink: 0; }
.trace-panel table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.trace-panel th { background: var(--surface2,#252836); padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--border,#2d3148); position: sticky; top: 0; color: var(--vz-th-color,#4f8ef7); z-index: 1; font-family: var(--vz-th-font,inherit); font-size: var(--vz-th-size,0.8rem); }
.trace-panel td { padding: 5px 10px; border-bottom: 1px solid var(--vz-td-border,#1e2133); color: var(--text,#e2e8f0); }
.trace-panel tr.active td { background: var(--vz-active-bg,#1e3a5f); color: var(--text,#e2e8f0); }
.trace-panel tr:not(.active) td { color: var(--dim,#718096); }
.code-panel { background: var(--vz-code-bg,#131620); overflow-y: auto; font-family: Consolas, 'Cascadia Code', monospace; font-size: 0.82rem; padding: 8px 0; }
.code-line { display: flex; padding: 1px 0; line-height: 1.6; min-height: 22px; }
.code-line .ln { color: var(--dim,#4a5568); min-width: 36px; text-align: right; padding-right: 12px; user-select: none; }
.code-line .lc { flex: 1; padding-left: 4px; white-space: pre; color: var(--text,#cbd5e0); }
.code-line.active { background: var(--vz-codeline-bg,#1a3a6e); border-left: 3px solid var(--accent,#4f8ef7); }
.code-line.active .lc { color: var(--vz-codeline-color,#fff); }
.controls { position: fixed; bottom: 0; left: 0; right: 0; background: var(--vz-ctrl-bg,#1a1d27); border-top: var(--vz-ctrl-border,1px solid #2d3148); padding: 10px 20px; display: flex; align-items: center; gap: 10px; height: 60px; z-index: 100; }
.btn { background: var(--surface2,#252836); color: var(--vz-btn-color,#e2e8f0); border: 1px solid var(--border,#3d4166); padding: 6px 14px; border-radius: var(--vz-radius,6px); cursor: pointer; font-size: 0.85rem; font-family: var(--vz-btn-font,inherit); }
.btn:hover { background: var(--border,#3d4166); }
.btn.primary { background: var(--vz-btn-primary,#4f8ef7); border-color: var(--vz-btn-primary,#4f8ef7); color: var(--vz-btn-primary-text,#fff); font-weight: var(--vz-btn-primary-weight,400); }
.btn.primary:hover { filter: brightness(1.1); }
.speed-label { color: var(--dim,#a0aec0); font-size: 0.8rem; }
input[type=range] { accent-color: var(--accent,#4f8ef7); width: 80px; }
.step-counter { color: var(--dim,#a0aec0); font-size: 0.85rem; margin-left: auto; white-space: nowrap; }
:root { --vz-font:'Segoe UI',system-ui,sans-serif; --vz-h1:#4f8ef7; --vz-title-font:inherit; --vz-hdr-bg:#1a1d27; --vz-hdr-border:1px solid #2d3148; --vz-radius:6px; --vz-th-color:#4f8ef7; --vz-th-font:inherit; --vz-th-size:0.8rem; --vz-td-border:#1e2133; --vz-active-bg:#1e3a5f; --vz-code-bg:#131620; --vz-codeline-bg:#1a3a6e; --vz-codeline-color:#fff; --vz-ctrl-bg:#1a1d27; --vz-ctrl-border:1px solid #2d3148; --vz-btn-color:#e2e8f0; --vz-btn-primary:#4f8ef7; --vz-btn-primary-text:#fff; --vz-btn-primary-weight:400; --vz-btn-font:inherit; }
[data-theme="alice"] { --bg:#fdf5e6; --surface:#fffbf5; --surface2:#faebd7; --border:#e8c4aa; --text:#3c1a20; --dim:#9c6b72; --accent:#9b2335; --vz-font:'Lato','Segoe UI',system-ui,sans-serif; --vz-h1:#fce4b0; --vz-title-font:'Cinzel Decorative',cursive; --vz-hdr-bg:linear-gradient(135deg,#6a1028,#9b2335); --vz-hdr-border:3px solid #c9a227; --vz-radius:20px; --vz-th-color:#7a1525; --vz-th-font:'Cinzel Decorative',cursive; --vz-th-size:0.72rem; --vz-td-border:rgba(232,196,170,.35); --vz-active-bg:rgba(155,35,53,.1); --vz-code-bg:#fffbf5; --vz-codeline-bg:rgba(155,35,53,.12); --vz-codeline-color:#3c1a20; --vz-ctrl-bg:linear-gradient(135deg,#6a1028,#9b2335); --vz-ctrl-border:3px solid #c9a227; --vz-btn-color:#fce4b0; --vz-btn-primary:#c9a227; --vz-btn-primary-text:#3c1a20; --vz-btn-primary-weight:700; --vz-btn-font:'Lato',sans-serif; }
[data-theme="alice"] header::after { content: '♠ ♥ ♦ ♣ ♠ ♥ ♦ ♣ ♠ ♥ ♦ ♣'; position: absolute; right: -8px; top: 50%; transform: translateY(-50%); font-size: .95rem; color: rgba(255,255,255,.12); letter-spacing: .55rem; white-space: nowrap; pointer-events: none; }
[data-theme="alice"] header { position: relative; overflow: hidden; }`;

function processVisualizer() {
  let html = readFile(path.join(SRC_WORK, 'algo-visualizer.html'));

  // <style>...</style> ブロックを置換（最初の1つだけ）
  const styleRe = /<style>([\s\S]*?)<\/style>/;
  html = html.replace(styleRe, '<style>\n' + VIZ_CSS_MERGED + '\n</style>');

  // visualizer の cm オブジェクト（独自 colorMap）を動的化
  const cmRe = /const cm\s*=\s*\{[^}]+\};/;
  const cmReplacement =
    "const _vc = window.getVizColors ? window.getVizColors() : null;\n" +
    "  const cm = _vc ? {\n" +
    "    default: _vc.edge, comparing: _vc.compare, swapping: _vc.swap,\n" +
    "    sorted: _vc.sorted, pivot: _vc.min, found: _vc.sorted,\n" +
    "    current: _vc.compare, inactive: _vc.border\n" +
    "  } : {\n" +
    "    default:'#4f8ef7',comparing:'#f6c90e',swapping:'#e74c3c',sorted:'#2ecc71',\n" +
    "    pivot:'#f39c12',found:'#2ecc71',current:'#f6c90e',inactive:'#2d3148'\n" +
    "  };";
  html = html.replace(cmRe, cmReplacement);

  html = substituteScriptColors(html, false);

  // _C をスクリプトグローバルとして注入し、renderStep でリフレッシュ
  // ALGORITHMS の render メソッドからもアクセス可能にする
  html = html.replace(
    /(<script\b(?![^>]*src)[^>]*>)/,
    '$1\nvar _C = window.getVizColors ? window.getVizColors() : {};\n'
  );
  html = html.replace(
    /(function renderStep\s*\([^)]*\)\s*\{)/,
    '$1\n  _C = window.getVizColors ? window.getVizColors() : {};'
  );
  // テーマトグル時に再描画できるよう window.renderViz を定義（スクリプト末尾に追加）
  html = html.replace(
    /(<\/script>)/,
    '\nwindow.renderViz = function() { if (typeof renderStep === \'function\') renderStep(currentStep || 0); };\n$1'
  );

  html = insertThemeScript(html);
  return html;
}

// ───────────────────────────────────────────────────────────
// CSS セレクタに prefix を付けるユーティリティ
// alice CSS の全ルールを [data-theme="alice"] 配下にスコープする
// ───────────────────────────────────────────────────────────
function prefixAllSelectors(css, prefix) {
  // @import を行単位で削除（URL 内に ; が含まれるため行フィルタが確実）
  css = css.split(/\r?\n/).filter(line => !line.trim().startsWith('@import')).join('\n');
  // @font-face を削除
  css = css.replace(/@font-face\s*\{[^}]*\}\s*/g, '');

  let result = '';
  let remaining = css;

  while (remaining.length > 0) {
    // 次の '{' を探す
    const braceIdx = remaining.indexOf('{');
    if (braceIdx < 0) {
      result += remaining;
      break;
    }

    const selectorRaw = remaining.substring(0, braceIdx);
    // コメントをセレクタから取り出し、前に出力しておく
    let leadingComment = '';
    const commentMatch = selectorRaw.match(/^([\s\S]*?)(\/\*[\s\S]*?\*\/\s*)([\s\S]*)$/);
    let selectorClean = selectorRaw;
    if (commentMatch && commentMatch[3].trim()) {
      // "comment + actual-selector" の形式
      leadingComment = commentMatch[1] + commentMatch[2];
      selectorClean  = commentMatch[3];
    }
    const sel = selectorClean.trim();

    // 対応する '}' を探す（ネスト対応）
    let depth = 1;
    let j = braceIdx + 1;
    while (j < remaining.length && depth > 0) {
      if (remaining[j] === '{') depth++;
      else if (remaining[j] === '}') depth--;
      j++;
    }
    const body = remaining.substring(braceIdx + 1, j - 1);
    remaining = remaining.substring(j);

    // 空セレクタ・コメントのみはそのまま
    if (!sel || sel.startsWith('/*')) {
      result += leadingComment + selectorClean + '{' + body + '}';
      continue;
    }

    // *, *::before, *::after リセット → work 側にあるのでスキップ
    if (/^\*\s*,?\s*\*::/.test(sel) || sel === '*') continue;

    // html { scroll-behavior } はテーマ非依存 → スキップ
    if (/^html\s*$/.test(sel)) continue;

    // @at-rule はそのまま（@keyframes 等）
    if (sel.startsWith('@')) {
      result += leadingComment + sel + ' {' + body + '}\n';
      continue;
    }

    // :root → [data-theme="alice"]
    if (sel === ':root') {
      result += leadingComment + '\n' + prefix + ' {\n' + body + '}\n';
      continue;
    }

    // それ以外: カンマ区切りのセレクタそれぞれに prefix を付与
    const prefixed = sel.split(',').map(s => {
      const t = s.trim();
      if (!t) return '';
      if (t.startsWith(prefix)) return t;       // 既にプレフィックス済み
      return prefix + ' ' + t;
    }).filter(Boolean).join(',\n');

    result += leadingComment + '\n' + prefixed + ' {\n' + body + '}\n';
  }

  return result;
}

// ───────────────────────────────────────────────────────────
// 特殊ファイル: index.html
// ───────────────────────────────────────────────────────────
function processIndex() {
  let workHtml  = readFile(path.join(SRC_WORK,  'index.html'));
  let aliceHtml = readFile(path.join(SRC_ALICE, 'index.html'));

  // alice の <style> ブロックを取得
  const styleRe = /<style>([\s\S]*?)<\/style>/;
  const aliceMatch = aliceHtml.match(styleRe);
  const workMatch  = workHtml.match(styleRe);
  if (!aliceMatch || !workMatch) return workHtml;

  let aliceCss = aliceMatch[1];
  let workCss  = workMatch[1];

  // ── レイアウト正規化: dark テーマのヘッダーを alice のレイアウト値に揃える ──
  // （色は dark のまま、位置/余白だけ alice に合わせる）
  workCss = workCss
    // header padding を alice に合わせる
    .replace('padding: 1.2rem 2rem 1rem;', 'padding: 1.8rem 2rem 1.5rem;')
    // header border-bottom 厚みを 4px に統一（色は dark のまま）
    .replace('border-bottom: 1px solid var(--border);', 'border-bottom: 4px solid var(--border);')
    // h1 font-size を alice に合わせる
    .replace('font-size: clamp(1.3rem, 3vw, 1.9rem);', 'font-size: clamp(1.2rem, 2.8vw, 1.85rem);')
    // h1 letter-spacing を alice に合わせる（alice はデフォルト=指定なし）
    .replace('      letter-spacing: .02em;\n', '')
    // h1 margin-bottom
    .replace('margin-bottom: .3rem;', 'margin-bottom: .35rem;')
    // badge margin-top
    .replace('margin-top: 1rem;', 'margin-top: .9rem;')
    // badge padding を alice に合わせる
    .replace('padding: .3rem .9rem;', 'padding: .3rem 1rem;');

  // ── カードサイズをダークモードに統一（パディング・枠・角丸）──
  aliceCss = aliceCss
    .replace('padding: 1.25rem 1.25rem 2rem;', 'padding: 1.25rem 1.25rem 1.1rem;')
    .replace('border-radius: 14px;', 'border-radius: 12px;')
    .replace('border: 2px solid var(--border);', 'border: 1px solid var(--border);');

  // alice CSS の全セレクタを [data-theme="alice"] 配下にスコープ
  const aliceScoped = prefixAllSelectors(aliceCss, '[data-theme="alice"]');

  const mergedCss = workCss + '\n\n/* ── Alice テーマ オーバーライド ── */\n' + aliceScoped + `

/* ── Theme Toggle Button ── */
.theme-toggle-btn {
  font-size: .82rem;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid #22253a;
  background: #181b2a;
  color: #6b7390;
  white-space: nowrap;
  transition: background .15s, color .15s;
}
.theme-toggle-btn:hover {
  background: #1e2235;
  color: #9aa0b8;
}
[data-theme="alice"] .theme-toggle-btn {
  background: rgba(94,14,34,0.55);
  color: #fce4b0;
  border-color: rgba(220,100,120,0.45);
}
[data-theme="alice"] .theme-toggle-btn:hover {
  background: rgba(120,20,45,0.75);
  border-color: rgba(220,100,120,0.7);
}`;

  // Google Fonts link タグを追加
  const fontsLink =
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700' +
    '&family=Lato:ital,wght@0,300;0,400;0,700;1,400&display=swap" rel="stylesheet">\n';

  let result = workHtml
    .replace(workMatch[0], '<style>' + mergedCss + '</style>')
    .replace('<head>\n', '<head>\n' + fontsLink);

  result = insertThemeScript(result);
  return result;
}

// ───────────────────────────────────────────────────────────
// メイン処理
// ───────────────────────────────────────────────────────────
function main() {
  fs.mkdirSync(DST, { recursive: true });

  // コピーのみのファイル（JS 等）
  const copyOnly = [
    'algo-common.js',
    'shell_sort_test.js',
    'union_find.js',
    'validate_pq.js',
    'verify_mono.js',
  ];
  for (const fn of copyOnly) {
    const src = path.join(SRC_WORK, fn);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DST, fn));
      console.log(`  copy: ${fn}`);
    }
  }

  // 特殊処理ファイル
  const special = {
    'algo-maze.html':        processMaze,
    'algo-union-find.html':  processUnionFind,
    'algo-visualizer.html':  processVisualizer,
    'index.html':            processIndex,
  };

  // HTML ファイル一覧
  const htmlFiles = fs.readdirSync(SRC_WORK)
    .filter(f => f.endsWith('.html'))
    .sort();

  let count = 0;
  for (const fn of htmlFiles) {
    const dstPath = path.join(DST, fn);
    let html;
    if (special[fn]) {
      html = special[fn]();
      console.log(`  special: ${fn}`);
    } else {
      html = processStandardHtml(fn);
      console.log(`  standard: ${fn}`);
    }
    writeFile(dstPath, html);
    count++;
  }

  console.log(`\n完了: ${DST}`);
  console.log(`処理ファイル数: ${count}`);
}

main();

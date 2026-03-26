// Simulate shell sort generateSteps
var arr = [8, 3, 6, 1, 9, 2, 7, 4, 5];
var n = arr.length;
var steps = [];
var stepNum = 0;

function addStep(codeLine, gapV, iV, jV, keyV, ajgV, op, statesOvr) {
  var states = statesOvr;
  if (!states) {
    states = new Array(n).fill('default');
    if (iV >= 0) states[iV] = 'key';
    if (jV >= 0) states[jV] = 'key';
  }
  steps.push({
    codeLine: codeLine,
    description: op,
    vizData: { arr: arr.slice(), states: states, gap: gapV, i: iV, j: jV, key: keyV },
    traceRow: {
      'ステップ': ++stepNum,
      'gap': gapV >= 0 ? gapV : '-',
      'i': iV >= 0 ? iV : '-',
      'j': jV >= 0 ? jV : '-',
      'key': keyV !== null ? keyV : '-',
      'arr[j-gap]': ajgV !== null ? ajgV : '-',
      '操作': op
    }
  });
}

addStep(0, -1, -1, -1, null, null, 'shellSort([8,3,6,1,9,2,7,4,5])');

var gap = Math.floor(n / 2);
addStep(1, gap, -1, -1, null, null, 'gap = Math.floor(9/2) = ' + gap);

while (gap > 0) {
  addStep(2, gap, -1, -1, null, null, 'gap(' + gap + ') > 0 → true');
  for (var i = gap; i < n; i++) {
    addStep(3, gap, i, -1, null, null, 'i = ' + i);
    var key = arr[i];
    addStep(4, gap, i, -1, key, null, 'key = arr[' + i + '] = ' + key);
    var j = i;
    addStep(5, gap, i, j, key, null, 'j = i = ' + j);
    while (true) {
      var cond = (j >= gap) && (arr[j - gap] > key);
      var ajg = j >= gap ? arr[j - gap] : null;
      var cs = new Array(n).fill('default');
      cs[j] = 'key';
      if (j >= gap) cs[j - gap] = 'compare';
      var condDesc = j < gap
        ? 'j(' + j + ') < gap(' + gap + ') → false'
        : 'j(' + j + ')>=gap(' + gap + ') && arr[' + (j - gap) + '](' + ajg + ') > key(' + key + ') → ' + cond;
      addStep(6, gap, i, j, key, ajg, condDesc, cs);
      if (!cond) break;
      var sv = arr[j - gap];
      var ss = new Array(n).fill('default');
      ss[j] = 'shift';
      ss[j - gap] = 'compare';
      arr[j] = sv;
      addStep(7, gap, i, j, key, sv, 'arr[' + j + '] ← arr[' + (j - gap) + '] = ' + sv + '  シフト', ss);
      j -= gap;
      var js = new Array(n).fill('default');
      js[j] = 'key';
      addStep(8, gap, i, j, key, j >= gap ? arr[j - gap] : null, 'j -= gap → j = ' + j, js);
    }
    var ins = new Array(n).fill('default');
    ins[j] = 'key';
    arr[j] = key;
    addStep(10, gap, i, j, key, null, 'arr[' + j + '] = key = ' + key + '  [' + arr.join(',') + ']', ins);
  }
  gap = Math.floor(gap / 2);
  addStep(12, gap, -1, -1, null, null, 'gap = Math.floor(gap/2) = ' + gap);
}

var fs = new Array(n).fill('sorted');
addStep(2, 0, -1, -1, null, null, 'gap(0) > 0 → false、ループ終了', fs);
addStep(14, 0, -1, -1, null, null, 'return [' + arr.join(',') + ']', fs.slice());

console.log('Final array:', arr.join(','));
console.log('Total steps:', steps.length);
var badLines = steps.filter(function(s){ return [9,11,13,15].indexOf(s.codeLine) >= 0; });
console.log('Steps with } codeLine:', badLines.length);
if (badLines.length > 0) badLines.forEach(function(s){ console.log('  bad step:', s.codeLine, s.description); });
console.log('All codeLines used:', [...new Set(steps.map(function(s){return s.codeLine;}) )].sort(function(a,b){return a-b;}));

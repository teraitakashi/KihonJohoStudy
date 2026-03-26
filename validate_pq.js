// File: validate.js  (run with: node validate.js)
var window = {};
var fs = require('fs');
var html = fs.readFileSync('C:/Users/v011u/copilot_work/algo-priority-queue.html', 'utf8');

// Extract the script block content  
var scriptMatch = html.match(/<script src="algo-common\.js"><\/script>\s*<script>([\s\S]+?)<\/script>/);
if (!scriptMatch) { console.log('ERROR: script block not found'); process.exit(1); }

eval(scriptMatch[1].replace('window.renderViz = function(step) {', 'window.renderViz = function(step) { return; // skip DOM'));

var s = window.generateSteps();
console.log('Total steps:', s.length);

// Check dequeue return values
var deqReturns = s.filter(function(st) {
  return st.traceRow['操作'] === 'dequeue' && st.traceRow['説明'].indexOf('return') === 0;
});
deqReturns.forEach(function(st) {
  console.log('dequeued:', st.traceRow['値'], '| heap after:', st.traceRow['heap']);
});
console.log('Final heap:', s[s.length-1].traceRow['heap']);

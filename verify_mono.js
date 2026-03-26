var par=[0,1,2,3,4,5,6], rnk=[0,0,0,0,0,0,0], steps=[];
function snap(l){ steps.push(l); }
function doFind(origX){
  var x=origX, root=origX;
  snap(2); snap(3);
  snap(4);
  while(par[root]!==root){ root=par[root]; snap(5); snap(4); }
  snap(6);
  while(par[x]!==root){ var nxt=par[x]; par[x]=root; snap(7); snap(8); x=nxt; snap(9); snap(6); }
  snap(11);
  return root;
}
function doUnion(x,y){
  snap(13); snap(14);
  var rx=doFind(x);
  snap(15);
  var ry=doFind(y);
  snap(16);
  if(rx===ry)return;
  if(rnk[rx]<rnk[ry]){ snap(17); par[rx]=ry; }
  else if(rnk[rx]>rnk[ry]){ snap(18); par[ry]=rx; }
  else{ snap(19); par[ry]=rx; rnk[rx]++; }
}
snap(0); snap(1);
doUnion(0,1); doUnion(2,3); doUnion(4,5); doUnion(1,4); doUnion(2,6);
doFind(0); doFind(6);
var bad=[];
for(var i=1;i<steps.length;i++){
  if(steps[i]<steps[i-1]) bad.push('step '+i+': '+steps[i-1]+'->'+steps[i]);
}
if(bad.length===0){ console.log('OK – no backwards jumps, total steps: '+steps.length); }
else{ console.log('BACKWARDS FOUND:'); bad.forEach(function(b){console.log('  '+b);}); }

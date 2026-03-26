var par=[0,1,2,3,4,5,6],rnk=[0,0,0,0,0,0,0];
function find(x){var p=[],c=x;while(par[c]!==c){p.push(c);c=par[c];}p.forEach(function(n){par[n]=c;});return c;}
function union(x,y){var rx=find(x),ry=find(y);if(rx===ry)return;if(rnk[rx]<rnk[ry])par[rx]=ry;else if(rnk[rx]>rnk[ry])par[ry]=rx;else{par[ry]=rx;rnk[rx]++;}}
union(0,1); console.log('after u(0,1): par='+par.join(',')+' rnk='+rnk.join(','));
union(2,3); console.log('after u(2,3): par='+par.join(',')+' rnk='+rnk.join(','));
union(4,5); console.log('after u(4,5): par='+par.join(',')+' rnk='+rnk.join(','));
union(1,4); console.log('after u(1,4): par='+par.join(',')+' rnk='+rnk.join(','));
union(2,6); console.log('after u(2,6): par='+par.join(',')+' rnk='+rnk.join(','));
console.log('find(0)='+find(0)+' par='+par.join(','));
console.log('find(6)='+find(6)+' par='+par.join(','));

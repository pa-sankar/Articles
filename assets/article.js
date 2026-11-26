
function foldMap(s){ // folded text + each folded char's index in s (diacritics removed per char)
  var out='', idx=[];
  for (var i=0;i<s.length;i++){
    var f=s[i].normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
    for (var k=0;k<f.length;k++){ out+=f[k]; idx.push(i); }
  }
  return {t:out, idx:idx};
}
function fold(s){ return foldMap(s).t; }
function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function makeMatcher(term, mode){ // a new RegExp each time: a 'g' RegExp keeps lastIndex
  var body=escRe(fold(term));
  var p = mode==='full' ? '(?<![\\p{L}\\p{N}])('+body+')(?![\\p{L}\\p{N}])'
        : mode==='partial' ? '(?<![\\p{L}\\p{N}])('+body+')' : '('+body+')';
  return new RegExp(p,'gu');
}
function findAll(text, term, mode){ // [[start,end] in the ORIGINAL text]
  if (!term) return [];
  var fm=foldMap(text), re=makeMatcher(term,mode), m, out=[];
  while ((m=re.exec(fm.t))){ if (!m[0]) { re.lastIndex++; continue; }
    out.push([fm.idx[m.index], fm.idx[m.index+m[0].length-1]+1]); }
  return out;
}
function markHtml(text, term, mode){ // escaped text with <mark>s
  var e=function(s){return s.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
  var r=findAll(text,term,mode), out='', at=0;
  r.forEach(function(x){ out+=e(text.slice(at,x[0]))+'<mark>'+e(text.slice(x[0],x[1]))+'</mark>'; at=x[1]; });
  return out+e(text.slice(at));
}
function articleInit(){
// one flow per article (user, 2026-11-26): no page tabs. Each page break is an invisible anchor
// (.pgm: #p-<printed> / #pdf-<n>) carrying its printed label and PDF page; the floating badge
// shows the one on screen, and its panel switches the display and jumps to a page
function store(k, v){ try { if (v===undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch(e){ return null; } }
// the reading note at the top stays folded once the reader folds it (this browser only)
var howto=document.querySelector('details.howto');
if (howto){ if (store('art-howto')==='folded') howto.open=false;
  howto.addEventListener('toggle', function(){ store('art-howto', howto.open ? 'open' : 'folded'); }); }
var pgms=Array.prototype.slice.call(document.querySelectorAll('.pgm'));
var pgMode=store('art-pgmode')||'both', loadedAt=Date.now();
function pgText(m){ return pgMode==='printed' ? m.dataset.l : pgMode==='pdf' ? m.dataset.pdf : m.dataset.l+' · '+m.dataset.pdf; }
function onScreenPg(){ var y=window.innerHeight*0.35, at=pgms[0];
  for (var i=0;i<pgms.length;i++){ if (pgms[i].getBoundingClientRect().top>y) break; at=pgms[i]; }
  return at; }
var tools=document.createElement('div'); tools.className='pgtools';
tools.innerHTML='<div class="pgpanel" hidden role="dialog" aria-label="Page display and jump to page">'
  +'<fieldset><legend>Show page as</legend>'
  +'<label><input type="radio" name="pg-show" value="printed"> Printed</label>'
  +'<label><input type="radio" name="pg-show" value="pdf"> PDF</label>'
  +'<label><input type="radio" name="pg-show" value="both"> Both</label></fieldset>'
  +'<fieldset><legend>Jump to page</legend><div class="jmsg jrange"></div>'
  +'<label><input type="radio" name="pg-jump" value="printed"> Printed page</label>'
  +'<label><input type="radio" name="pg-jump" value="pdf"> PDF page</label>'
  +'<div class="jrow"><input type="text" autocomplete="off" aria-label="Page to jump to">'
  +'<button type="button" class="pgpanel-go">Go</button></div>'
  +'<div class="jmsg" aria-live="polite"></div></fieldset></div>'
  +'<button type="button" class="gotop" hidden title="Back to the top of the article">&#8593; Top</button>'
  +'<button type="button" class="pgbadge" aria-expanded="false" title="The page you are reading. Click to show printed or PDF page numbers, or to jump to a page"></button>';
document.body.appendChild(tools);
var panel=tools.querySelector('.pgpanel'), badge=tools.querySelector('.pgbadge'), goTop=tools.querySelector('.gotop'),
    jin=panel.querySelector('input[type=text]'), jmsg=panel.querySelector('.jmsg:not(.jrange)'),
    jrange=panel.querySelector('.jrange');
if (!pgms.length){ badge.hidden=true; }
panel.querySelector('input[name=pg-show][value='+pgMode+']').checked=true;
panel.querySelector('input[name=pg-jump][value='+(pgMode==='pdf'?'pdf':'printed')+']').checked=true;
function setOpen(o){ panel.hidden=!o; badge.setAttribute('aria-expanded', o?'true':'false');
  if (o){ jmsg.textContent=''; jmsg.className='jmsg'; jrange.textContent=range(); jin.focus(); } }
badge.addEventListener('click', function(){ setOpen(panel.hidden); });
document.addEventListener('click', function(e){ if (!panel.hidden && !tools.contains(e.target)) setOpen(false); });
document.addEventListener('keydown', function(e){ if (e.key==='Escape' && !panel.hidden){ setOpen(false); badge.focus(); } });
panel.querySelectorAll('input[name=pg-show]').forEach(function(r){ r.addEventListener('change', function(){
  pgMode=r.value; store('art-pgmode', pgMode); lastPg=null; update(); }); });
goTop.addEventListener('click', function(){ window.scrollTo(0,0);
  if (/^#(p|pdf)-/.test(location.hash)) history.replaceState(null, '', location.pathname+location.search); });
var lastPg=null, tick=null;
function update(){
  goTop.hidden = window.scrollY < window.innerHeight;
  if (!pgms.length) return;
  var m=onScreenPg(); if (m===lastPg) return; lastPg=m;
  badge.textContent=pgText(m); badge.title=(m.title ? m.title+'. ' : '')+'Click to show printed or PDF page numbers, or to jump to a page';
  // the address follows the page on screen (no new history entry), so a copied link opens there;
  // not straight after loading, and never over a link to a plate, figure or note
  if (Date.now()-loadedAt>1000 && (!location.hash || /^#(p|pdf)-/.test(location.hash)))
    history.replaceState(null, '', location.pathname+location.search+'#'+m.id);
}
window.addEventListener('scroll', function(){ if (tick) return; tick=setTimeout(function(){ tick=null; update(); }, 100); }, {passive:true});
window.addEventListener('resize', function(){ lastPg=null; update(); });
// jump to page: printed (a number, or a roman numeral the article has) or PDF (a whole number),
// checked against this article's own pages; a number it lacks inside its range goes to the nearest
function jmsgSet(t, err){ jmsg.textContent=t; jmsg.className='jmsg'+(err?' err':''); }
function range(){ var nums=pgms.filter(function(m){ return /^\d+$/.test(m.dataset.n); }).map(function(m){ return +m.dataset.n; }),
    pdfs=pgms.filter(function(m){ return m.dataset.p; }).map(function(m){ return +m.dataset.p; });
  var t=[];
  if (nums.length) t.push('p. '+Math.min.apply(null,nums)+'–'+Math.max.apply(null,nums));
  if (pdfs.length) t.push('PDF '+Math.min.apply(null,pdfs)+'–'+Math.max.apply(null,pdfs));
  return 'This article runs '+t.join(', ')+'.'; }
function jumpTo(m, note){ m.scrollIntoView({block:'start'}); history.replaceState(null, '', location.pathname+location.search+'#'+m.id);
  lastPg=null; update(); if (note) jmsgSet(note, false); else setOpen(false); }
function nearest(list, n, key){ var best=null;
  list.forEach(function(m){ var d=Math.abs(key(m)-n); if (best===null || d<best[0]) best=[d,m]; }); return best && best[1]; }
function jump(){
  var v=jin.value.trim(), kind=panel.querySelector('input[name=pg-jump]:checked').value;
  if (!v) return jmsgSet('Enter a page number.', true);
  if (kind==='pdf'){
    if (!/^\d{1,4}$/.test(v)) return jmsgSet('A PDF page is a whole number, such as 391.', true);
    var n=+v, ps=pgms.filter(function(m){ return m.dataset.p; });
    if (!ps.length) return jmsgSet('No page of this article is in the PDF scan.', true);
    var lo=+ps[0].dataset.p, hi=+ps[ps.length-1].dataset.p;
    if (n<Math.min(lo,hi) || n>Math.max(lo,hi)) return jmsgSet('PDF page '+n+' is not in this article. '+range(), true);
    var hit=ps.filter(function(m){ return +m.dataset.p===n; })[0];
    if (hit) return jumpTo(hit);
    var near=nearest(ps, n, function(m){ return +m.dataset.p; });
    return jumpTo(near, 'PDF page '+n+' is a plate or a blank leaf, not text: showing PDF page '+near.dataset.p+', the nearest.');
  }
  if (!/^(\d{1,4}|[ivxlcdm]{1,8})$/i.test(v)) return jmsgSet('A printed page is a number such as 23, or a roman numeral such as xii.', true);
  var same=pgms.filter(function(m){ return m.dataset.n.toLowerCase()===v.toLowerCase(); })[0];
  if (same) return jumpTo(same);
  var nums=pgms.filter(function(m){ return /^\d+$/.test(m.dataset.n); });
  if (!/^\d+$/.test(v) || !nums.length) return jmsgSet('There is no printed page '+v+' in this article. '+range(), true);
  var k=+v, vals=nums.map(function(m){ return +m.dataset.n; });
  if (k<Math.min.apply(null,vals) || k>Math.max.apply(null,vals)) return jmsgSet('Printed page '+k+' is not in this article. '+range(), true);
  var nm=nearest(nums, k, function(m){ return +m.dataset.n; });
  jumpTo(nm, 'Printed page '+k+' has no number that could be read in the scan (or is a plate leaf): showing p. '+nm.dataset.n+', the nearest.');
}
panel.querySelector('.pgpanel-go').addEventListener('click', jump);
jin.addEventListener('keydown', function(e){ if (e.key==='Enter'){ e.preventDefault(); jump(); } });
update();
function toHash(){ if (location.hash){ var el=document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (el) el.scrollIntoView({block:'start'}); } }
window.addEventListener('hashchange', toHash);
toHash();
// footnote pop-ups: a mark opens its note beside it; a click elsewhere or Esc closes it
var pop=null;
function closePop(){ if (pop){ pop.remove(); pop=null; } }
document.addEventListener('click', function(e){
  var a=e.target.closest('sup.fn a');
  if (!a){ if (pop && !pop.contains(e.target)) closePop(); return; }
  e.preventDefault(); closePop();
  var note=document.getElementById(a.getAttribute('href').slice(1)); if (!note) return;
  // the note runs from its mark to the next note's mark (notes may share one paragraph)
  var box=note.closest('.notes'), r0=document.createRange(); r0.setStartBefore(note);
  var nxt=Array.prototype.filter.call(box.querySelectorAll('sup[id]'), function(x){
    return note.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING; })[0];
  if (nxt) r0.setEndBefore(nxt); else r0.setEndAfter(box.lastChild);
  pop=document.createElement('div'); pop.className='fn-pop'; pop.appendChild(r0.cloneContents());
  pop.querySelectorAll('[id]').forEach(function(x){ x.removeAttribute('id'); });
  pop.querySelectorAll('hr').forEach(function(x){ x.remove(); });
  document.body.appendChild(pop);
  var r=a.getBoundingClientRect(), w=pop.offsetWidth;
  pop.style.left=Math.max(8, Math.min(r.left+window.scrollX, window.scrollX+document.documentElement.clientWidth-w-8))+'px';
  pop.style.top=(r.bottom+window.scrollY+4)+'px';
});
document.addEventListener('keydown', function(e){ if (e.key==='Escape') closePop(); });
(function(){
  var ps=new URLSearchParams(location.search), term=ps.get('q'), mode=ps.get('w')||'embedded', cat=ps.get('cat'),
      titleOnly=ps.get('in')==='title';
  // what to mark: the search term, and the chosen category's matched words (CAT_TERMS)
  var finds=[]; if (term) finds.push([term,mode]);
  if (cat && window.CAT_TERMS && CAT_TERMS[cat]) CAT_TERMS[cat].forEach(function(t){ finds.push([t,'embedded']); });
  if (!finds.length) return;
  function ranges(t){ var r=[]; finds.forEach(function(f){ r=r.concat(findAll(t,f[0],f[1])); });
    r.sort(function(a,b){return a[0]-b[0];}); var out=[];
    r.forEach(function(x){ if (out.length && x[0]<out[out.length-1][1]) { out[out.length-1][1]=Math.max(out[out.length-1][1],x[1]); } else out.push(x.slice()); });
    return out; }
  // a title-only search marks the title alone, as that is all it searched; the reading note
  // and the plate gallery are the page's own words, never marked
  var main=document.querySelector('main'), root=(titleOnly && main.querySelector('.ah-title')) || main, walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes=[], n;
  while ((n=walker.nextNode())) if (!n.parentNode.closest('.hits, .howto, .gallery')) nodes.push(n);
  var marks=[];
  nodes.forEach(function(node){
    var r=ranges(node.nodeValue); if (!r.length) return;
    var frag=document.createDocumentFragment(), at=0, t=node.nodeValue;
    r.forEach(function(x){ frag.appendChild(document.createTextNode(t.slice(at,x[0])));
      var m=document.createElement('mark'); m.textContent=t.slice(x[0],x[1]); frag.appendChild(m); marks.push(m); at=x[1]; });
    frag.appendChild(document.createTextNode(t.slice(at))); node.parentNode.replaceChild(frag,node);
  });
  var bar=document.createElement('div'); bar.className='hits';
  var i=0, label=document.createElement('span');
  // the matches in document order: those in footnotes come last, in the notes at the end
  function go(k){ if (!marks.length) return; marks[i].classList.remove('on'); i=(k+marks.length)%marks.length;
    marks[i].classList.add('on');
    label.textContent=' '+(i+1)+' of '+marks.length+(marks[i].closest('.endnotes') ? ' (in the footnotes) ' : ' ');
    marks[i].scrollIntoView({block:'center'}); }
  var prev=document.createElement('button'); prev.textContent='◀ previous'; prev.onclick=function(){go(i-1);};
  var next=document.createElement('button'); next.textContent='next ▶'; next.onclick=function(){go(i+1);};
  bar.appendChild(document.createTextNode((term?'"'+term+'"':'')+(term&&cat?' + ':'')+(cat?'category '+cat:'')+': ')); bar.appendChild(prev); bar.appendChild(label); bar.appendChild(next);
  main.insertBefore(bar, main.firstChild);
  if (marks.length) go(0); else label.textContent=' no match in this article ';
})();
}
(function(){
  var art=document.querySelector('.art'), src=art && art.dataset.json, flow=art && art.querySelector('.flow');
  if (!src || !flow || location.protocol==='file:'){ articleInit(); return; }
  fetch(src).then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(d){ flow.innerHTML=d.html; articleInit(); }, function(){ articleInit(); });
})();

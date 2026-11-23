/* Galería de fotos · Expo Dub Edition × Aspar Circuit */
(function(){
  'use strict';
  var PACK = 50, list = [], cur = 0;
  var grid = document.getElementById('galGrid'), count = document.getElementById('galCount');
  var lb = document.getElementById('lb'), lbImg = document.getElementById('lbImg'),
      lbNum = document.getElementById('lbNum'), lbDl = document.getElementById('lbDl');
  function track(ev, p){ try{ if (window.gtag) gtag('event', ev, p || {}); }catch(e){} }

  fetch('fotos.json', {cache:'no-cache'}).then(function(r){ return r.json(); }).then(function(data){
    list = data; render(); renderPacks(); deepLink();
  }).catch(function(){ count.textContent = 'No se han podido cargar las fotos. Recarga la página.'; });

  function render(){
    count.textContent = list.length + ' fotos · toca una para verla en grande';
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting){ var im = e.target; im.src = im.dataset.src; io.unobserve(im); } });
    }, {rootMargin:'600px 0px'}) : null;
    var frag = document.createDocumentFragment();
    list.forEach(function(p, i){
      var b = document.createElement('div');
      b.className = 'gal-item'; b.tabIndex = 0; b.setAttribute('role','button');
      b.setAttribute('aria-label','Ver foto ' + (i+1));
      var im = document.createElement('img');
      im.alt = 'Expo Dub Edition × Aspar Circuit · foto ' + (i+1);
      im.width = 640; im.height = Math.round(640 * p.h / p.w);
      im.decoding = 'async';
      im.onload = function(){ im.classList.add('is-loaded'); };
      var src = 'th/' + p.f + '.webp';
      if (io){ im.dataset.src = src; io.observe(im); } else { im.src = src; }
      var dl = document.createElement('a');
      dl.className = 'gi-dl'; dl.href = 'img/' + p.f + '.jpg'; dl.download = p.f + '.jpg';
      dl.setAttribute('aria-label','Descargar foto ' + (i+1)); dl.textContent = '⬇';
      dl.addEventListener('click', function(ev){ ev.stopPropagation(); track('foto_descarga', {foto:p.f, origen:'grid'}); });
      b.appendChild(im); b.appendChild(dl);
      b.addEventListener('click', function(){ open(i); });
      b.addEventListener('keydown', function(ev){ if (ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); open(i); } });
      frag.appendChild(b);
    });
    grid.appendChild(frag);
  }

  function show(i){
    cur = (i + list.length) % list.length;
    var p = list[cur];
    lbImg.src = 'img/' + p.f + '.jpg';
    lbImg.alt = 'Foto ' + (cur+1) + ' de ' + list.length;
    lbNum.textContent = (cur+1) + ' / ' + list.length;
    lbDl.href = 'img/' + p.f + '.jpg'; lbDl.download = p.f + '.jpg';
    try{ history.replaceState(null, '', '#' + p.f); }catch(e){}
    [cur+1, cur-1].forEach(function(j){ var q = list[(j + list.length) % list.length]; (new Image()).src = 'img/' + q.f + '.jpg'; });
  }
  function open(i){ show(i); if (lb.showModal) lb.showModal(); else lb.setAttribute('open',''); track('foto_ver', {foto:list[cur].f}); }
  function close(){ lb.close ? lb.close() : lb.removeAttribute('open'); }
  lb.addEventListener('close', function(){ try{ history.replaceState(null, '', location.pathname); }catch(e){} });
  document.getElementById('lbClose').onclick = close;
  document.getElementById('lbPrev').onclick = function(){ show(cur-1); };
  document.getElementById('lbNext').onclick = function(){ show(cur+1); };
  lbDl.addEventListener('click', function(){ track('foto_descarga', {foto:list[cur].f, origen:'visor'}); });
  lb.addEventListener('click', function(e){ if (e.target === lb) close(); });
  document.addEventListener('keydown', function(e){
    if (!lb.open) return;
    if (e.key === 'ArrowRight') show(cur+1);
    if (e.key === 'ArrowLeft') show(cur-1);
  });
  var x0 = null;
  lb.addEventListener('touchstart', function(e){ x0 = e.touches[0].clientX; }, {passive:true});
  lb.addEventListener('touchend', function(e){
    if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1));
  });
  function deepLink(){
    var h = location.hash.slice(1); if (!h) return;
    var i = list.findIndex(function(p){ return p.f === h; }); if (i >= 0) open(i);
  }

  /* Packs ZIP generados en el navegador (JSZip) */
  var msg = document.getElementById('packMsg'), jszip = null;
  function loadZip(){
    if (jszip) return jszip;
    jszip = new Promise(function(ok, ko){
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      s.onload = function(){ ok(window.JSZip); }; s.onerror = function(){ jszip = null; ko(); };
      document.head.appendChild(s);
    });
    return jszip;
  }
  function renderPacks(){
    var box = document.getElementById('packList'), n = Math.ceil(list.length / PACK);
    for (var k = 0; k < n; k++){
      (function(k){
        var a = k*PACK, b = Math.min(list.length, a+PACK);
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'btn ' + (k ? 'btn-ghost' : 'btn-primary');
        btn.innerHTML = 'PACK ' + (k+1) + '<small>Fotos ' + (a+1) + '–' + b + '</small>';
        btn.onclick = function(){ zip(k, a, b, btn); };
        box.appendChild(btn);
      })(k);
    }
  }
  function zip(k, a, b, btn){
    btn.disabled = true; msg.textContent = 'Preparando pack ' + (k+1) + '…';
    loadZip().then(function(JSZip){
      var z = new JSZip(), done = 0, items = list.slice(a, b);
      return items.reduce(function(pr, p){
        return pr.then(function(){
          return fetch('img/' + p.f + '.jpg').then(function(r){ return r.blob(); }).then(function(bl){
            z.file(p.f + '.jpg', bl); done++;
            msg.textContent = 'Pack ' + (k+1) + ': ' + done + ' / ' + items.length + ' fotos';
          });
        });
      }, Promise.resolve()).then(function(){
        msg.textContent = 'Comprimiendo pack ' + (k+1) + '…';
        return z.generateAsync({type:'blob', compression:'STORE'});
      }).then(function(blob){
        var u = URL.createObjectURL(blob), l = document.createElement('a');
        l.href = u; l.download = 'dub-edition-aspar-fotos-pack' + (k+1) + '.zip';
        document.body.appendChild(l); l.click(); l.remove();
        setTimeout(function(){ URL.revokeObjectURL(u); }, 60000);
        msg.textContent = '✅ Pack ' + (k+1) + ' descargado';
        track('fotos_pack', {pack:k+1});
      });
    }).catch(function(){
      msg.textContent = 'No se ha podido crear el ZIP. Prueba otra vez o descarga las fotos una a una.';
    }).then(function(){ btn.disabled = false; });
  }
})();

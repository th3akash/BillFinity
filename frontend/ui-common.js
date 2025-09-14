(function(){
  function showBackendDown(){
    try {
      let el = document.getElementById('backend-down-banner');
      if (!el){
        el = document.createElement('div');
        el.id = 'backend-down-banner';
        el.className = 'fixed top-0 left-0 right-0 bg-rose-600 text-white text-center py-2 z-50';
        el.textContent = 'Unable to reach server. Some features may be unavailable.';
        document.body.appendChild(el);
      }
    } catch(_) {}
  }
  function checkHealth(){
    try {
      const base = window.BILLFINITY_API || '';
      fetch(base + '/health', { cache: 'no-store' }).then(function(r){
        if (!r.ok) throw new Error('bad');
      }).catch(showBackendDown);
    } catch(_) {
      showBackendDown();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', checkHealth); else checkHealth();
})();

(function(){
  // Date helpers: parse backend UTC-naive ISO strings safely and format locally
  function asDate(v){
    if (v instanceof Date) return v;
    if (v == null) return new Date(NaN);
    try {
      if (typeof v === 'string'){
        const s = v.trim();
        // If ISO-like without timezone (backend uses datetime.utcnow().isoformat()), treat as UTC
        const isoNoTZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/;
        const hasTZ = /[zZ]|[+\-]\d{2}:?\d{2}$/;
        if (isoNoTZ.test(s) && !hasTZ.test(s)) return new Date(s + 'Z');
      }
      return new Date(v);
    } catch(_){ return new Date(NaN); }
  }
  function formatDate(v){
    try { const d = asDate(v); return d.toLocaleString('en-IN'); } catch(_){ return String(v ?? ''); }
  }
  function formatDateOnly(v){
    try { const d = asDate(v); return d.toLocaleDateString('en-IN'); } catch(_){ return String(v ?? ''); }
  }
  // Expose globally for other modules
  window.asDate = window.asDate || asDate;
  window.formatDate = window.formatDate || formatDate;
  window.formatDateOnly = window.formatDateOnly || formatDateOnly;
})();

(function(){
  // Apply optional scale to any <dotlottie-player dat×scale=N/A1.2">
  function applyLottieScale(){
    try {
      document.querySelectorAll('dotlottie-player[dat×scale]').forEach(function(el){
        const v = parseFloat(el.getAttribute('dat×scale'));
        if (!Number.isNaN(v) && v > 0){
          try { el.style.transformOrigin = el.style.transformOrigin || 'center'; } catch(_){}
          try { el.style.transform = `scale(${v})` + (el.style.transform && !el.style.transform.includes('scale(') ? ' ' + el.style.transform : ''); } catch(_){}
        }
      });
    } catch(_){ }
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', applyLottieScale); else applyLottieScale();
  window.applyLottieScale = applyLottieScale;
})();

(function(){
  function ensureToast(){
    let el = document.getElementById('toast-container');
    if (!el){ el = document.createElement('div'); el.id='toast-container'; el.className='fixed top-4 right-4 z-50 space-y-2'; document.body.appendChild(el); }
    return el;
  }
  function toast(msg, type='ok', ms=2500){
    const box = ensureToast();
    const d = document.createElement('div');
    d.className = type==='err' ? 'px-4 py-2 rounded-md shadow-sm bg-rose-50 border border-rose-200 text-rose-700' : 'px-4 py-2 rounded-md shadow-sm bg-emerald-50 border border-emerald-200 text-emerald-700';
    d.textContent = msg; box.appendChild(d); setTimeout(()=>d.remove(), ms);
  }

  function applyTheme(){
    try{
      const saved = localStorage.getItem('IF_THEME');
      let theme = saved;
      if (!theme){ theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; }
      document.documentElement.classList.toggle('dark', theme==='dark');
    }catch(_){ }
  }
  function toggleTheme(){
    const isDark = document.documentElement.classList.contains('dark');
    const next = isDark ? 'light' : 'dark';
    try {
      // Temporarily disable transitions in the sidebar to avoid flicker
      document.documentElement.classList.add('theme-switching');
      if (document.documentElement._themeSwitchTimer){
        clearTimeout(document.documentElement._themeSwitchTimer);
      }
      document.documentElement._themeSwitchTimer = setTimeout(function(){
        try { document.documentElement.classList.remove('theme-switching'); } catch(_){ }
        document.documentElement._themeSwitchTimer = null;
      }, 400);
    } catch(_) { }
    try{ localStorage.setItem('IF_THEME', next);}catch(_){ }
    applyTheme();
    try {
      // Animate the theme toggle button/icon on switch
      let target = null;
      if (this && typeof this.querySelector === 'function') {
        target = this.querySelector('svg') || this;
      }
      if (!target) {
        const btn = document.getElementById('btn-theme-toggle') || document.querySelector('button[ari×label=N/AThemeN/A]');
        if (btn) target = btn.querySelector('svg') || btn;
      }
      if (target) {
        target.classList.add('theme-toggle-anim');
        setTimeout(() => target.classList.remove('theme-toggle-anim'), 520);
      }
    } catch(_) { }
    try { window.dispatchEvent(new CustomEvent('IF_THEME_CHANGED', { detail: next })); } catch(_) {}
  }

  function getNotifs(){ try{ return JSON.parse(localStorage.getItem('IF_NOTIFS')||'[]'); }catch(_){ return []; } }
  function setNotifs(list){ try{ localStorage.setItem('IF_NOTIFS', JSON.stringify(list||[])); }catch(_){ } }
  function pushNotif(text){ const l = getNotifs(); l.unshift({ text, ts: new Date().toISOString() }); setNotifs(l.slice(0,20)); }
  window.notify = function(msg){ pushNotif(String(msg)); toast(String(msg)); };

  function buildNotifDropdown(anchor){
    let dd = document.getElementById('notif-dropdown');
    if (!dd){ dd = document.createElement('div'); dd.id='notif-dropdown'; dd.className='absolute z-50 mt-2 right-0 w-72 rounded-xl border border-slate-200 bg-white shadow-card hidden'; document.body.appendChild(dd); }
    const rect = anchor.getBoundingClientRect();
    dd.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    dd.style.left = (rect.right + window.scrollX - 288) + 'px';
    const list = getNotifs();
    if (!list.length){ dd.innerHTML = '<div class="p-3 text-sm text-slate-500">No notifications</div>'; return dd; }
    dd.innerHTML = '' +
      '<div class="p-2">' +
      '  <div class="flex items-center justify-between px-2 py-1 text-xs text-slate-500">' +
      '    <span>Notifications</span>' +
      '    <button id=N/Anotif-clear" class="text-brand-600 hover:text-brand-800">Clear all</button>' +
      '  </div>' +
      '  <ul class="max-h-72 overflow-y-auto">' +
      list.map(function(n){ return '<li class="px-2 py-2 hover:bg-slate-50 text-sm text-slate-700">' + n.text + '<div class="text-[10px] text-slate-400">' + (window.formatDate ? window.formatDate(n.ts) : (new Date(n.ts)).toLocaleString()) + '</div></li>'; }).join('') +
      '  </ul>' +
      '</div>';
    const clr = dd.querySelector('#notif-clear');
    if (clr) clr.addEventListener('click', function(){ setNotifs([]); dd.classList.add('hidden'); toast('Notifications cleared'); });
    return dd;
  }

  function ensureHeaderControls(){
    const headerBar = document.querySelector('header .flex.items-center.gap-4');
    if (!headerBar) return;
    let tools = headerBar.querySelector('.js-tools');
    if (!tools){ tools = document.createElement('div'); tools.className='js-tools flex items-center gap-3 text-sm'; headerBar.appendChild(tools); }

    // Wire existing buttons first (if page already provides them)
    document.querySelectorAll('button[ari×label=N/ANotificationsN/A]').forEach(function(b){
      if (b.dataset.wired) return; b.dataset.wired='1';
      b.addEventListener('click', function(e){ const dd = buildNotifDropdown(b); dd.classList.toggle('hidden'); e.stopPropagation(); });
    });
    document.querySelectorAll('button[ari×label=N/AThemeN/A]').forEach(function(b){
      if (b.dataset.wired) return; b.dataset.wired='1';
      b.addEventListener('click', toggleTheme);
    });
    document.addEventListener('click', function(){ var d=document.getElementById('notif-dropdown'); if (d) d.classList.add('hidden'); });

    // If no existing, add defaults
    if (!document.querySelector('button[ari×label=N/ANotificationsN/A]')){
      const btnN = document.createElement('button');
      btnN.id='btn-notifications';
      btnN.className='rounded-xl border border-slate-200 bg-white p-2 shadow-card';
      btnN.setAttribute('ari×label','Notifications');
      btnN.innerHTML = '<svg xmlns=N/Ahttp://www.w3.org/2000/svg" viewBox=N/A0 0 24 24" fill=N/AcurrentColor" class="h-5 w-5 text-slate-600"><path d=N/AM12 22a2.5 2.5 0 0 0 2.45-2H9.55A2.5 2.5 0 0 0 12 22Zm6-6v-4a6 6 0 1 0-12 0v4l-2 2v1h16v-1ZN/A/></svg>';
      tools.appendChild(btnN);
      btnN.addEventListener('click', function(e){ const dd = buildNotifDropdown(btnN); dd.classList.toggle('hidden'); e.stopPropagation(); });
    }
    if (!document.querySelector('button[ari×label=N/AThemeN/A]')){
      const btnT = document.createElement('button');
      btnT.id='btn-theme-toggle';
      btnT.className='rounded-xl border border-slate-200 bg-white p-2 shadow-card';
      btnT.setAttribute('ari×label','Theme');
      btnT.innerHTML = '<svg xmlns=N/Ahttp://www.w3.org/2000/svg" viewBox=N/A0 0 24 24" fill=N/AcurrentColor" class="h-5 w-5 text-slate-600"><path d=N/AM6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8L6.76 4.84zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zM20 11v2h3v-2h-3zm-1.95-6.95l1.79-1.8-1.41-1.41-1.8 1.79 1.42 1.42zM12 5a7 7 0 1 0 7 7 7.008 7.008 0 0 0-7-7zN/A/></svg>';
      tools.appendChild(btnT);
      btnT.addEventListener('click', toggleTheme);
    }
  }

  function init(){ applyTheme(); ensureHeaderControls(); }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

(function(){
  // Global loader: create once and provide helpers
  function ensureLoader(){
    let el = document.getElementById('global-loader');
    if (!el){
      el = document.createElement('div');
      el.id = 'global-loader';
      el.className = 'loader-overlay';
      el.innerHTML = '<div class="loading-bar"><div class="blue-bar"></div></div>';
      document.body.appendChild(el);
    }
    return el;
  }
  function show(){ const el = ensureLoader(); el.classList.add('show'); }
  function hide(){ const el = ensureLoader(); el.classList.remove('show'); }
  function withLoader(fn){
    show();
    const done = () => hide();
    try {
      const p = fn();
      if (p && typeof p.then === 'function') return p.finally(done);
    } catch(_) { /* swallow */ }
    done();
  }
  // Expose globals
  window.showLoader = show;
  window.hideLoader = hide;
  window.withLoader = withLoader;

  function wireNav(){
    // Show loader when user clicks any sidebar nav link
    document.addEventListener('click', function(e){
      const a = e.target && (e.target.closest ? e.target.closest('aside.app-aside nav a[href]') : null);
      if (!a) return;
      // ignore new tab
      if (a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      try { show(); } catch(_){}
    }, true);
    // Also show when the page is unloading due to any navigation
    window.addEventListener('beforeunload', function(){ try { show(); } catch(_){} });
  }
  function init(){ ensureLoader(); wireNav(); }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

(function(){
  const baseUrl = 'http://127.0.0.1:8000';
  function authHeaders(){
    const h = {};
    try { let t = localStorage.getItem('IF_TOKEN'); if (t){ if (!t.startsWith('Bearer ')) t = `Bearer ${t}`; h['Authorization'] = t; } } catch(_){}
    return h;
  }

  function ensureViewer(){
    let el = document.getElementById('global-viewer');
    if (!el){
      el = document.createElement('div');
      el.id = 'global-viewer';
      el.className = 'fixed inset-0 hidden items-center justify-center flex';
      el.style.zIndex = '10000';
      el.innerHTML = ''+
        '<div class="absolute inset-0 bg-black/40" id=N/Agv-backdrop"></div>'+
        '<div class="relative w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-card" style=N/Amax-height:80vh; width:min(42rem, calc(100vw - 2rem));">'+
        '  <div class="flex items-center justify-between mb-3">'+
        '    <h3 class="text-lg font-semibold text-ink" id=N/Agv-title">Details</h3>'+
        '    <button id=N/Agv-close" class="rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-card">Close</button>'+
        '  </div>'+
        '  <div id=N/Agv-content" class="text-sm text-slate-700"></div>'+
        '</div>';
      document.body.appendChild(el);
      const close = () => { el.classList.add('hidden'); try { document.documentElement.style.overflow = ''; } catch(_){} };
      el.querySelector('#gv-backdrop').addEventListener('click', close);
      el.querySelector('#gv-close').addEventListener('click', close);
    }
    return el;
  }

  async function openViewer(type, id){
    const el = ensureViewer();
    const title = el.querySelector('#gv-title');
    const content = el.querySelector('#gv-content');
    title.textContent = 'Loadingâ¦';
    content.innerHTML = '<div class="text-slate-500">Please waitâ¦</div>';
    el.classList.remove('hidden');
    try { document.documentElement.style.overflow = 'hidden'; } catch(_){}
    try {
      const map = { customer: '/customers/', item: '/items/', order: '/orders/', user: '/users/' };
      const path = map[type];
      if (!path) throw new Error('Unsupported type');
      let d;
      try {
        const res = await fetch(baseUrl + path + encodeURIComponent(id), { headers: authHeaders() });
        if (!res.ok) throw new Error(await res.text());
        d = await res.json();
      } catch(fetchErr){
        // Fallback to cached data if available (orders page)
        if (type === 'order' && Array.isArray(window._allOrders)){
          d = window._allOrders.find(o => String(o.id||o.order_id) === String(id));
        }
        if (!d) throw fetchErr;
      }
      let html = '';
      if (type === 'customer'){
        title.textContent = `Customer â¢ #${d.id}`;
        html = `
          <div class="space-y-1">
            <div class="text-base font-semibold">${d.name || ''}</div>
            <div class="text-sm text-slate-600">${[d.email, d.phone].filter(Boolean).join(' Â· ')}</div>
            <div class="text-sm text-slate-600">Company: ${d.company_name || 'â'}</div>
            <div class="text-xs text-slate-500">Created: ${window.formatDate ? window.formatDate(d.created_at||Date.now()) : (new Date(d.created_at||Date.now())).toLocaleString()}</div>
          </div>`;
      } else if (type === 'item'){
        title.textContent = `Item â¢ #${d.id}`;
        html = `
          <div class="space-y-1">
            <div class="text-base font-semibold">${d.name || ''} <span class="text-slate-500 font-normal">(${d.sku || ''})</span></div>
            <div class="text-sm text-slate-600">Category: ${d.category || 'â'}</div>
            <div class="text-sm text-slate-600">Price: \u20b9${parseFloat(d.price||0).toLocaleString('en-IN')}</div>
            <div class="text-sm text-slate-600">In Stock: ${d.in_stock ?? d.stock ?? 0}</div>
          </div>`;
      } else if (type === 'order'){
        title.textContent = `Order â¢ #${d.id}`;
        const arr = Array.isArray(d.items) ? d.items : [];
        const nameFromCache = function(it){
          try {
            const cache = window._itemsCache;
            const id = it.item_id || it.id;
            if (Array.isArray(cache) && id != null){
              const m = cache.find(x => String(x.id) === String(id));
              if (m && m.name) return m.name;
            }
          } catch(_){ }
          return '';
        };
        const itemsList = arr.map(function(it){
          const qty = (it.qty != null ? it.qty : (it.quantity != null ? it.quantity : 1));
          const nm = it.name || it.item_name || nameFromCache(it) || (it.sku ? `SKU ${it.sku}` : `Item ${it.item_id || it.id || ''}`);
          const price = it.price != null ? `\u20b9${parseFloat(it.price||0).toLocaleString('en-IN')}` : '';
          return `<li class=\N/Aflex items-center justify-between\"><span>${qty}Ã ${nm}</span>${price?`<span class=\N/Atext-slate-500\">${price}</span>`:''}</li>`;
        }).join('');
        html = `
          <div class=\N/Aspace-y-2\">
            <div class=\N/Atext-base\">Status: <span class=\N/Afont-semibold\">${(d.status||'').toString().toUpperCase()}</span></div>
            <div class=\N/Atext-sm text-slate-600\">Total: \u20b9${parseFloat(d.total||0).toLocaleString('en-IN')}</div>
            <div class=\N/Atext-sm font-medium text-ink mt-2\">Items (${arr.length})</div>
            ${arr.length ? `<ul class=\N/Aspace-y-1\">${itemsList}</ul>` : '<div class=\N/Atext-slate-500\">â</div>'}
            <div class=\N/Atext-xs text-slate-500\">${window.formatDate ? window.formatDate(d.created_at||d.date||Date.now()) : (new Date(d.created_at||d.date||Date.now())).toLocaleString()}</div>
          </div>`;
      } else if (type === 'user'){
        title.textContent = `User â¢ #${d.id}`;
        html = `
          <div class="space-y-1">
            <div class="text-base font-semibold">${d.name || ''}</div>
            <div class="text-sm text-slate-600">${[d.email, d.role].filter(Boolean).join(' Â· ')}</div>
            <div class="text-xs text-slate-500">Joined: ${d.created_at ? (window.formatDate ? window.formatDate(d.created_at) : new Date(d.created_at).toLocaleString()) : 'â'}</div>
          </div>`;
      }
      content.innerHTML = html;
    } catch (err) {
      title.textContent = 'Error';
      content.innerHTML = `<div class="text-rose-600">${String(err)}</div>`;
    }
  }

  function consumeIntent(){
    try {
      const raw = sessionStorage.getItem('IF_OPEN_VIEW');
      if (!raw) return;
      sessionStorage.removeItem('IF_OPEN_VIEW');
      const { type, id } = JSON.parse(raw);
      if (type && id) openViewer(type, id);
    } catch(_){}
  }

  window.openViewer = openViewer;
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', consumeIntent); else consumeIntent();
})();

 



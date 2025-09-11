(function(){
  const baseUrl = 'http://127.0.0.1:8000';
  let dropdown;
  let inputEl;
  let iconEl;
  let abortCtrl = null;
  let qTimer = null;
  const CACHE_TTL = 15000; // 15s
  const CACHE = {
    customers: { ts: 0, data: [] },
    items: { ts: 0, data: [] },
    orders: { ts: 0, data: [] },
    users: { ts: 0, data: [] },
  };

  function authHeaders(){
    const h = {};
    try { let t = localStorage.getItem('IF_TOKEN'); if (t){ if (!t.startsWith('Bearer ')) t = `Bearer ${t}`; h['Authorization'] = t; } } catch(_){}
    return h;
  }

  function ensureDropdown(){
    if (dropdown) return dropdown;
    dropdown = document.createElement('div');
    dropdown.id = 'global-search-dropdown';
    dropdown.className = 'fixed z-50 w-[min(36rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden hidden';
    document.body.appendChild(dropdown);
    return dropdown;
  }

  function positionDropdown(){
    if (!dropdown || !inputEl) return;
    const r = inputEl.getBoundingClientRect();
    dropdown.style.left = `${r.left}px`;
    dropdown.style.top = `${r.bottom + window.scrollY + 6}px`;
    dropdown.style.width = `${r.width}px`;
  }

  function showDropdown(){ ensureDropdown(); positionDropdown(); dropdown.classList.remove('hidden'); }
  function hideDropdown(){ if (dropdown) dropdown.classList.add('hidden'); }

  function renderResults({customers, items, orders, users}, q){
    ensureDropdown();
    if ((!customers || !customers.length) && (!items || !items.length) && (!orders || !orders.length) && (!users || !users.length)){
      dropdown.innerHTML = `<div class="p-3 text-sm text-slate-500">No results for "${q}"</div>`;
      return;
    }
    const section = (title, rows) => rows && rows.length ? `
      <div class="p-2">
        <div class="px-2 py-1 text-xs font-semibold text-slate-500">${title}</div>
        <ul>
          ${rows.map(r => `<li>
            <a href="${r.href}" class="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50" data-type="${r.type}" data-id="${r.id}">
              ${r.icon}
              <div class="min-w-0">
                <div class="text-sm font-medium text-ink truncate">${r.title}</div>
                ${r.subtitle ? `<div class=\"text-xs text-slate-500 truncate\">${r.subtitle}</div>` : ''}
              </div>
              <div class="ml-auto flex items-center gap-2">
                <button class="sr-view text-xs rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm" data-type="${r.type}" data-id="${r.id}">View</button>
              </div>
            </a>
          </li>`).join('')}
        </ul>
      </div>` : '';
    const manIcon = '<img src="assets/man.webp" class="h-6 w-6 rounded-full" alt="" />';
    const boxIcon = '<img src="assets/furniture.webp" class="h-6 w-6 rounded" alt="" />';
    const orderIcon = '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="h-5 w-5 text-slate-600"><path d="M21 7H3V5h18v2Zm0 4H3v8h18v-8ZM5 13h6v4H5v-4Zm8 0h6v4h-6v-4Z"/></svg>';
    const userIcon = '<img src="assets/man.webp" class="h-6 w-6 rounded-full" alt="" />';
    const custRows = (customers||[]).slice(0,5).map(c => ({
      type: 'customer', id: c.id,
      href: 'customers.html',
      icon: manIcon,
      title: c.name || c.email || c.phone || 'Customer',
      subtitle: [c.phone, c.email].filter(Boolean).join(' · ')
    }));
    const itemRows = (items||[]).slice(0,5).map(i => ({
      type: 'item', id: i.id,
      href: 'items.html',
      icon: boxIcon,
      title: i.name || i.sku || 'Item',
      subtitle: [i.sku, i.category].filter(Boolean).join(' · ')
    }));
    const orderRows = (orders||[]).slice(0,5).map(o => ({
      type: 'order', id: o.id,
      href: 'orders.html',
      icon: orderIcon,
      title: `Order #${o.id}`,
      subtitle: `${(o.status||'').toString().toUpperCase()} • \u20b9${parseFloat(o.total||0).toLocaleString('en-IN')} • ${window.formatDateOnly ? window.formatDateOnly(o.created_at||o.date||Date.now()) : new Date(o.created_at||o.date||Date.now()).toLocaleDateString('en-IN')}`
    }));
    const userRows = (users||[]).slice(0,5).map(u => ({
      type: 'user', id: u.id,
      href: 'user-management.html',
      icon: userIcon,
      title: u.name || u.email || 'User',
      subtitle: [u.email, u.role].filter(Boolean).join(' · ')
    }));
    dropdown.innerHTML = section('Customers', custRows) + section('Orders', orderRows) + section('Inventory Items', itemRows) + section('Users', userRows) + '<div id="global-search-preview" class="border-t border-slate-100"></div>';
  }

  function digits(str){ return (str||'').toString().replace(/\D+/g,''); }

  async function query(q){
    if (abortCtrl) { try { abortCtrl.abort(); } catch(_){} }
    abortCtrl = new AbortController();
    try {
      const now = Date.now();
      async function tryListCached(url, key){
        const ent = CACHE[key] || { ts: 0, data: [] };
        if (now - ent.ts < CACHE_TTL && ent.data && ent.data.length) return ent.data;
        try {
          const res = await fetch(url, { headers: authHeaders(), signal: abortCtrl.signal });
          if (!res.ok) return ent.data || [];
          const data = await res.json();
          const arr = Array.isArray(data) ? data : [];
          CACHE[key] = { ts: Date.now(), data: arr };
          return arr;
        } catch (_) { return ent.data || []; }
      }
      const [customers, items, ordersAll, usersAll] = await Promise.all([
        tryListCached(`${baseUrl}/customers`, 'customers'),
        tryListCached(`${baseUrl}/items`, 'items'),
        tryListCached(`${baseUrl}/orders`, 'orders'),
        tryListCached(`${baseUrl}/users`, 'users')
      ]);
      const ql = q.toLowerCase(); const qd = digits(q);
      const custMatches = (customers||[]).filter(c => {
        const name = (c.name||'').toLowerCase();
        const phone = digits(c.phone);
        const email = (c.email||'').toLowerCase();
        return name.includes(ql) || (!!qd && phone.includes(qd)) || email.includes(ql);
      });
      const itemMatches = (items||[]).filter(i => {
        const name = (i.name||'').toLowerCase();
        const sku = (i.sku||'').toLowerCase();
        const cat = (i.category||'').toLowerCase();
        return name.includes(ql) || sku.includes(ql) || cat.includes(ql);
      });
      const orderMatches = (ordersAll||[]).filter(o => {
        const idStr = String(o.id || o.order_id || '');
        const status = (o.status||'').toLowerCase();
        return (qd && idStr.includes(qd)) || status.includes(ql);
      });
      const userMatches = (usersAll||[]).filter(u => {
        const name = (u.name||'').toLowerCase();
        const email = (u.email||'').toLowerCase();
        const role = (u.role||'').toLowerCase();
        return name.includes(ql) || email.includes(ql) || role.includes(ql);
      });
      renderResults({customers: custMatches, items: itemMatches, orders: orderMatches, users: userMatches}, q);
      showDropdown();
    } catch (e) {
      // silent
    }
  }

  async function preview(type, id){
    ensureDropdown();
    const pv = dropdown.querySelector('#global-search-preview');
    if (!pv) return;
    pv.innerHTML = '<div class="p-3 text-slate-500 text-sm">Loading…</div>';
    const h = authHeaders();
    try {
      let url = '';
      switch(type){
        case 'customer': url = `${baseUrl}/customers/${id}`; break;
        case 'item': url = `${baseUrl}/items/${id}`; break;
        case 'order': url = `${baseUrl}/orders/${id}`; break;
        case 'user': url = `${baseUrl}/users/${id}`; break;
        default: pv.innerHTML = ''; return;
      }
      const res = await fetch(url, { headers: h }); if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      let html = '';
      if (type === 'customer'){
        html = `
          <div class="p-3 bg-slate-50">
            <div class="text-sm font-semibold text-ink mb-1">Customer • #${d.id}</div>
            <div class="text-sm">${d.name || ''}</div>
            <div class="text-xs text-slate-600">${[d.email, d.phone].filter(Boolean).join(' · ')}</div>
            <div class="text-xs text-slate-500 mt-1">${d.company_name || ''}</div>
          </div>`;
      } else if (type === 'item'){
        html = `
          <div class="p-3 bg-slate-50">
            <div class="text-sm font-semibold text-ink mb-1">Item • #${d.id}</div>
            <div class="text-sm">${d.name || ''} (${d.sku || ''})</div>
            <div class="text-xs text-slate-600">Category: ${d.category || '—'}</div>
            <div class="text-xs text-slate-600">Price: \u20b9${parseFloat(d.price||0).toLocaleString('en-IN')}</div>
          </div>`;
      } else if (type === 'order'){
        const items = Array.isArray(d.items) ? d.items.map(it => `${it.qty||1}× ${it.name || it.item_id}`).join(', ') : '';
        html = `
          <div class="p-3 bg-slate-50">
            <div class="text-sm font-semibold text-ink mb-1">Order • #${d.id}</div>
            <div class="text-sm">Status: ${(d.status||'').toString().toUpperCase()}</div>
            <div class="text-xs text-slate-600">Total: \u20b9${parseFloat(d.total||0).toLocaleString('en-IN')}</div>
            <div class="text-xs text-slate-600 truncate">Items: ${items}</div>
            <div class="text-xs text-slate-500 mt-1">${window.formatDate ? window.formatDate(d.created_at||d.date||Date.now()) : (new Date(d.created_at||d.date||Date.now())).toLocaleString()}</div>
          </div>`;
      } else if (type === 'user'){
        html = `
          <div class="p-3 bg-slate-50">
            <div class="text-sm font-semibold text-ink mb-1">User • #${d.id}</div>
            <div class="text-sm">${d.name || ''}</div>
            <div class="text-xs text-slate-600">${[d.email, d.role].filter(Boolean).join(' · ')}</div>
          </div>`;
      }
      pv.innerHTML = html;
      showDropdown(); positionDropdown();
    } catch (err){ pv.innerHTML = `<div class="p-3 text-rose-600 text-sm">Error: ${String(err)}</div>`; }
  }

  function wire(){
    inputEl = document.querySelector('input[type="search"][data-global-search="true"]');
    if (!inputEl) return;
    iconEl = document.getElementById('global-search-icon');
    // Ensure the lottie icon plays once on focus/click, then stops at end
    try {
      if (iconEl) {
        // Disable looping if any and stop at first frame initially
        try { iconEl.loop = false; } catch(_){}
        try { iconEl.stop && iconEl.stop(); } catch(_){}
        // Stop at completion if the component emits a complete event
        try { iconEl.addEventListener && iconEl.addEventListener('complete', () => { try { iconEl.stop && iconEl.stop(); } catch(_){} }); } catch(_){}
      }
    } catch(_){}
    const playOnce = () => {
      try {
        if (!iconEl) return;
        // Restart from beginning and play once
        if (iconEl.seek) { try { iconEl.seek(0); } catch(_){} }
        iconEl.play && iconEl.play();
      } catch(_){}
    };
    const onFocus = () => { playOnce(); };
    const onBlur = () => { setTimeout(()=>{ hideDropdown(); try { iconEl?.stop?.(); } catch(_){} }, 150); };
    const onInput = (e) => {
      const q = (e.target.value||'').trim();
      if (q.length < 2){ hideDropdown(); return; }
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { positionDropdown(); query(q); }, 220);
    };
    inputEl.addEventListener('focus', onFocus);
    inputEl.addEventListener('mousedown', playOnce);
    inputEl.addEventListener('blur', onBlur);
    inputEl.addEventListener('input', onInput);
    // Prevent form submit on Enter so results stay visible
    const form = inputEl.closest('form');
    if (form) {
      form.addEventListener('submit', function(e){ e.preventDefault(); positionDropdown(); showDropdown(); });
    }
    // Keep dropdown open and optionally re-query on Enter
    inputEl.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){
        e.preventDefault();
        const q = (inputEl.value||'').trim();
        if (q.length >= 2){ positionDropdown(); showDropdown(); if (!dropdown || dropdown.classList.contains('hidden')) query(q); }
      }
    });
    window.addEventListener('resize', positionDropdown);
    window.addEventListener('scroll', positionDropdown, true);
    // View button: open full viewer overlay without navigation (handle early to beat blur)
    const viewHandler = function(e){
      const btn = e.target && e.target.closest ? e.target.closest('.sr-view') : null;
      if (!btn) return;
      if (!dropdown || dropdown.classList.contains('hidden')) return;
      e.preventDefault(); e.stopPropagation();
      const type = btn.getAttribute('data-type');
      const id = btn.getAttribute('data-id');
      if (type && id) {
        try {
          if (window.openViewer) { window.openViewer(type, id); hideDropdown(); return; }
        } catch(_) {}
        // Fallback: inline preview if viewer is unavailable
        preview(type, id);
      }
    };
    document.addEventListener('mousedown', viewHandler, true);
    document.addEventListener('click', viewHandler, true);
    // Row click: navigate and open full view on destination via intent
    document.addEventListener('click', function(e){
      const a = e.target && e.target.closest ? e.target.closest('#global-search-dropdown a[data-type][data-id]') : null;
      if (!a) return;
      // ignore modified clicks/new tab
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
      try { sessionStorage.setItem('IF_OPEN_VIEW', JSON.stringify({ type: a.getAttribute('data-type'), id: a.getAttribute('data-id') })); } catch(_){}
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();

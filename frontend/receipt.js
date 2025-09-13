(function(){
  const baseUrl = 'http://127.0.0.1:8000';
  function authHeaders(){
    const h = { };
    try {
      let t = localStorage.getItem('IF_TOKEN') || localStorage.IF_TOKEN;
      if (t){ if (!t.startsWith('Bearer ')) t = `Bearer ${t}`; h['Authorization'] = t; }
    } catch(_){ }
    return h;
  }
  function asDate(v){
    if (v instanceof Date) return v;
    if (v == null) return new Date(NaN);
    try {
      if (typeof v === 'string'){
        const s = v.trim();
        const isoNoTZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/;
        const hasTZ = /[zZ]|[+\-]\d{2}:?\d{2}$/;
        if (isoNoTZ.test(s) && !hasTZ.test(s)) return new Date(s + 'Z');
      }
      return new Date(v);
    } catch(_){ return new Date(NaN); }
  }
  function fmtDate(v){ try { return asDate(v).toLocaleString('en-IN'); } catch(_){ return String(v ?? ''); } }
  function INR(n){ try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n||0); } catch(_) { return '₹' + (n||0); } }
  function el(id){ return document.getElementById(id); }
  function getParam(name){ try { const u=new URL(location.href); return u.searchParams.get(name); } catch(_) { return null; } }
  async function fetchOrderById(id){
    try {
      if (!id) return null;
      const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(id)}`, { headers: authHeaders() });
      if (res.ok) return await res.json();
    } catch(_){}
    return null;
  }

  function render(data){
    if (!data){
      el('rc-order-id').textContent = '—';
      el('rc-date').textContent = fmtDate(Date.now());
      el('rc-customer').textContent = '—';
      el('rc-items').innerHTML = '<div class="rc-row"><div class="rc-col item">No items</div><div class="rc-col qty">0</div><div class="rc-col amt">₹0</div></div>';
      el('rc-subtotal').textContent = INR(0);
      el('rc-tax').textContent = INR(0);
      el('rc-total').textContent = INR(0);
      return;
    }
    el('rc-order-id').textContent = '#' + (data.id ?? data.order_id ?? '');
    const when = data.created_at ? asDate(data.created_at) : new Date();
    el('rc-date').textContent = fmtDate(when);
    el('rc-customer').textContent = (data.customer && (data.customer.name || data.customer.full_name)) || (data.customer_name) || 'Customer';
    const items = Array.isArray(data.items) ? data.items : [];
    // Fallback GST lookup by item id from localStorage map
    let metaMap = {};
    try { metaMap = JSON.parse(localStorage.getItem('IF_ITEM_META') || '{}'); } catch(_) { metaMap = {}; }
    // Determine GST split mode using GSTIN state codes
    function gstStateCode(gstin){ try { const m = String(gstin||'').match(/^(\d{2})/); return m ? m[1] : null; } catch(_) { return null; } }
    let rcsLocal = {};
    try { rcsLocal = JSON.parse(localStorage.getItem('IF_RECEIPT_SETTINGS') || '{}'); } catch(_) {}
    const storeState = gstStateCode(rcsLocal.gstin);
    const customerGstin = (data.customer && (data.customer.gstin || data.customer.GSTIN || data.customer.gst)) || null;
    const customerState = gstStateCode(customerGstin);
    const isInterState = !!(storeState && customerState && storeState !== customerState);
    let subtotal = 0;
    let taxTotal = 0;
    const breakup = {}; // rate -> { taxable, tax }
    const rows = items.map(it => {
      const q = parseFloat(it.qty || it.quantity || 1);
      const p = parseFloat(it.price || (it.item && it.item.price) || 0);
      const nm = it.name || (it.item && it.item.name) || 'Item';
      const skuText = it.sku ? `SKU: ${it.sku}` : '';
      // Resolve GST percentage
      let gstVal = null;
      try {
        if (it.gst != null && !Number.isNaN(parseInt(it.gst, 10))) {
          gstVal = parseInt(it.gst, 10);
        } else {
          const id = it.item_id || it.id || (it.item && it.item.id);
          const g = metaMap[String(id)]?.gst;
          const v = parseInt(g, 10);
          if (!Number.isNaN(v)) gstVal = v;
        }
      } catch(_) {}
      const gstPct = (gstVal != null && !Number.isNaN(gstVal)) ? `${gstVal}%` : '';
      const gstText = gstPct ? `GST: ${gstPct}` : '';
      const metaText = [skuText, gstText].filter(Boolean).join(' · ');
      const nameCell = metaText ? `${nm}<div class="rc-sub">${metaText}</div>` : nm;
      const line = q * p;
      subtotal += line;
      if (gstVal != null && !Number.isNaN(gstVal)) {
        const tx = (line * gstVal) / 100;
        taxTotal += tx;
        const key = String(gstVal);
        if (!breakup[key]) breakup[key] = { taxable: 0, tax: 0 };
        breakup[key].taxable += line;
        breakup[key].tax += tx;
      }
      return `<div class="rc-row"><div class="rc-col item">${nameCell}</div><div class="rc-col qty">${q}</div><div class="rc-col amt">${INR(line)}</div></div>`;
    }).join('');
    el('rc-items').innerHTML = rows || '<div class="rc-row"><div class="rc-col item">—</div><div class="rc-col qty">0</div><div class="rc-col amt">₹0</div></div>';
    // If we calculated tax, derive total accordingly; else fall back to server total
    let total;
    if (taxTotal > 0) {
      total = subtotal + taxTotal;
    } else {
      total = parseFloat(data.total || subtotal);
      taxTotal = Math.max(0, total - subtotal);
    }
    el('rc-subtotal').textContent = INR(subtotal);
    el('rc-tax').textContent = INR(taxTotal);
    el('rc-total').textContent = INR(total);

    // Render tax breakup rows (CGST/SGST for intra-state, IGST for inter-state)
    try {
      const host = el('rc-tax-breakup');
      if (host) {
        host.innerHTML = '';
        const rates = Object.keys(breakup).map(r => parseInt(r, 10)).filter(n => !Number.isNaN(n) && n > 0).sort((a,b)=>a-b);
        const parts = [];
        for (const r of rates) {
          const info = breakup[String(r)];
          if (!info) continue;
          if (isInterState) {
            parts.push(`<div class="rc-row"><div class="rc-col label">IGST ${r}%</div><div class="rc-col value">${INR(info.tax)}</div></div>`);
          } else {
            const halfRate = r / 2;
            const halfAmt = info.tax / 2;
            parts.push(`<div class="rc-row"><div class="rc-col label">CGST ${halfRate}%</div><div class="rc-col value">${INR(halfAmt)}</div></div>`);
            parts.push(`<div class="rc-row"><div class="rc-col label">SGST ${halfRate}%</div><div class="rc-col value">${INR(halfAmt)}</div></div>`);
          }
        }
        host.innerHTML = parts.join('');
      }
    } catch(_) {}
  }

  async function markComplete(order){
    try {
      const id = order && (order.id || order.order_id);
      if (!id) return;
      await fetch(`${baseUrl}/orders/${id}/complete`, { method: 'POST', headers: authHeaders() });
    } catch(_){ /* non-blocking */ }
  }

  function printSequentialSameWindow(copies, onDone){
    const total = Math.max(1, parseInt(copies || 1, 10));
    let left = total;
    let watchdog = null;
    let pending = false;
    function cleanup(){ try { window.removeEventListener('afterprint', handleAfter); } catch(_){} try { window.removeEventListener('focus', handleFocus); } catch(_){} if (watchdog) clearTimeout(watchdog); }
    function handleAfter(){ if (!pending) return; pending = false; step(); }
    function handleFocus(){ if (!pending) return; setTimeout(() => { if (pending) { pending = false; step(); } }, 200); }
    function armWatchdog(){ if (watchdog) clearTimeout(watchdog); watchdog = setTimeout(() => { if (pending) { pending = false; step(); } }, 6000); }
    function schedule(){ pending = true; armWatchdog(); try { window.print(); } catch(_) { pending = false; step(); } }
    function step(){ left -= 1; if (left > 0) setTimeout(schedule, 350); else { cleanup(); if (typeof onDone === 'function') onDone(); } }
    try { window.addEventListener('afterprint', handleAfter); } catch(_){}
    try { window.addEventListener('focus', handleFocus); } catch(_){}
    setTimeout(schedule, 150);
  }

  function init(){
    const printBtn = document.getElementById('btn-print');
    if (printBtn) printBtn.addEventListener('click', function(){
      let copiesToPrint = 1;
      try { const r = JSON.parse(localStorage.getItem('IF_RECEIPT_SETTINGS') || '{}'); copiesToPrint = Math.max(1, parseInt(r.copies || 1, 10)); } catch(_) {}
      // Ensure store settings applied before printing
      try { storeReady.finally(() => printSequentialSameWindow(copiesToPrint)); }
      catch(_) { printSequentialSameWindow(copiesToPrint); }
    });
    // Apply receipt UI settings
    let rcs = {};
    try { rcs = JSON.parse(localStorage.getItem('IF_RECEIPT_SETTINGS') || '{}'); } catch(_) {}
    try {
      if (rcs.paper === '58'){
        const style = document.createElement('style');
        style.textContent = '@page{size:58mm auto;margin:0} .receipt{width:58mm}';
        document.head.appendChild(style);
      }
      // Identity (title/address/phone/GSTIN) is sourced from backend General Settings below.
      // Apply optional custom footers if present in local settings.
      if (rcs.footer1) { const f1 = document.getElementById('rc-footer1'); if (f1) f1.textContent = rcs.footer1; }
      if (rcs.footer2) { const f2 = document.getElementById('rc-footer2'); if (f2) f2.textContent = rcs.footer2; }
    } catch(_) {}

    // Fetch store details from backend and override company info on receipt
    const storeReady = (async () => {
      try {
        const res = await fetch(baseUrl + '/settings', { headers: authHeaders() });
        if (res.ok){
          const s = await res.json();
          const t = document.getElementById('rc-title'); if (t) t.textContent = (s.company_name || '').trim() || 'InvoiceFlow';
          const a = document.getElementById('rc-store-address'); if (a) a.textContent = (s.address || '').trim();
          const p = document.getElementById('rc-phone'); if (p){ const v=(s.phone||'').trim(); if (v) { p.textContent=v; p.style.display='block'; } }
          const g = document.getElementById('rc-gstin'); if (g){ const v=(s.gstin||'').trim(); if (v) { g.textContent = 'GSTIN: ' + v; g.style.display='block'; } }
        }
      } catch(_){}
      try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(_){}
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    })();
    let payload = null;
    try { payload = JSON.parse(sessionStorage.getItem('IF_RECEIPT_ORDER') || 'null'); } catch(_) {}
    if (!payload){ try { payload = JSON.parse(sessionStorage.getItem('IF_LAST_ORDER') || 'null'); } catch(_) {}
    }
    const qid = getParam('id') || getParam('order_id');
    let currentOrderData = null;
    const orderReady = (async () => {
      if (payload) return payload;
      const fetched = await fetchOrderById(qid);
      return fetched || null;
    })();
    orderReady.then((data)=>{ currentOrderData = data; render(data || payload); }).catch(()=> render(payload));
    // Mark order complete after printing once (auto or manual)
    let completedOnce = false;
    function afterPrint(){
      if (completedOnce) return;
      completedOnce = true;
      const closeAfter = getParam('close') === '1';
      try { markComplete(currentOrderData || payload); } catch(_){ }
      if (closeAfter) { try { window.close(); } catch(_){} }
    }
    try { window.addEventListener('afterprint', afterPrint); } catch(_){ }

    if (getParam('auto') === '1') {
      const copies = Math.max(1, parseInt(getParam('copies') || String(rcs.copies || 1), 10));
      const seq = getParam('seq') === '1';
      const closeAfter = getParam('close') === '1';
      try {
        Promise.allSettled([storeReady, orderReady]).finally(() => {
          if (seq) {
            printSequentialSameWindow(copies, () => { if (closeAfter) { try { window.close(); } catch(_){} } afterPrint(); });
          } else {
            setTimeout(() => { try { window.print(); } catch(_){ } }, 120);
          }
        });
      } catch(_) {
        orderReady.finally(() => {
          if (seq) {
            printSequentialSameWindow(copies, () => { if (closeAfter) { try { window.close(); } catch(_){} } afterPrint(); });
          } else {
            setTimeout(() => { try { window.print(); } catch(_){ } }, 120);
          }
        });
      }
    }
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

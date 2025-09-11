(function(){
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

  function init(){
    document.getElementById('btn-print')?.addEventListener('click', function(){ window.print(); });
    // Apply receipt UI settings
    let rcs = {};
    try { rcs = JSON.parse(localStorage.getItem('IF_RECEIPT_SETTINGS') || '{}'); } catch(_) {}
    try {
      if (rcs.paper === '58'){
        const style = document.createElement('style');
        style.textContent = '@page{size:58mm auto;margin:0} .receipt{width:58mm}';
        document.head.appendChild(style);
      }
      if (rcs.title) { const t = document.getElementById('rc-title'); if (t) t.textContent = rcs.title; }
      if (rcs.subtitle) { const s = document.getElementById('rc-subtitle'); if (s) s.textContent = rcs.subtitle; }
      if (rcs.address) { const a = document.getElementById('rc-store-address'); if (a) a.textContent = rcs.address; }
      if (rcs.phone) { const p = document.getElementById('rc-phone'); if (p){ p.textContent = rcs.phone; p.style.display='block'; } }
      if (rcs.gstin) { const g = document.getElementById('rc-gstin'); if (g){ g.textContent = 'GSTIN: ' + rcs.gstin; g.style.display='block'; } }
      if (typeof rcs.show_tax === 'boolean' && !rcs.show_tax){
        const taxRow = document.getElementById('rc-tax')?.closest('.rc-row');
        if (taxRow) taxRow.style.display = 'none';
        const breakup = document.getElementById('rc-tax-breakup');
        if (breakup) breakup.style.display = 'none';
      }
      if (rcs.footer1) { const f1 = document.getElementById('rc-footer1'); if (f1) f1.textContent = rcs.footer1; }
      if (rcs.footer2) { const f2 = document.getElementById('rc-footer2'); if (f2) f2.textContent = rcs.footer2; }
    } catch(_) {}
    let payload = null;
    try { payload = JSON.parse(sessionStorage.getItem('IF_RECEIPT_ORDER') || 'null'); } catch(_) {}
    if (!payload){ try { payload = JSON.parse(sessionStorage.getItem('IF_LAST_ORDER') || 'null'); } catch(_) {}
    }
    render(payload);
    if (getParam('auto') === '1') {
      // copies from URL takes precedence, else from settings
      const copies = Math.max(1, parseInt(getParam('copies') || String(rcs.copies || 1), 10));
      let i = 0;
      function doPrint(){
        try { window.print(); } catch(_){ }
        i += 1;
        if (i < copies) setTimeout(doPrint, 300);
      }
      setTimeout(doPrint, 100);
    }
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

// Ensure Tailwind global exists even if CDN hasn't loaded yet
window.tailwind = window.tailwind || {};
tailwind.config = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EFF8FF',
          100: '#DBEDFF',
          200: '#C0E2FF',
          300: '#94CEFF',
          400: '#5CB5FF',
          500: '#13A4EC',
          600: '#0E86C4',
          700: '#0A6A9B',
          800: '#084F73',
          900: '#063B56',
        },
        ink: '#0d171b',
        sub: '#4c809a',
      },
      boxShadow: {
        card: '0 2px 12px rgba(16, 24, 40, 0.06)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
};

// Dashboard logic merged from dashboard.js
(function () {
  const baseUrl = 'http://127.0.0.1:8000';

  function authHeaders() {
    const headers = {};
    try {
      let token = localStorage.getItem('IF_TOKEN') || localStorage.IF_TOKEN;
      if (token) {
        if (!token.startsWith('Bearer ')) token = `Bearer ${token}`;
        headers['Authorization'] = token;
      }
    } catch (_) {}
    return headers;
  }

  function dayKey(d){ const x = (window.asDate ? window.asDate(d) : new Date(d)); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }
  function dateRangeDays(from, to){
    const out = [];
    const d0 = new Date(from); d0.setHours(0,0,0,0);
    const d1 = new Date(to); d1.setHours(0,0,0,0);
    for (let d = new Date(d0); d <= d1; d.setDate(d.getDate()+1)){
      out.push(new Date(d));
    }
    return out;
  }
  function computeUsersSeries(users, from, to){
    const days = dateRangeDays(from, to);
    const map = new Map(days.map(d => [dayKey(d), 0]));
    for (const u of (Array.isArray(users)?users:[])){
      const k = dayKey(u.created_at || u.updated_at || Date.now());
      if (map.has(k)) map.set(k, (map.get(k)||0) + 1);
    }
    return { labels: days.map(d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`), values: days.map(d => map.get(dayKey(d))||0) };
  }
  function renderUsersChart(series){
    const el = document.getElementById('area-chart'); if (!el) return;
    if (!window.ApexCharts) return;
    if (el._apexChart) { try { el._apexChart.destroy(); } catch(_){} el._apexChart = null; }
    const isDark = document.documentElement.classList.contains('dark');
    const chart = new ApexCharts(el, {
      chart: { type: 'area', height: 260, toolbar: { show: false }, foreColor: isDark ? '#CBD5E1' : undefined },
      theme: { mode: isDark ? 'dark' : 'light' },
      series: [{ name: 'Users', data: series.values }],
      xaxis: { categories: series.labels, labels: { rotate: 0, style: { colors: isDark ? '#94a3b8' : '#94a3b8' } } },
      yaxis: { labels: { style: { colors: isDark ? '#94a3b8' : '#94a3b8' } } },
      colors: ['#13A4EC'],
      dataLabels: { enabled: false },
      grid: { borderColor: isDark ? '#334155' : '#e2e8f0', strokeDashArray: 3 },
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 } }
    });
    chart.render();
    el._apexChart = chart;
  }

  async function fetchAndUpdateMetrics() {
    try {
      // Fetch orders, customers, and items in parallel
      const [ordersRes, customersRes, itemsRes, usersRes] = await Promise.all([
        fetch(baseUrl + '/orders', { headers: authHeaders() }),
        fetch(baseUrl + '/customers', { headers: authHeaders() }),
        fetch(baseUrl + '/items', { headers: authHeaders() }),
        fetch(baseUrl + '/users', { headers: authHeaders() })
      ]);

      if (!ordersRes.ok) throw new Error('Orders fetch failed: ' + await ordersRes.text());
      if (!customersRes.ok) throw new Error('Customers fetch failed: ' + await customersRes.text());
      if (!itemsRes.ok) throw new Error('Items fetch failed: ' + await itemsRes.text());
      if (!usersRes.ok) throw new Error('Users fetch failed: ' + await usersRes.text());

      const orders = await ordersRes.json();
      const customers = await customersRes.json();
      const items = await itemsRes.json();
      const users = await usersRes.json();
      const itemById = new Map(Array.isArray(items) ? items.map(i => [i.id, i]) : []);
      window._usersCache = Array.isArray(users) ? users : [];

      // Compute totals
      let totalSales = 0;
      let completed = 0;
      let cancelled = 0;

      if (Array.isArray(orders)) {
        for (const o of orders) {
          const t = parseFloat(o.total || o.amount || 0);
          if (!Number.isNaN(t)) totalSales += t;
          const st = (o.status || '').toString().toLowerCase();
          if (st.includes('complete')) completed += 1;
          if (st.includes('cancel')) cancelled += 1;
        }
      }

      // Update DOM (format rupee)
      const totalSalesEl = document.getElementById('total-sales');
      const totalCustomersEl = document.getElementById('total-customers');
      const ordersCompletedEl = document.getElementById('orders-completed');
      const ordersCancelledEl = document.getElementById('orders-cancelled');

      if (totalSalesEl) totalSalesEl.textContent = '\u20b9' + totalSales.toFixed(2);
      if (totalCustomersEl) totalCustomersEl.textContent = (Array.isArray(customers) ? customers.length : '0');
      if (ordersCompletedEl) ordersCompletedEl.textContent = completed;
      if (ordersCancelledEl) ordersCancelledEl.textContent = cancelled;

      // Update Total Sales card (last 30 days + delta vs previous 30 days)
      try {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()-30);
        const prevFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()-60);
        const prevTo = new Date(now.getFullYear(), now.getMonth(), now.getDate()-30);
        let cur = 0, prev = 0;
        for (const o of (Array.isArray(orders)?orders:[])){
          const st = (o.status||'').toString().toLowerCase();
          if (st !== 'completed') continue;
          const d = (window.asDate ? window.asDate(o.created_at || o.updated_at || now) : new Date(o.created_at || o.updated_at || now));
          const amt = parseFloat(o.total||0) || 0;
          if (d >= from && d < now) cur += amt;
          else if (d >= prevFrom && d < prevTo) prev += amt;
        }
        const amtEl = document.getElementById('dash-total-sales-amount');
        const deltaEl = document.getElementById('dash-total-sales-delta');
        const fmt = (v)=>{ try { return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(v).replace(/^₹\s?/, '₹'); } catch(_) { return '₹'+v.toFixed(0);} };
        if (amtEl) amtEl.textContent = fmt(cur);
        if (deltaEl) {
          const delta = prev ? ((cur - prev) / prev) * 100 : (cur>0?100:0);
          const up = delta >= 0;
          deltaEl.textContent = `${up?'+':''}${delta.toFixed(1)}%`;
          deltaEl.classList.toggle('text-emerald-600', up);
          deltaEl.classList.toggle('text-rose-600', !up);
        }
      } catch(_) {}

      // Top selling: compute simple counts from order.items
      try {
        const topListEl = document.getElementById('top-selling-list');
        if (topListEl && Array.isArray(orders)) {
          // First aggregate quantities by item_id
          const qtyById = new Map();
          for (const o of orders) {
            if (!Array.isArray(o.items)) continue;
            for (const it of o.items) {
              const id = it.item_id || (it.item && it.item.id) || it.id;
              const qty = Number(it.qty || it.quantity || it.count || 1) || 1;
              if (id != null) qtyById.set(id, (qtyById.get(id) || 0) + qty);
            }
          }
          // Map to names using items list
          const entries = Array.from(qtyById.entries()).map(([id, q]) => {
            const rec = itemById.get(id) || {};
            const label = rec.name || rec.sku || `Item ${id}`;
            return [label, q];
          });
          const sorted = entries.sort((a, b) => b[1] - a[1]);
          const top3 = sorted.slice(0, 3);
          const totalQty = Array.from(qtyById.values()).reduce((s,v)=>s+v,0) || 0;
          if (top3.length === 0) {
            topListEl.innerHTML = '<div class="text-sm text-slate-500">No product data</div>';
          } else {
            topListEl.innerHTML = top3.map(([name, q]) => {
              const pct = totalQty > 0 ? Math.round((q / totalQty) * 100) : 0;
              const color = pct >= 50 ? 'bg-brand-500' : pct >= 20 ? 'bg-emerald-500' : 'bg-amber-400';
              return `
                <div>
                  <div class="flex items-center justify-between text-sm font-medium text-slate-700">
                    <span>${name}</span><span>${pct}%</span>
                  </div>
                  <div class="mt-2 h-2 w-full rounded-full bg-slate-100">
                    <div class="h-2 rounded-full ${color}" style="width:${pct}%"></div>
                  </div>
                </div>`;
            }).join('');
          }
        }
      } catch (e) {
        // ignore render errors
      }

      // Render users area chart (default last 7 days)
      try {
        updateUsersCard('7');
      } catch (_) {}
    } catch (err) {
      // Silent failure: keep existing values, but log for debugging
      console.error('dashboard metrics error', err);
    }
  }

  function rangeFromKey(key){
    const now = new Date();
    let from = new Date(now); from.setHours(0,0,0,0);
    let to = new Date(now); to.setHours(23,59,59,999);
    let label = '';
    if (key === 'today') { label = 'Today'; }
    else if (key === 'yesterday') { const d = new Date(now); d.setDate(d.getDate()-1); from = new Date(d); from.setHours(0,0,0,0); to = new Date(d); to.setHours(23,59,59,999); label = 'Yesterday'; }
    else {
      const days = parseInt(key, 10) || 7; label = `Last ${days} days`;
      from = new Date(now); from.setDate(from.getDate() - (days-1)); from.setHours(0,0,0,0);
      to = new Date(now); to.setHours(23,59,59,999);
    }
    return { from, to, label };
  }

  function updateUsersCard(rangeKey){
    const { from, to, label } = rangeFromKey(rangeKey);
    const list = Array.isArray(window._usersCache) ? window._usersCache : [];
    const series = computeUsersSeries(list, from, to);
    renderUsersChart(series);

    // Total users in range
    const inRange = list.filter(u => { const d = new Date(u.created_at); return d>=from && d<=to; }).length;
    const labelEl = document.getElementById('users-range-label'); if (labelEl) labelEl.textContent = label;
    const totalEl = document.getElementById('users-total'); if (totalEl) totalEl.textContent = String(inRange);
    const totalLblEl = document.getElementById('users-total-label'); if (totalLblEl) totalLblEl.textContent = `Users ${label.toLowerCase()}`;

    // Delta vs previous equal period
    const days = Math.max(1, Math.round((to - from) / (24*3600*1000)) + 1);
    const prevTo = new Date(from); prevTo.setHours(23,59,59,999);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (days-1)); prevFrom.setHours(0,0,0,0);
    const prevCount = list.filter(u => { const d = new Date(u.created_at); return d>=prevFrom && d<=prevTo; }).length;
    const delta = prevCount ? ((inRange - prevCount)/prevCount)*100 : (inRange>0?100:0);
    const deltaEl = document.getElementById('users-delta'); const wrap = document.getElementById('users-delta-wrap'); const icon = document.getElementById('users-delta-icon');
    if (deltaEl) deltaEl.textContent = `${delta>=0?'+':''}${delta.toFixed(1)}%`;
    if (wrap) { wrap.classList.toggle('text-emerald-600', delta>=0); wrap.classList.toggle('text-rose-600', delta<0); }
    if (icon) { icon.style.transform = delta>=0 ? 'rotate(0deg)' : 'rotate(180deg)'; }
  }

  function initDashboard() {
    // Hide static fallback if ApexCharts is available
    try { if (window.ApexCharts && document.getElementById('dash-sales-chart-fallback')) document.getElementById('dash-sales-chart-fallback').style.display='none'; } catch(_){}
    // Initial load with loader overlay
    if (window.withLoader) { window.withLoader(fetchAndUpdateMetrics); } else { fetchAndUpdateMetrics(); }
    // Wire header buttons
    const btnReport = document.getElementById('btn-generate-report');
    const btnAddProduct = document.getElementById('btn-add-product');
    const btnNewInvoice = document.getElementById('btn-new-invoice');
    if (btnReport) btnReport.addEventListener('click', () => { window.location.href = 'reports.html'; });
    if (btnAddProduct) btnAddProduct.addEventListener('click', () => { window.location.href = 'items.html#add'; });
    if (btnNewInvoice) btnNewInvoice.addEventListener('click', () => { window.location.href = 'orders.html#new'; });

    // timeframe buttons: toggle active class and refresh metrics
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('bg-brand-500', 'text-white'));
        btn.classList.add('bg-brand-500', 'text-white');
        // optionally pass timeframe to fetchAndUpdateMetrics in future
      });
    });

    // Range dropdown for users chart
    try {
      const btn = document.getElementById('dropdownDefaultButton');
      const dd = document.getElementById('lastDaysdropdown');
      if (btn && dd){
        btn.addEventListener('click', (e)=>{ e.preventDefault(); dd.classList.toggle('hidden'); });
        dd.addEventListener('click', (e)=>{
          const a = e.target.closest('a[data-range]');
          if (!a) return;
          e.preventDefault();
          const key = a.getAttribute('data-range');
          updateUsersCard(key);
          dd.classList.add('hidden');
        });
        document.addEventListener('click', (e)=>{ if (!dd.contains(e.target) && e.target !== btn) dd.classList.add('hidden'); });
      }
    } catch(_){}

    // Refresh when orders websocket sends updates
    try {
      const ws = new WebSocket('ws://127.0.0.1:8000/ws/orders');
      ws.addEventListener('message', ev => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg && msg.type === 'order_update') {
            fetchAndUpdateMetrics();
          }
        } catch (e) { }
      });
      ws.addEventListener('error', () => { /* ignore */ });
    } catch (e) { /* ignore */ }

    // Optional: refresh every 60s as fallback
    setInterval(fetchAndUpdateMetrics, 60000);

    // Live header time (HH:MM + AM/PM)
    function updateHeaderClock(){
      try {
        const d = new Date();
        const t = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const parts = t.split(' ');
        const hm = parts[0] || '';
        const ap = (parts[1] || '').toUpperCase();
        const hmEl = document.getElementById('header-time-hm');
        const apEl = document.getElementById('header-time-ap');
        if (hmEl) hmEl.textContent = hm;
        if (apEl) apEl.textContent = ap;
      } catch(_){}
    }
    updateHeaderClock();
    setInterval(updateHeaderClock, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
  } else {
    initDashboard();
  }

})();

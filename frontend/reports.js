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
      },
      boxShadow: { card: '0 2px 12px rgba(16, 24, 40, 0.06)' },
      borderRadius: { xl2: '1rem' },
    },
  },
};

(function() {
  const baseUrl = 'http://127.0.0.1:8000';
  const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

  function authHeaders() {
    const headers = {};
    try {
      let token = localStorage.getItem('IF_TOKEN');
      if (token) {
        if (!token.startsWith('Bearer ')) token = `Bearer ${token}`;
        headers['Authorization'] = token;
      }
    } catch (_) {}
    return headers;
  }

  async function fetchJSON(endpoint) {
    const res = await fetch(baseUrl + endpoint, { headers: authHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
  function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function monthKey(d){ const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`; }

  function setText(id, text){ const el = document.getElementById(id); if (el) el.textContent = text; }
  function setDir(id, up){ const el = document.getElementById(id); if (!el) return; el.textContent = up ? '↑' : '↓'; el.className = up ? 'text-emerald-600 text-sm font-semibold' : 'text-rose-600 text-sm font-semibold'; }

  function computeQuarterRanges() {
    const now = new Date();
    const curStart = addDays(now, -90);
    const prevStart = addDays(now, -180);
    const prevEnd = addDays(now, -90);
    return { now, curStart, prevStart, prevEnd };
  }

  function sumCompleted(orders, from, to) {
    const f = startOfDay(from); const t = startOfDay(to || new Date());
    let total = 0;
    for (const o of orders) {
      if ((o.status||'').toLowerCase() !== 'completed') continue;
      const d = new Date(o.created_at);
      if (d >= f && d < t) total += parseFloat(o.total || 0);
    }
    return total;
  }

  function ratioCanceled(orders, from, to){
    const f = startOfDay(from); const t = startOfDay(to || new Date());
    let canceled = 0, total = 0;
    for (const o of orders) {
      const d = new Date(o.created_at);
      if (d >= f && d < t) {
        total += 1;
        if ((o.status||'').toLowerCase() === 'canceled') canceled += 1;
      }
    }
    return total ? (canceled/total) : 0;
  }

  function topItemByQty(orders, items, from, to){
    const f = startOfDay(from); const t = startOfDay(to || new Date());
    const qtyById = new Map();
    for (const o of orders) {
      const d = new Date(o.created_at);
      if (d < f || d >= t) continue;
      if ((o.items||[]).length) {
        for (const it of o.items) {
          const id = it.item_id; const q = Number(it.qty||0);
          qtyById.set(id, (qtyById.get(id)||0) + q);
        }
      }
    }
    let bestId=null, bestQty=0;
    for (const [id, q] of qtyById.entries()) if (q>bestQty){bestQty=q; bestId=id;}
    const name = (items.find(i => i.id === bestId)?.name) || (bestId ? `Item ${bestId}` : '—');
    return { name, qty: bestQty };
  }

  function monthlyRevenueSeries(orders){
    const now = new Date();
    const months = [];
    const map = new Map();
    for (let i=11;i>=0;i--){
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const k = monthKey(d);
      months.push(k);
      map.set(k, 0);
    }
    for (const o of orders){
      if ((o.status||'').toLowerCase() !== 'completed') continue;
      const k = monthKey(o.created_at || o.updated_at || new Date());
      if (map.has(k)) map.set(k, map.get(k) + parseFloat(o.total||0));
    }
    return { months, values: months.map(k => Math.round(map.get(k)||0)) };
  }

  function renderRevenueChart(series){
    const el = document.getElementById('rep-revenue-chart'); if (!el) return;
    if (!window.ApexCharts) { el.textContent = 'Chart unavailable'; return; }
    if (el._apexChart) { el._apexChart.destroy(); el._apexChart = null; }
    const isDark = document.documentElement.classList.contains('dark');
    const chart = new ApexCharts(el, {
      chart: { type: 'bar', height: 260, toolbar: { show: false }, foreColor: isDark ? '#CBD5E1' : undefined },
      theme: { mode: isDark ? 'dark' : 'light' },
      series: [{ name: 'Revenue', data: series.values }],
      xaxis: { categories: series.months, labels: { rotate: 0, style: { colors: isDark ? '#94a3b8' : '#94a3b8' } } },
      yaxis: { labels: { style: { colors: isDark ? '#94a3b8' : '#94a3b8' }, formatter: (v)=> INR.format(v).replace(/^₹\s?/, '₹') } },
      colors: ['#13A4EC'],
      grid: { borderColor: isDark ? '#334155' : '#e2e8f0', strokeDashArray: 3 },
      dataLabels: { enabled: false },
    });
    chart.render();
    el._apexChart = chart;
  }

  function renderTopItemsChart(data){
    const el = document.getElementById('rep-top-items-chart'); if (!el) return;
    if (!window.ApexCharts) { el.textContent = 'Chart unavailable'; return; }
    if (el._apexChart) { el._apexChart.destroy(); el._apexChart = null; }
    const isDark = document.documentElement.classList.contains('dark');
    const labels = data.map(d => d.name);
    const values = data.map(d => d.qty);
    const chart = new ApexCharts(el, {
      chart: { type: 'bar', height: 260, toolbar: { show: false }, foreColor: isDark ? '#CBD5E1' : undefined },
      theme: { mode: isDark ? 'dark' : 'light' },
      series: [{ name: 'Units', data: values }],
      xaxis: { categories: labels, labels: { style: { colors: isDark ? '#94a3b8' : '#94a3b8' } } },
      plotOptions: { bar: { horizontal: true } },
      colors: ['#0E86C4'],
      grid: { borderColor: isDark ? '#334155' : '#e2e8f0', strokeDashArray: 3 },
      dataLabels: { enabled: false },
    });
    chart.render();
    el._apexChart = chart;
  }

  async function loadReports(){
    try {
      try { window.showLoader && window.showLoader(); } catch(_){}
      const [orders, customers, items] = await Promise.all([
        fetchJSON('/orders'),
        fetchJSON('/customers'),
        fetchJSON('/items')
      ]);
      const { now, curStart, prevStart, prevEnd } = computeQuarterRanges();

      const curSales = sumCompleted(orders, curStart, now);
      const prevSales = sumCompleted(orders, prevStart, prevEnd);
      const salesGrowth = prevSales ? ((curSales - prevSales) / prevSales) * 100 : (curSales>0?100:0);
      setText('rep-sales-growth', `${salesGrowth.toFixed(1)}%`);
      setDir('rep-sales-growth-dir', salesGrowth >= 0);

      const curRefund = ratioCanceled(orders, curStart, now) * 100;
      const prevRefund = ratioCanceled(orders, prevStart, prevEnd) * 100;
      const refundDelta = curRefund - prevRefund;
      setText('rep-refund-rate', `${curRefund.toFixed(1)}%`);
      setDir('rep-refund-dir', refundDelta <= 0); // green when going down

      const top = topItemByQty(orders, items, curStart, now);
      setText('rep-top-performer', top.name);
      setText('rep-top-performer-units', `${top.qty} units`);

      const curNewCust = customers.filter(c => new Date(c.created_at) >= curStart).length;
      const prevNewCust = customers.filter(c => new Date(c.created_at) >= prevStart && new Date(c.created_at) < prevEnd).length;
      const custChange = prevNewCust ? ((curNewCust - prevNewCust)/prevNewCust)*100 : (curNewCust>0?100:0);
      setText('rep-new-customers', String(curNewCust));
      setText('rep-new-customers-change', `${custChange>=0?'↑':'↓'} ${Math.abs(custChange).toFixed(1)}%`);

      // Charts
      renderRevenueChart(monthlyRevenueSeries(orders));

      // Top 5 items (qty) in current quarter
      const qtyBy = new Map();
      const f = startOfDay(curStart); const t = startOfDay(now);
      for (const o of orders){
        const d = new Date(o.created_at); if (d<f || d>=t) continue;
        for (const it of (o.items||[])){
          qtyBy.set(it.item_id, (qtyBy.get(it.item_id)||0) + Number(it.qty||0));
        }
      }
      const topList = Array.from(qtyBy.entries()).map(([id, qty])=>({
        name: items.find(i=>i.id===id)?.name || `Item ${id}`,
        qty
      })).sort((a,b)=>b.qty-a.qty).slice(0,5);
      renderTopItemsChart(topList);

      // Insights & Annotations
      renderInsights({ orders, customers, items, curStart, now, prevStart, prevEnd });

    } catch (err) {
      console.error('Reports load failed:', err);
    } finally {
      try { window.hideLoader && window.hideLoader(); } catch(_){}
    }
  }

  function renderInsights(ctx){
    const { orders, items, curStart, now, prevStart, prevEnd } = ctx;
    const list = [];

    // Insight 1: WoW orders change
    const nowDay = startOfDay(now);
    const woStart = addDays(nowDay, -7), woPrevStart = addDays(nowDay, -14), woPrevEnd = addDays(nowDay, -7);
    const countIn = (from, to) => orders.filter(o => { const d=new Date(o.created_at); return d>=from && d<to; }).length;
    const curCnt = countIn(woStart, nowDay), prevCnt = countIn(woPrevStart, woPrevEnd);
    if (prevCnt || curCnt) {
      const pct = prevCnt ? ((curCnt - prevCnt)/prevCnt)*100 : (curCnt>0?100:0);
      list.push({ type: 'Automated Insight', text: `Orders are ${pct>=0?'up':'down'} ${Math.abs(pct).toFixed(1)}% WoW.`});
    }

    // Insight 2: Category surge (qty)
    const catMap = new Map();
    const catPrev = new Map();
    const itemById = new Map(items.map(i=>[i.id,i]));
    for (const o of orders){
      const d = new Date(o.created_at);
      const target = (d>=woStart && d<nowDay) ? catMap : (d>=woPrevStart && d<woPrevEnd) ? catPrev : null;
      if (!target) continue;
      for (const it of (o.items||[])){
        const cat = (itemById.get(it.item_id)?.category || 'Uncategorized');
        target.set(cat, (target.get(cat)||0) + Number(it.qty||0));
      }
    }
    let bestCat=null, bestDelta=0;
    for (const [cat, q] of catMap.entries()){
      const prev = catPrev.get(cat)||0;
      const delta = prev? ((q-prev)/prev)*100 : (q>0?100:0);
      if (delta>bestDelta){ bestDelta=delta; bestCat=cat; }
    }
    if (bestCat){ list.push({ type: 'Automated Insight', text: `${bestCat} category grew the most WoW (+${bestDelta.toFixed(1)}%).`}); }

    // Insight 3: Refund spike alert (daily >2%)
    const days = 14;
    for (let i=days;i>=1;i--){
      const d0 = addDays(nowDay, -i), d1 = addDays(nowDay, -i+1);
      const inDay = orders.filter(o => { const d=new Date(o.created_at); return d>=d0 && d<d1; });
      if (!inDay.length) continue;
      const canc = inDay.filter(o => (o.status||'').toLowerCase()==='canceled').length;
      const ratio = canc / inDay.length;
      if (ratio > 0.02) {
        list.push({ type: 'Alert', text: `Refund rate ${Math.round(ratio*1000)/10}% on ${d0.toLocaleDateString('en-IN')}.`});
        break;
      }
    }

    // Insight 4: Low stock notes
    const low = items.filter(i => (i.stock||0) <= (i.reorder_point||0));
    if (low.length){
      list.push({ type: 'Note', text: `${low.length} item(s) at or below reorder point.`});
    }

    // User notes from localStorage
    let userNotes = [];
    try { userNotes = JSON.parse(localStorage.getItem('IF_REPORT_USER_NOTES')||'[]'); } catch(_) {}
    userNotes.forEach(txt => list.push({ type: 'Note', text: String(txt).trim() }));

    const container = document.getElementById('rep-insights');
    if (!container) return;
    if (!list.length){ container.innerHTML = '<div class="text-slate-500">No insights available</div>'; return; }
    container.innerHTML = list.map(entry => {
      const tone = entry.type === 'Alert' ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200';
      const labelClass = entry.type === 'Alert' ? 'text-rose-700' : 'text-slate-500';
      return `
        <div class="rounded-xl border ${tone} p-4">
          <div class="text-xs ${labelClass}">${entry.type}</div>
          <div class="mt-1 font-medium text-ink">${entry.text}</div>
        </div>`;
    }).join('');
  }

  function init(){
    document.getElementById('btn-reports-refresh')?.addEventListener('click', loadReports);
    document.getElementById('btn-export-pdf')?.addEventListener('click', ()=> window.print());
    document.getElementById('rep-add-note')?.addEventListener('click', () => {
      const inp = document.getElementById('rep-note-input');
      if (!inp) return;
      const val = inp.value.trim();
      if (!val) return;
      let userNotes = [];
      try { userNotes = JSON.parse(localStorage.getItem('IF_REPORT_USER_NOTES')||'[]'); } catch(_) {}
      userNotes.push(val);
      localStorage.setItem('IF_REPORT_USER_NOTES', JSON.stringify(userNotes));
      inp.value = '';
      loadReports();
    });
    document.getElementById('rep-export-notes')?.addEventListener('click', () => {
      const container = document.getElementById('rep-insights');
      if (!container) return;
      const text = container.innerText.trim();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `insights-${new Date().toISOString().slice(0,10)}.txt`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    loadReports();
    try { window.addEventListener('IF_THEME_CHANGED', () => loadReports()); } catch(_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();

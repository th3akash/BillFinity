(function(){
  function applyState(){
    try {
      const hidden = localStorage.getItem('IF_SIDEBAR_HIDDEN') === '1';
      document.body.classList.toggle('sidebar-hidden', hidden);
    } catch (_) {}
  }
  function wire(){
    applyState();
    const btn = document.getElementById('toggle-sidebar');
    if (btn) {
      btn.addEventListener('click', function(){
        const nowHidden = !document.body.classList.contains('sidebar-hidden');
        document.body.classList.toggle('sidebar-hidden', nowHidden);
        try { localStorage.setItem('IF_SIDEBAR_HIDDEN', nowHidden ? '1' : '0'); } catch(_){}
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();


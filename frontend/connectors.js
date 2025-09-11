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

(function(){
  function init(){
    // Remove any printer-related card if present
    const btn = document.getElementById('btn-create-print-thermal');
    if (btn) {
      const card = btn.closest('.connector-card');
      if (card) card.remove();
    }
    const openBtn = document.getElementById('btn-open-receipt');
    if (openBtn) {
      const card = openBtn.closest('.connector-card');
      if (card) card.remove();
    }
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

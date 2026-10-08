/* Applies the saved light/dark choice before the page paints. */
try { var t = localStorage.getItem('cc-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) { /* no storage */ }

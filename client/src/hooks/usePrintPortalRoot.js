import { useState, useEffect } from 'react';

export function usePrintPortalRoot() {
  const [el, setEl] = useState(null);

  useEffect(() => {
    let root = document.getElementById('print-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'print-root';
      document.body.appendChild(root);
    }
    setEl(root);

    // אנחנו לא מסירים את האלמנט ביציאה כדי למנוע הבהובים, 
    // אבל אפשר להוסיף root.remove() ב-cleanup אם רוצים.
    return () => {};
  }, []);

  return el;
}
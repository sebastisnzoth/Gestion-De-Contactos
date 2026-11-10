import { useState } from 'react';

export default function RespetoPopup() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div
      role="presentation"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15, 23, 42, 0.60)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="respeto-popup-title"
        style={{ width: '100%', maxWidth: 360, padding: '32px 28px', borderRadius: 18, background: '#fff', color: '#111827', textAlign: 'center', boxShadow: '0 24px 70px rgba(0,0,0,0.25)' }}
      >
        <h2 id="respeto-popup-title" style={{ fontSize: 30, lineHeight: 1.2, fontWeight: 700, margin: '0 0 24px' }}>respeto</h2>
        <button type="button" autoFocus onClick={() => setVisible(false)} style={{ border: 0, borderRadius: 10, padding: '12px 28px', background: '#2563eb', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

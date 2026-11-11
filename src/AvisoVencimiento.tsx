import { useEffect, useState } from 'react';

// Medianoche del 16 de noviembre de 2026, horario de Brasilia (UTC-03:00).
const DEADLINE = new Date('2026-11-16T00:00:00-03:00').getTime();

function getRemaining() {
  return Math.max(0, DEADLINE - Date.now());
}

function formatPart(value: number) {
  return String(value).padStart(2, '0');
}

export default function AvisoVencimiento() {
  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getRemaining()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <aside
      aria-label="Aviso de fecha límite de la herramienta"
      role="status"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 9000,
        maxWidth: 620,
        margin: '0 auto',
        padding: '16px 20px',
        borderRadius: 16,
        background: '#7f1d1d',
        color: '#ffffff',
        boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
        textAlign: 'center',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>
        ⚠️ Aviso importante
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
        Esta herramienta dejará de funcionar el <strong>16 de noviembre de 2026</strong>.
      </div>
      <div style={{ fontSize: 12, marginTop: 10, opacity: 0.88 }}>
        {remaining > 0 ? 'Tiempo restante:' : 'La fecha anunciada ya llegó.'}
      </div>
      {remaining > 0 && (
        <div
          aria-label={`${days} días, ${hours} horas, ${minutes} minutos y ${seconds} segundos`}
          style={{ fontSize: 24, fontWeight: 800, marginTop: 3, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}
        >
          {days}d {formatPart(hours)}h {formatPart(minutes)}m {formatPart(seconds)}s
        </div>
      )}
    </aside>
  );
}

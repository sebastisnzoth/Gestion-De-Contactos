import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Temporary, reversible client-side availability notice.
 * To reactivate the tool, set PAUSE_ENABLED to false and redeploy.
 * No user files, data or business logic are deleted or changed.
 * This is a UI pause, not a secure server-side access-control mechanism.
 */
const PAUSE_ENABLED = true;
const DEADLINE = new Date('2026-11-14T00:00:00-03:00').getTime();
const NOTICE_DISMISSED_KEY = 'gestion-contactos-notice-2026-11-13';

function getRemaining() {
  return Math.max(0, DEADLINE - Date.now());
}

function formatCountdown(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [days, hours, minutes, secs].map(value => String(value).padStart(2, '0')).join(' : ');
}

export default function ServiceNotice({ children }: { children: ReactNode }) {
  const [remaining, setRemaining] = useState(getRemaining);
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && window.sessionStorage.getItem(NOTICE_DISMISSED_KEY) === 'yes'
  );

  useEffect(() => {
    if (!PAUSE_ENABLED) return;
    const interval = window.setInterval(() => setRemaining(getRemaining()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const closeAndContact = () => {
    // Open Instagram in a separate tab, then navigate this tab to WhatsApp.
    // Browsers may block the extra tab if popup protection is enabled.
    window.open('https://www.instagram.com/sebastian_zoth/', '_blank', 'noopener,noreferrer');
    window.sessionStorage.setItem(NOTICE_DISMISSED_KEY, 'yes');
    setDismissed(true);
    window.location.assign('https://wa.me/5548996752532');
  };

  if (!PAUSE_ENABLED) return <>{children}</>;

  const expired = remaining <= 0;
  return (
    <>
      {!expired && children}
      {!expired && (
        <div style={{ position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 90, maxWidth: 720, margin: '0 auto', padding: '12px 18px', borderRadius: 16, background: '#172033', color: 'white', boxShadow: '0 10px 30px #0003', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }} role="status">
          <span>Disponibilidad de la herramienta hasta el viernes 13/11/2026</span>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCountdown(remaining)}</strong>
        </div>
      )}
      {(expired || !dismissed) && (
        <div role="dialog" aria-modal="true" aria-labelledby="availability-title" style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#080e1bcf', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <section style={{ width: '100%', maxWidth: 540, borderRadius: 24, background: 'white', color: '#15213a', padding: 'clamp(22px, 5vw, 38px)', boxShadow: '0 20px 70px #0005', textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 12 }} aria-hidden="true">⏳</div>
            <h2 id="availability-title" style={{ margin: '0 0 14px', fontSize: 'clamp(22px, 4vw, 28px)' }}>{expired ? 'Herramienta temporalmente pausada' : 'Aviso importante'}</h2>
            <p style={{ lineHeight: 1.6, fontSize: 16 }}>
              Si sigo bloqueado, estas herramientas van a dejar de funcionar, ya que no tiene sentido mantenerlas online en estas condiciones.
            </p>
            <p style={{ lineHeight: 1.6, fontSize: 16 }}>
              Si yo no te importo, ¿por qué debería importarme mantener esto y para qué?
            </p>
            <p style={{ fontSize: 13, opacity: 0.75, marginTop: 16 }}>
              {expired ? 'El plazo terminó. El acceso queda pausado hasta una decisión de reactivación.' : 'Plazo: viernes 13 de noviembre de 2026, 23:59 (hora de Brasil).'}
            </p>
            {!expired && (
              <>
                <div aria-label="Cuenta regresiva" style={{ fontSize: 'clamp(23px, 6vw, 36px)', fontWeight: 800, letterSpacing: 1.5, fontVariantNumeric: 'tabular-nums', margin: '18px 0' }}>{formatCountdown(remaining)}</div>
                <small style={{ display: 'block', marginBottom: 18, opacity: 0.7 }}>Días : horas : minutos : segundos</small>
                <button type="button" onClick={closeAndContact} style={{ border: 0, borderRadius: 12, padding: '13px 24px', background: '#263bdb', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>Cerrar</button>
              </>
            )}
            {expired && <><p style={{ fontSize: 13, opacity: 0.7 }}>No se eliminaron archivos ni contactos.</p><button type="button" onClick={closeAndContact} style={{ border: 0, borderRadius: 12, padding: '13px 24px', background: '#263bdb', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>Cerrar</button></>}
          </section>
        </div>
      )}
    </>
  );
}

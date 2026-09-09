import type { Contact, GlobalConfig } from '../types';

const CONTACTS_KEY = 'gestion-contactos.contacts.v2';
const CONFIG_KEY = 'gestion-contactos.config.v2';

export function loadStoredContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    return raw ? JSON.parse(raw) as Contact[] : [];
  } catch {
    return [];
  }
}

export function saveStoredContacts(contacts: Contact[]): void {
  try {
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  } catch {
    // La aplicación puede seguir funcionando aunque el navegador bloquee storage.
  }
}

export function loadStoredConfig(fallback: GlobalConfig): GlobalConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<GlobalConfig>), waToken: '' } : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Persistimos preferencias no sensibles. El token de WhatsApp queda sólo en memoria.
 */
export function saveStoredConfig(config: GlobalConfig): void {
  try {
    const { waToken: _waToken, ...safeConfig } = config;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(safeConfig));
  } catch {
    // No interrumpir el flujo principal por errores de persistencia local.
  }
}

export function clearStoredContacts(): void {
  try {
    localStorage.removeItem(CONTACTS_KEY);
  } catch {
    // noop
  }
}

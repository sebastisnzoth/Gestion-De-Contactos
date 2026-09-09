import type { Contact, CompRecord } from '../types';

const DUPLICATE_NOTE_RE = /\[DUPLICADO con:.*?\]/g;

export function normalizePhone(value: string): string {
  return (value || '').replace(/\D/g, '');
}

export function normalizeEmail(value: string): string {
  return (value || '').trim().toLowerCase();
}

function cleanDuplicateNote(notes: string): string {
  let clean = (notes || '').replace(DUPLICATE_NOTE_RE, '').trim();
  if (clean.endsWith('|')) clean = clean.slice(0, -1).trim();
  return clean;
}

function appendDuplicateNote(notes: string, names: string[]): string {
  const clean = cleanDuplicateNote(notes);
  const uniqueNames = [...new Set(names.filter(Boolean))];
  if (!uniqueNames.length) return clean;
  const note = `[DUPLICADO con: ${uniqueNames.join(', ')}]`;
  return clean ? `${clean} | ${note}` : note;
}

/**
 * Detecta duplicados por teléfono normalizado y, cuando existe, por email.
 * Devuelve una nueva lista y no muta los contactos originales.
 */
export function detectContactDuplicates(list: Contact[]): Contact[] {
  const phoneMap = new Map<string, Contact[]>();
  const emailMap = new Map<string, Contact[]>();

  list.forEach(contact => {
    const phones = [...new Set([contact.phone1, contact.phone2]
      .map(normalizePhone)
      .filter(phone => phone.length >= 8))];

    phones.forEach(phone => {
      const group = phoneMap.get(phone) || [];
      group.push(contact);
      phoneMap.set(phone, group);
    });

    const email = normalizeEmail(contact.email);
    if (email && email.includes('@')) {
      const group = emailMap.get(email) || [];
      group.push(contact);
      emailMap.set(email, group);
    }
  });

  return list.map(contact => {
    const related = new Map<string, Contact>();
    const phones = [...new Set([contact.phone1, contact.phone2]
      .map(normalizePhone)
      .filter(phone => phone.length >= 8))];

    phones.forEach(phone => {
      phoneMap.get(phone)?.forEach(other => {
        if (other.id !== contact.id) related.set(other.id, other);
      });
    });

    const email = normalizeEmail(contact.email);
    if (email && email.includes('@')) {
      emailMap.get(email)?.forEach(other => {
        if (other.id !== contact.id) related.set(other.id, other);
      });
    }

    const matches = [...related.values()];
    return {
      ...contact,
      isDuplicate: matches.length > 0,
      notes: matches.length
        ? appendDuplicateNote(contact.notes, matches.map(item => item.fullName))
        : cleanDuplicateNote(contact.notes),
    };
  });
}

export function detectCompDuplicates(records: CompRecord[]): CompRecord[] {
  const phoneMap = new Map<string, CompRecord[]>();
  const emailMap = new Map<string, CompRecord[]>();

  records.forEach(record => {
    const phones = [...new Set((record.phone || '').split(',')
      .map(normalizePhone)
      .filter(phone => phone.length >= 8))];

    phones.forEach(phone => {
      const group = phoneMap.get(phone) || [];
      group.push(record);
      phoneMap.set(phone, group);
    });

    const email = normalizeEmail(record.email);
    if (email && email.includes('@')) {
      const group = emailMap.get(email) || [];
      group.push(record);
      emailMap.set(email, group);
    }
  });

  return records.map(record => {
    const related = new Map<string, CompRecord>();
    const phones = [...new Set((record.phone || '').split(',')
      .map(normalizePhone)
      .filter(phone => phone.length >= 8))];

    phones.forEach(phone => {
      phoneMap.get(phone)?.forEach(other => {
        if (other.id !== record.id) related.set(other.id, other);
      });
    });

    const email = normalizeEmail(record.email);
    if (email && email.includes('@')) {
      emailMap.get(email)?.forEach(other => {
        if (other.id !== record.id) related.set(other.id, other);
      });
    }

    const matches = [...related.values()];
    return {
      ...record,
      isDuplicate: matches.length > 0,
      notes: matches.length
        ? appendDuplicateNote(record.notes, matches.map(item => item.titular))
        : cleanDuplicateNote(record.notes),
    };
  });
}

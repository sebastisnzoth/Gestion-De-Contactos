import { Contact, Mappings } from '../types';

export function parseCSVText(text: string): string[][] {
  const firstLine = text.split('\n')[0];
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;

  let delimiter = ',';
  if (semicolons > commas && semicolons > tabs) delimiter = ';';
  if (tabs > commas && tabs > semicolons) delimiter = '\t';

  const lines: string[][] = [];
  let row: string[] = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      row.push('');
    } else if (c === '\r') {
      // Ignorar
    } else if (c === '\n' && !inQuotes) {
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') lines.push(row);
  return lines;
}

export function guessColumnByContent(fieldId: string, rows: string[][]): number {
  const sampleSize = Math.min(rows.length, 6);
  const colScores: { col: number; score: number }[] = [];
  const numCols = rows[0].length;

  for (let col = 0; col < numCols; col++) {
    let score = 0;
    for (let r = 1; r < sampleSize; r++) {
      const val = String(rows[r]?.[col] || '').trim();
      if (!val) continue;

      if (fieldId === 'mapPhone') {
        const clean = val.replace(/\D/g, '');
        if (clean.length >= 7 && clean.length <= 15) score += 10;
      } else if (fieldId === 'mapEmail') {
        if (val.includes('@') && val.includes('.')) score += 10;
      } else if (fieldId === 'mapPax') {
        const num = Number(val);
        if (!isNaN(num) && num > 0 && num < 20) score += 5;
      } else if (fieldId === 'mapDate') {
        if (val.match(/\d{1,4}[-/./]\d{1,2}[-/./]\d{1,4}/)) score += 10;
      } else if (fieldId === 'mapName') {
        if (val.length > 5 && !val.match(/\d/) && val.includes(' ')) score += 5;
      } else if (fieldId === 'mapHotel') {
        const lowercase = val.toLowerCase();
        if (lowercase.includes('hotel') || lowercase.includes('suites') || lowercase.includes('grand') || lowercase.includes('resort') || lowercase.includes('inn')) {
          score += 10;
        } else if (val.length > 5 && val.length < 50 && !val.includes('@') && isNaN(Number(val))) {
          score += 2;
        }
      }
    }
    colScores.push({ col, score });
  }

  colScores.sort((a, b) => b.score - a.score);
  if (colScores[0] && colScores[0].score > 0) {
    return colScores[0].col;
  }
  return -1;
}

export function computeInitialMappings(headers: string[], rows: string[][]): Mappings {
  const mappingConfigs: Record<keyof Mappings, string[]> = {
    mapName: ['name', 'titular', 'nombre', 'cliente', 'pasajero', 'passenger'],
    mapPhone: ['phone', 'telefono', 'teléfono', 'celular', 'móvil', 'tel', 'whatsapp'],
    mapEmail: ['email', 'e-mail', 'correo', 'mail'],
    mapHotel: ['hotel', 'destino', 'alojamiento', 'hospedaje'],
    mapPax: ['pax', 'pasajeros', 'cantidad', 'personas'],
    mapDate: ['fecha', 'date', 'llegada', 'check-in', 'checkin', 'conciliación', 'conciliacion'],
    mapActivities: ['actividad', 'activities', 'tour', 'excursion', 'excursión', 'servicio', 'modalidad']
  };

  const result: Partial<Mappings> = {};

  for (const [key, keywords] of Object.entries(mappingConfigs)) {
    const typedKey = key as keyof Mappings;
    let matchedIndex = -1;
    headers.forEach((h, index) => {
      const cleanH = String(h).toLowerCase().trim();
      if (matchedIndex === -1 && keywords.some(k => cleanH.includes(k))) {
        matchedIndex = index;
      }
    });

    if (matchedIndex === -1 && rows.length > 1) {
      matchedIndex = guessColumnByContent(key, rows);
    }

    result[typedKey] = matchedIndex !== -1 ? matchedIndex : "";
  }

  return result as Mappings;
}

export const COUNTRIES_DATA = [
  { code: 'CH', name: 'Chile', prefix: '56', length: 9 },
  { code: 'AR', name: 'Argentina', prefix: '54', length: 10 },
  { code: 'BR', name: 'Brasil', prefix: '55', length: 11 },
  { code: 'CO', name: 'Colombia', prefix: '57', length: 10 },
  { code: 'PE', name: 'Perú', prefix: '51', length: 9 },
  { code: 'MX', name: 'México', prefix: '52', length: 10 },
  { code: 'URU', name: 'Uruguay', prefix: '598', length: 8 },
  { code: 'PY', name: 'Paraguay', prefix: '595', length: 9 },
  { code: 'BOL', name: 'Bolivia', prefix: '591', length: 8 },
  { code: 'GUA', name: 'Guatemala', prefix: '502', length: 8 },
  { code: 'CR', name: 'Costa Rica', prefix: '506', length: 8 },
  { code: 'USA', name: 'USA/Canadá', prefix: '1', length: 10 },
  { code: 'ESP', name: 'España', prefix: '34', length: 9 },
];

export function getCountryCode(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  for (const c of COUNTRIES_DATA) {
    if (digits.startsWith(c.prefix)) return c.code;
  }
  return 'CH';
}

export function formatPhone(phone: string, defaultCountryCode?: string): string {
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // If it starts with +, we assume it's already got a prefix
  if (phone.trim().startsWith('+')) {
    return '+' + digits;
  }

  // Check if it already starts with a known prefix
  const alreadyHasPrefix = COUNTRIES_DATA.some(c => digits.startsWith(c.prefix) && digits.length > c.length);
  
  if (!alreadyHasPrefix && defaultCountryCode) {
    const country = COUNTRIES_DATA.find(c => c.code === defaultCountryCode);
    if (country) {
      return '+' + country.prefix + digits;
    }
  }

  return '+' + digits;
}

export function extractActivityAndDate(inputStr: string, defaultDt: string): { activity: string; date: string } {
  const trimmed = String(inputStr || '').trim();
  if (!trimmed) {
    return { activity: '', date: defaultDt };
  }

  const startsWithComp = trimmed.toLowerCase().startsWith('comp');

  // ALGORITMO DE SEPARACIÓN CRÍTICO
  const match = trimmed.match(/(.*?)(?:[a-zA-Z]+)?(\d{1,2}\/\d{1,2}\/\d{2,4})\s*$/);
  if (match) {
    let activity = match[1].trim();
    const cleanDate = match[2].trim();

    // Si empieza con 'comp', queremos mantener el formato del nombre de la actividad empezando con 'comp'
    if (startsWithComp) {
      const dateMatch = trimmed.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*$/);
      if (dateMatch) {
         const datePart = dateMatch[1];
         let rawActivity = trimmed.substring(0, trimmed.length - datePart.length).trim();
         // Límpialo de corchetes, paréntesis o signos residuales pero manteniendo 'comp' intacto
         rawActivity = rawActivity
           .replace(/^[-+*\s[({]+/, '')
           .replace(/[-+*\s\])}]+$/, '')
           .trim();
         return { activity: rawActivity, date: datePart };
      }
    }

    // Límpialo de corchetes, paréntesis o textos genéricos redundantes
    activity = activity
      .replace(/^[-+*\s[({]+/, '')
      .replace(/[-+*\s\])}]+$/, '')
      .trim();

    return { activity, date: cleanDate };
  }

  return { activity: trimmed, date: defaultDt };
}

export function generateContacts(rawRows: string[][], mappings: Mappings, defaultDate: string, defaultCountry: string): Contact[] {
  if (rawRows.length < 2) return [];

  const parsedContacts: Contact[] = [];
  const phoneCounts = new Map<string, number>();
  const usedIds = new Set<string>();

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length <= 1 && !row[0]) continue;

    let name = mappings.mapName !== "" ? row[mappings.mapName as number] : "";
    let phoneRaw = mappings.mapPhone !== "" ? row[mappings.mapPhone as number] : "";
    let email = mappings.mapEmail !== "" ? row[mappings.mapEmail as number] : "";
    let hotel = mappings.mapHotel !== "" ? row[mappings.mapHotel as number] : "";
    let pax = mappings.mapPax !== "" ? row[mappings.mapPax as number] : "1";
    let date = mappings.mapDate !== "" ? row[mappings.mapDate as number] : "";
    let activities = mappings.mapActivities !== "" ? row[mappings.mapActivities as number] : "";

    name = name !== undefined && name !== null ? String(name).trim() : "";
    phoneRaw = phoneRaw !== undefined && phoneRaw !== null ? String(phoneRaw).trim() : "";
    email = email !== undefined && email !== null ? String(email).trim() : "";
    hotel = hotel !== undefined && hotel !== null ? String(hotel).trim() : "";
    pax = pax !== undefined && pax !== null ? String(pax).trim().replace(/\D/g, '') || "1" : "1";
    let dateStr = date !== undefined && date !== null ? String(date).trim() : "";
    activities = activities !== undefined && activities !== null ? String(activities).trim() : "";

    // ALGORITMO DE SEPARACIÓN CRÍTICO
    if (activities) {
      const extracted = extractActivityAndDate(activities, dateStr || defaultDate);
      if (extracted.date !== (dateStr || defaultDate)) {
        activities = extracted.activity;
        dateStr = extracted.date;
      }
    }

    if (!dateStr && date) {
      dateStr = String(date).trim();
    }

    if (dateStr) {
      const extractedFromDate = extractActivityAndDate(dateStr, defaultDate);
      if (extractedFromDate.activity && extractedFromDate.date !== defaultDate) {
        if (!activities || activities === dateStr) {
          activities = extractedFromDate.activity;
        }
        dateStr = extractedFromDate.date;
      }
    }

    if (!dateStr) {
      dateStr = defaultDate;
    }

    if (dateStr) {
      const parts = dateStr.split(/[-/]/);
      if (parts.length === 3) {
        let y = parts[2];
        let m = parts[1];
        let d = parts[0];
        if (d.length === 4) { y = d; d = parts[2]; } // YYYY-MM-DD
        if (y.length === 4) { y = y.slice(2); }      // YYYY -> YY
        dateStr = `${d}/${m}/${y}`;
      }
    }

    let p1 = "";
    let p2 = "";
    if (phoneRaw.includes(',')) {
      const parts = phoneRaw.split(',');
      p1 = parts[0]?.trim() || "";
      p2 = parts[1]?.trim() || "";
    } else {
      p1 = phoneRaw;
    }

    if (!name || (!p1 && !p2)) continue;

    const cleanPhone1 = p1 ? formatPhone(p1, defaultCountry) : "";
    const cleanPhone2 = p2 ? formatPhone(p2, defaultCountry) : "";

    let finalName = "";

    if (name.includes(' en ') && (name.includes('CH') || name.includes('BR') || name.includes('AR') || name.includes('CO') || name.includes('PE'))) {
      finalName = name;
    } else {
      const country = getCountryCode(cleanPhone1 || cleanPhone2);
      finalName = `${dateStr} ${country}x${pax} ${name} - en ${hotel || 'Hotel'}`;
    }

    const cleanEmail = (email && email.toLowerCase() !== '(no especificado)' && email !== 'n/a') ? email : "";

    const cleanPhoneId = (cleanPhone1 || cleanPhone2 || "").replace(/\D/g, "");
    const cleanNameId = name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 30);
    const cleanDateId = dateStr.replace(/[^0-9]/g, "");
    
    const baseId = `c_${cleanDateId}_${cleanPhoneId || cleanNameId}`;
    let deterministicId = baseId;
    let suffix = 2;
    while (usedIds.has(deterministicId)) {
      deterministicId = `${baseId}_${suffix}`;
      suffix++;
    }
    usedIds.add(deterministicId);

    if (cleanPhone1) phoneCounts.set(cleanPhone1, (phoneCounts.get(cleanPhone1) || 0) + 1);
    if (cleanPhone2) phoneCounts.set(cleanPhone2, (phoneCounts.get(cleanPhone2) || 0) + 1);

    parsedContacts.push({
      id: deterministicId,
      fullName: finalName,
      phone1: cleanPhone1,
      phone2: cleanPhone2,
      email: cleanEmail,
      activities: activities,
      pax: pax,
      notes: "",
      waStatus1: 'unverified',
      waStatus2: 'unverified',
      isDuplicate: false, // will update later
    });
  }

  // Second pass to identify duplicates
  parsedContacts.forEach(contact => {
    const isDup = 
        (contact.phone1 && (phoneCounts.get(contact.phone1) || 0) > 1) ||
        (contact.phone2 && (phoneCounts.get(contact.phone2) || 0) > 1);
    contact.isDuplicate = isDup;
  });

  return parsedContacts;
}

export function parseDate(dateStr: string): Date | null {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const yStr = parts[2];
  const y = parseInt(yStr.length === 4 ? yStr : "20" + yStr, 10);
  return new Date(y, m, d);
}

export function addDay(yyyymmdd: string): string {
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  
  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10).replace(/-/g, '');
  }
  
  const date = new Date(y, m, d);
  if (isNaN(date.getTime())) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10).replace(/-/g, '');
  }

  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

export function validateEventDates(contacts: Contact[]): void {
  for (const c of contacts) {
    const rawDate = c.fullName.split(' ')[0];
    const parts = rawDate.split('/');
    if (
      parts.length !== 3 ||
      isNaN(parseInt(parts[0], 10)) ||
      isNaN(parseInt(parts[1], 10)) ||
      isNaN(parseInt(parts[2], 10))
    ) {
      window.alert("¡Atención! Hay contactos con datos de fecha incompletos o inválidos. Revisa el archivo original.");
      return;
    }
  }
}

export function generateICSString(contacts: Contact[]): string {
  let icsContent = "BEGIN:VCALENDAR\r\nPRODID:-//Google Inc//Google Calendar 70.9054//EN\r\nVERSION:2.0\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
  const processedIds = new Set<string>();

  contacts.forEach((c) => {
    if (processedIds.has(c.id)) return;
    
    const sharedGroup = getSharedGroup(c, contacts);
    sharedGroup.forEach(item => processedIds.add(item.id));
    
    const sharedHistoryString = sharedGroup.map(item => `• [${item.fullName.split(' ')[0]}] Contacto: ${item.fullName} - Pasajero: ${item.pax || '1'} -> Actividad: ${item.activities}`).join('\\n');
    
    sharedGroup.forEach(item => {
      const rowActivities = item.activities.split(',').map(a => a.trim()).filter(a => a);
      if (rowActivities.length === 0) rowActivities.push('Actividad');

      rowActivities.forEach((act, actIndex) => {
        const dateStr = item.fullName.split(' ')[0];
        const dateParts = dateStr.split('/');
        let dtStart = "";
        if (dateParts.length === 3) {
            const yStr = dateParts[2];
            const y = yStr.length === 4 ? yStr : "20" + yStr;
            const m = dateParts[1].padStart(2, '0');
            const d = dateParts[0].padStart(2, '0');
            dtStart = `${y}${m}${d}`;
        } else {
            dtStart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        }

        const dtEnd = addDay(dtStart);
        const uid = `${dtStart}-${item.id}-${actIndex}@gestioncontactos.com`;
        const dtStamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, 15) + 'Z';
        
        const escapedSummary = escapeVCardValue(`${act} - ${item.fullName}`);
        const phone = item.phone1 || item.phone2 || '';
        const phoneClean = phone.replace(/\D/g, '');
        const countryStr = getCountryCode(phone);
        
        // Description formatting - MUST BE ONE PHYSICAL LINE in the file
        const desc = `=== DATOS DEL PASAJERO ===\\n• Nombre Completo: ${item.fullName}\\n• Teléfono: ${phone}\\n• WhatsApp Directo: https://wa.me/${phoneClean}\\n• Email: ${item.email}\\n• Pasajeros: ${item.pax}\\n• País: ${countryStr}\\n• Conciliación: ${dateStr}\\n==========================\\n\\n=== HISTORIAL COMPARTIDO DEL TELÉFONO ===\\n${sharedHistoryString}\\n=========================================`;

        icsContent += "BEGIN:VEVENT\r\n";
        icsContent += `UID:${uid}\r\n`;
        icsContent += `DTSTAMP:${dtStamp}\r\n`;
        icsContent += `DTSTART;VALUE=DATE:${dtStart}\r\n`;
        icsContent += `DTEND;VALUE=DATE:${dtEnd}\r\n`;
        icsContent += `SUMMARY:${escapedSummary}\r\n`;
        icsContent += `TRANSP:TRANSPARENT\r\n`;
        icsContent += `DESCRIPTION:${desc}\r\n`;
        icsContent += "END:VEVENT\r\n";
      });
    });
  });

  icsContent += "END:VCALENDAR";
  return icsContent;
}

export function generateICSBlob(contacts: Contact[]): Blob {
  validateEventDates(contacts);
  const icsContent = generateICSString(contacts);
  return new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
}

export function getSharedGroup(contact: Contact, allContacts: Contact[]): Contact[] {
  return allContacts.filter(c => 
    (c.phone1 && (c.phone1 === contact.phone1 || c.phone1 === contact.phone2)) ||
    (c.phone2 && (c.phone2 === contact.phone1 || c.phone2 === contact.phone2))
  );
}

export function escapeVCardValue(val: string): string {
  if (!val) return "";
  return String(val)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function generateCompVCFBlob(records: import('../types').CompRecord[]): Blob {
  let vcfContent = "";

  records.forEach(c => {
    const fnName = c.titular.split(' ').slice(0, 3).join(' ') || 'Contacto COMP';
    const escapedName = escapeVCardValue(c.titular || 'Sin Titular');
    const escapedEmail = escapeVCardValue(c.email);

    vcfContent += "BEGIN:VCARD\r\n";
    vcfContent += "VERSION:3.0\r\n";
    vcfContent += `FN;CHARSET=UTF-8:${escapedName}\r\n`;
    vcfContent += `N;CHARSET=UTF-8:;${escapedName};;;\r\n`;
    
    if (c.phone) {
      const phones = c.phone.split(',').map(p => p.trim()).filter(p => p.length > 0);
      phones.forEach((phone, pIdx) => {
        vcfContent += `TEL;TYPE=CELL,VOICE;X-LABEL=WhatsApp ${pIdx + 1}:${phone}\r\n`;
      });
    }
    
    if (c.email) vcfContent += `EMAIL;TYPE=INTERNET:${escapedEmail}\r\n`;
    
    if (c.notes) {
      const encodedNote = c.notes.replace(/\n/g, '\\n').replace(/\r/g, '');
      vcfContent += `NOTE;CHARSET=UTF-8:${escapeVCardValue(encodedNote)}\r\n`;
    }
    
    vcfContent += "END:VCARD\r\n";
  });

  return new Blob([vcfContent], { type: 'text/vcard;charset=utf-8;' });
}

export function generateVCFBlobs(sharedGroup: Contact[]): Blob {
  let vcfContent = "";

  const note = `=== HISTORIAL COMPARTIDO DEL TELÉFONO ===\n` +
         sharedGroup.map(c => `• [${new Date().toLocaleDateString('es-ES')}] Contacto: ${c.fullName} - Pasajero: ${c.activities.split(',')[0] || '1'} -> Actividad: ${c.activities || 'Sin actividad'}`).join('\n') +
         `\n=========================================`;

  sharedGroup.forEach(c => {
    const escapedName = escapeVCardValue(c.fullName);
    const escapedEmail = escapeVCardValue(c.email);

    vcfContent += "BEGIN:VCARD\r\n";
    vcfContent += "VERSION:3.0\r\n";
    vcfContent += `FN;CHARSET=UTF-8:${escapedName}\r\n`;
    vcfContent += `N;CHARSET=UTF-8:;${escapedName};;;\r\n`;
    if (c.phone1) vcfContent += `TEL;TYPE=CELL,VOICE;X-LABEL=WhatsApp 1:${c.phone1}\r\n`;
    if (c.phone2) vcfContent += `TEL;TYPE=CELL,VOICE;X-LABEL=WhatsApp 2:${c.phone2}\r\n`;
    if (c.email) vcfContent += `EMAIL;TYPE=INTERNET:${escapedEmail}\r\n`;
    
    // Using multiline encoding according to vCard 3.0 spec (space at start of line)
    const encodedNote = note.replace(/\n/g, '\\n');
    vcfContent += `NOTE;CHARSET=UTF-8:${encodedNote}\r\n`;
    
    vcfContent += "END:VCARD\r\n";
  });

  return new Blob([vcfContent], { type: 'text/vcard;charset=utf-8;' });
}

export function downloadVCF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function checkWassenger(phone: string, token: string): Promise<boolean | null> {
  try {
    const response = await fetch('https://api.wassenger.com/v1/numbers/exists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': token
      },
      body: JSON.stringify({ phone: phone })
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.exists;
  } catch (e) {
    return null;
  }
}

export async function checkWASender(phone: string, token: string): Promise<boolean | null> {
  try {
    const cleanPhone = phone.replace('+', '');
    const response = await fetch(`https://www.wasenderapi.com/api/on-whatsapp/${cleanPhone}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.data ? data.data.exists : null;
  } catch (e) {
    return null;
  }
}

export interface E164ValidationResult {
  isValid: boolean;
  code: 'VALID' | 'EMPTY' | 'MISSING_PLUS' | 'HAS_SPACES' | 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARACTERS';
  message: string;
  suggestedE164: string;
}

export function isValidE164(phone: string): boolean {
  if (!phone || !phone.trim()) return false;
  return /^\+[1-9]\d{6,14}$/.test(phone.trim());
}

export function validateE164(phone: string, defaultCountryCode?: string): E164ValidationResult {
  if (!phone || !phone.trim()) {
    return {
      isValid: false,
      code: 'EMPTY',
      message: 'Sin teléfono asignado',
      suggestedE164: ''
    };
  }

  const trimmed = phone.trim();
  const suggested = formatPhone(trimmed, defaultCountryCode);

  if (/^\+[1-9]\d{6,14}$/.test(trimmed)) {
    return {
      isValid: true,
      code: 'VALID',
      message: 'Formato E.164 internacional correcto',
      suggestedE164: trimmed
    };
  }

  if (!trimmed.startsWith('+')) {
    return {
      isValid: false,
      code: 'MISSING_PLUS',
      message: 'Falta el prefijo internacional (+)',
      suggestedE164: suggested
    };
  }

  if (/[\s\-\(\)\.]/.test(trimmed)) {
    return {
      isValid: false,
      code: 'HAS_SPACES',
      message: 'Contiene espacios, guiones o símbolos',
      suggestedE164: suggested
    };
  }

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length < 7) {
    return {
      isValid: false,
      code: 'TOO_SHORT',
      message: 'Número muy corto (mínimo 7 dígitos)',
      suggestedE164: suggested
    };
  }

  if (digitsOnly.length > 15) {
    return {
      isValid: false,
      code: 'TOO_LONG',
      message: 'Número demasiado largo (máximo 15 dígitos)',
      suggestedE164: suggested
    };
  }

  return {
    isValid: false,
    code: 'INVALID_CHARACTERS',
    message: 'No cumple con el estándar E.164 (+1 a +15 dígitos)',
    suggestedE164: suggested
  };
}

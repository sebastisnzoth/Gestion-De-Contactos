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
    mapDate: ['fecha', 'date', 'llegada', 'check-in', 'checkin'],
    mapActivities: ['actividad', 'activities', 'tour', 'excursion', 'excursión', 'servicio']
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

export function getCountryCode(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('56')) return 'CH';
  if (digits.startsWith('55')) return 'BR';
  if (digits.startsWith('54')) return 'AR';
  if (digits.startsWith('57')) return 'CO';
  if (digits.startsWith('51')) return 'PE';
  if (digits.startsWith('52')) return 'MX';
  if (digits.startsWith('502')) return 'GUA';
  if (digits.startsWith('506')) return 'CR';
  if (digits.startsWith('595')) return 'PY';
  if (digits.startsWith('598')) return 'URU';
  if (digits.startsWith('591')) return 'BOL';
  return 'CH';
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits.startsWith('+') && digits.length > 0) {
    return '+' + digits;
  }
  return digits;
}

export function generateContacts(rawRows: string[][], mappings: Mappings, defaultDate: string): Contact[] {
  if (rawRows.length < 2) return [];

  const parsedContacts: Contact[] = [];
  const phoneCounts = new Map<string, number>();

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length <= 1 && !row[0]) continue;

    let name = mappings.mapName !== "" ? row[mappings.mapName as number] : "";
    let phoneRaw = mappings.mapPhone !== "" ? row[mappings.mapPhone as number] : "";
    let email = mappings.mapEmail !== "" ? row[mappings.mapEmail as number] : "";
    let hotel = mappings.mapHotel !== "" ? row[mappings.mapHotel as number] : "";
    let pax = mappings.mapPax !== "" ? row[mappings.mapPax as number] : "1";
    let date = mappings.mapDate !== "" ? row[mappings.mapDate as number] : defaultDate;
    let activities = mappings.mapActivities !== "" ? row[mappings.mapActivities as number] : "";

    name = name !== undefined && name !== null ? String(name).trim() : "";
    phoneRaw = phoneRaw !== undefined && phoneRaw !== null ? String(phoneRaw).trim() : "";
    email = email !== undefined && email !== null ? String(email).trim() : "";
    hotel = hotel !== undefined && hotel !== null ? String(hotel).trim() : "";
    pax = pax !== undefined && pax !== null ? String(pax).trim().replace(/\D/g, '') || "1" : "1";
    let dateStr = date !== undefined && date !== null ? String(date).trim() : defaultDate;
    activities = activities !== undefined && activities !== null ? String(activities).trim() : "";

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

    let finalName = "";

    if (name.includes(' en ') && (name.includes('CH') || name.includes('BR') || name.includes('AR') || name.includes('CO') || name.includes('PE'))) {
      finalName = name;
    } else {
      const country = getCountryCode(p1 || p2);
      finalName = `${dateStr} ${country}x${pax} ${name} - en ${hotel || 'Hotel'}`;
    }

    const cleanPhone1 = p1 ? formatPhone(p1) : "";
    const cleanPhone2 = p2 ? formatPhone(p2) : "";
    const cleanEmail = (email && email.toLowerCase() !== '(no especificado)' && email !== 'n/a') ? email : "";

    if (cleanPhone1) phoneCounts.set(cleanPhone1, (phoneCounts.get(cleanPhone1) || 0) + 1);
    if (cleanPhone2) phoneCounts.set(cleanPhone2, (phoneCounts.get(cleanPhone2) || 0) + 1);

    parsedContacts.push({
      id: crypto.randomUUID(),
      fullName: finalName,
      phone1: cleanPhone1,
      phone2: cleanPhone2,
      email: cleanEmail,
      activities: activities,
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

export function escapeVCardValue(val: string): string {
  if (!val) return "";
  return String(val)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function generateVCFBlob(contacts: Contact[]): Blob {
  let vcfContent = "";
  contacts.forEach(c => {
    const escapedName = escapeVCardValue(c.fullName);
    const escapedEmail = escapeVCardValue(c.email);

    vcfContent += "BEGIN:VCARD\r\n";
    vcfContent += "VERSION:3.0\r\n";
    vcfContent += `FN;CHARSET=UTF-8:${escapedName}\r\n`;
    vcfContent += `N;CHARSET=UTF-8:;${escapedName};;;\r\n`;
    if (c.phone1) {
      vcfContent += `TEL;TYPE=CELL:${c.phone1}\r\n`;
    }
    if (c.phone2) {
      vcfContent += `TEL;TYPE=CELL:${c.phone2}\r\n`;
    }
    if (c.email) {
      vcfContent += `EMAIL;TYPE=INTERNET:${escapedEmail}\r\n`;
    }
    if (c.activities) {
      vcfContent += `NOTE:Actividades: ${escapeVCardValue(c.activities)}\r\n`;
    }
    vcfContent += "END:VCARD\r\n";
  });

  // Generar Blob sin BOM para compatibilidad iOS
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

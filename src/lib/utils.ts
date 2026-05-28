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
    mapDate: ['fecha', 'date', 'llegada', 'check-in', 'checkin']
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

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length <= 1 && !row[0]) continue;

    let name = mappings.mapName !== "" ? row[mappings.mapName as number] : "";
    let phone = mappings.mapPhone !== "" ? row[mappings.mapPhone as number] : "";
    let email = mappings.mapEmail !== "" ? row[mappings.mapEmail as number] : "";
    let hotel = mappings.mapHotel !== "" ? row[mappings.mapHotel as number] : "";
    let pax = mappings.mapPax !== "" ? row[mappings.mapPax as number] : "1";
    let date = mappings.mapDate !== "" ? row[mappings.mapDate as number] : defaultDate;

    name = name !== undefined && name !== null ? String(name).trim() : "";
    phone = phone !== undefined && phone !== null ? String(phone).trim() : "";
    email = email !== undefined && email !== null ? String(email).trim() : "";
    hotel = hotel !== undefined && hotel !== null ? String(hotel).trim() : "";
    pax = pax !== undefined && pax !== null ? String(pax).trim().replace(/\D/g, '') || "1" : "1";
    date = date !== undefined && date !== null ? String(date).trim() : defaultDate;

    if (!name || !phone) continue;

    let finalName = "";

    if (name.includes('pax en') && (name.includes('CH') || name.includes('BR') || name.includes('AR') || name.includes('CO') || name.includes('PE'))) {
      finalName = name;
    } else {
      const country = getCountryCode(phone);
      finalName = `${date} ${country}${pax} ${name} - ${pax} pax en ${hotel || 'Hotel'}`;
    }

    const cleanPhone = formatPhone(phone);
    const cleanEmail = (email && email.toLowerCase() !== '(no especificado)' && email !== 'n/a') ? email : "";

    parsedContacts.push({
      id: crypto.randomUUID(),
      fullName: finalName,
      phone: cleanPhone,
      email: cleanEmail,
      waStatus: 'unverified'
    });
  }

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
    vcfContent += `TEL;TYPE=CELL:${c.phone}\r\n`;
    if (c.email) {
      vcfContent += `EMAIL;TYPE=INTERNET:${escapedEmail}\r\n`;
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

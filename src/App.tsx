/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Download, AlertCircle, FileSpreadsheet, CheckCircle2, XCircle, MessageCircle, Eye, FileText, Calendar, GitMerge, Users, Settings, LayoutDashboard, Share2, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  parseCSVText,
  computeInitialMappings,
  generateContacts,
  generateVCFBlobs,
  generateCompVCFBlob,
  getSharedGroup,
  generateICSBlob,
  generateICSString,
  downloadVCF,
  escapeVCardValue,
  parseDate,
  delay,
  checkWassenger,
  checkWASender,
  formatPhone
} from './lib/utils';
import { Contact, WaMethod, GlobalConfig, Mappings, CompRecord, SpreadsheetType } from './types';

export default function App() {
  const [spreadsheetType, setSpreadsheetType] = useState<SpreadsheetType>('trf');
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [filename, setFilename] = useState<string>('');
  
  const [mappings, setMappings] = useState<Mappings>({
    mapName: "", mapPhone: "", mapEmail: "", mapHotel: "", mapPax: "", mapDate: "", mapActivities: ""
  });
  
  const [config, setConfig] = useState<GlobalConfig>({
    defaultDate: '29/05/26',
    waMethod: 'manual',
    waToken: ''
  });
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [compRecords, setCompRecords] = useState<CompRecord[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (rawRows.length > 1) {
      const newContacts = generateContacts(rawRows, mappings, config.defaultDate);
      setContacts(newContacts);
    } else {
      setContacts([]);
    }
  }, [rawRows, mappings, config.defaultDate]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
      alert('Selecciona un archivo .csv, .xlsx o .xls válido.');
      return;
    }
    
    setFilename(file.name);
    const reader = new FileReader();
    
    if (extension === 'csv') {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const rows = parseCSVText(text);
        processLoadedRows(rows);
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        const stringRows = rows.map(r => r.map(c => String(c)));
        processLoadedRows(stringRows);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const detectDuplicates = (list: Contact[]) => {
    const phoneMap = new Map<string, Contact[]>();
    
    list.forEach(c => {
      const p1 = c.phone1.replace(/\D/g, '');
      const p2 = c.phone2.replace(/\D/g, '');
      const cleanPhones = [p1, p2].filter(p => p.length >= 8);
      
      cleanPhones.forEach(cp => {
        const group = phoneMap.get(cp) || [];
        group.push(c);
        phoneMap.set(cp, group);
      });
    });

    return list.map(c => {
      const p1 = c.phone1.replace(/\D/g, '');
      const p2 = c.phone2.replace(/\D/g, '');
      const cleanPhones = [p1, p2].filter(p => p.length >= 8);
      
      const related = new Set<Contact>();
      cleanPhones.forEach(cp => {
        const group = phoneMap.get(cp);
        if (group) {
          group.forEach(other => {
            if (other.id !== c.id) related.add(other);
          });
        }
      });

      if (related.size > 0) {
        const otherNames = Array.from(related).map(r => r.fullName).join(', ');
        const duplicateNote = `[DUPLICADO con: ${otherNames}]`;
        let updatedNotes = c.notes.replace(/\[DUPLICADO con:.*?\]/g, '').trim();
        if (updatedNotes.endsWith('|')) updatedNotes = updatedNotes.slice(0, -1).trim();
        updatedNotes = updatedNotes ? `${updatedNotes} | ${duplicateNote}` : duplicateNote;

        return { ...c, isDuplicate: true, notes: updatedNotes };
      }
      
      let cleanNotes = c.notes.replace(/\[DUPLICADO con:.*?\]/g, '').trim();
      if (cleanNotes.endsWith('|')) cleanNotes = cleanNotes.slice(0, -1).trim();
      return { ...c, isDuplicate: false, notes: cleanNotes };
    });
  };

  const detectCompDuplicates = (records: CompRecord[]) => {
    const phoneMap = new Map<string, CompRecord[]>();
    
    // Group records by every clean phone number they contain
    records.forEach(r => {
      const phones = r.phone?.split(',') || [];
      const cleanPhones = [...new Set(phones.map(p => p.replace(/\D/g, '')).filter(p => p.length >= 8))];
      
      cleanPhones.forEach(cp => {
        const group = phoneMap.get(cp) || [];
        group.push(r);
        phoneMap.set(cp, group);
      });
    });

    return records.map(r => {
      const phones = r.phone?.split(',') || [];
      const cleanPhones = [...new Set(phones.map(p => p.replace(/\D/g, '')).filter(p => p.length >= 8))];
      
      const relatedRecords = new Set<CompRecord>();
      cleanPhones.forEach(cp => {
        const group = phoneMap.get(cp);
        if (group) {
          group.forEach(other => {
            if (other.id !== r.id) relatedRecords.add(other);
          });
        }
      });

      if (relatedRecords.size > 0) {
        const others = Array.from(relatedRecords);
        const otherNames = others.map(o => o.titular).join(', ');
        
        const duplicateNote = `[DUPLICADO con: ${otherNames}]`;
        let updatedNotes = r.notes.replace(/\[DUPLICADO con:.*?\]/g, '').trim();
        if (updatedNotes.endsWith('|')) updatedNotes = updatedNotes.slice(0, -1).trim();
        
        updatedNotes = updatedNotes ? `${updatedNotes} | ${duplicateNote}` : duplicateNote;

        return { ...r, isDuplicate: true, notes: updatedNotes };
      }
      
      let cleanNotes = r.notes.replace(/\[DUPLICADO con:.*?\]/g, '').trim();
      if (cleanNotes.endsWith('|')) cleanNotes = cleanNotes.slice(0, -1).trim();
      
      return { ...r, isDuplicate: false, notes: cleanNotes };
    });
  };

  const processLoadedRows = (rows: string[][]) => {
    let filteredRows = rows.filter(r => r.length > 0 && r.some(cell => cell && String(cell).trim() !== ''));
    if (filteredRows.length === 0) {
      alert('El archivo cargado no contiene datos válidos.');
      return;
    }

    if (spreadsheetType === 'comp') {
        const headerRow = filteredRows[0].map(h => String(h).toLowerCase().trim());
        
        const colDate = headerRow.findIndex(h => h.includes('fecha de compra'));
        const colCountry = headerRow.findIndex(h => h.includes('país de compra') || h.includes('pais de compra'));
        const colName = headerRow.findIndex(h => h.includes('titular de la reserva'));
        const colPax = headerRow.findIndex(h => h.includes('cantidad adulto') || h.includes('pax'));
        const colPhone = headerRow.findIndex(h => h.includes('teléfono') || h.includes('telefono'));
        const colDest = headerRow.findIndex(h => h.includes('punto de interés destino') || h.includes('interes destino'));
        const colHotel = headerRow.findIndex(h => (h.includes('hotel') || h.includes('punto de interés')) && !h.includes('destino'));
        const colEmail = headerRow.findIndex(h => h.includes('e-mail') || h.includes('email'));
        const colTime = headerRow.findIndex(h => h.includes('hora pickup') || h.includes('hora'));

        const newRecords: CompRecord[] = filteredRows.slice(1).map((row, idx) => {
            const getVal = (colIdx: number) => colIdx >= 0 ? String(row[colIdx] || '').trim() : '';
            const titularParts = [];
            if (getVal(colDate)) titularParts.push(getVal(colDate));
            if (getVal(colCountry)) titularParts.push(getVal(colCountry).substring(0, 2).toLowerCase()); 
            if (getVal(colPax)) titularParts.push(`x${getVal(colPax)}`);
            if (getVal(colName)) titularParts.push(getVal(colName));
            if (getVal(colHotel) || getVal(colDest)) titularParts.push(getVal(colHotel) || getVal(colDest));
            
            const finalTitular = titularParts.length > 0 ? titularParts.join(' ') : String(row[0] || '').trim();
            const notesArr = [];
            if (getVal(colTime)) notesArr.push(`Hora: ${getVal(colTime)}`);
            
            // Include ALL columns in notes as requested
            row.forEach((cell, cIdx) => {
                if (cell && String(cell).trim() !== '') {
                   const headerName = filteredRows[0][cIdx] || `Col ${cIdx+1}`;
                   notesArr.push(`${headerName}: ${cell}`);
                }
            });

            return {
                id: `comp-${Date.now()}-${idx}`,
                titular: finalTitular,
                email: getVal(colEmail),
                phone: getVal(colPhone),
                notes: notesArr.join(' | ')
            };
        });
        
        setCompRecords(detectCompDuplicates(newRecords));
        setActiveTab('comp');
        return;
    }

    let headerIndex = 0;
    while(headerIndex < filteredRows.length) {
      const row = filteredRows[headerIndex];
      const populatedCount = row.filter(cell => cell && String(cell).trim() !== '').length;
      if (populatedCount >= 2) break;
      headerIndex++;
    }

    const finalRows = headerIndex < filteredRows.length ? filteredRows.slice(headerIndex) : filteredRows;
    setRawRows(finalRows);
    
    const fileHeaders = finalRows[0] || [];
    setHeaders(fileHeaders);
    
    const newMappings = computeInitialMappings(fileHeaders, finalRows);
    setMappings(newMappings);
  };

  const handleVerifyWA = async () => {
    if ((config.waMethod === 'wassenger' || config.waMethod === 'wasender') && !config.waToken) {
      alert('Introduce el token correspondiente para realizar las solicitudes.');
      return;
    }

    setIsVerifying(true);
    const updatedContacts = [...contacts];

    const verifyPhone = async (phone: string) => {
      let exists: boolean | null = null;
      if (config.waMethod === 'simulation') {
        await delay(400);
        const clean = phone.replace(/\D/g, '');
        exists = (clean.length >= 11 && clean.length <= 13);
      } else if (config.waMethod === 'wassenger') {
        exists = await checkWassenger(phone, config.waToken);
        await delay(100);
      } else if (config.waMethod === 'wasender') {
        exists = await checkWASender(phone, config.waToken);
        await delay(100);
      }
      if (exists === true) return 'active';
      if (exists === false) return 'inactive';
      return 'error';
    };

    for (let i = 0; i < updatedContacts.length; i++) {
        const contact = updatedContacts[i];
        updatedContacts[i] = { 
          ...contact, 
          waStatus1: contact.phone1 ? 'checking' : 'unverified',
          waStatus2: contact.phone2 ? 'checking' : 'unverified'
        };
        setContacts([...updatedContacts]);

        if (contact.phone1) updatedContacts[i].waStatus1 = await verifyPhone(contact.phone1) as any;
        if (contact.phone2) updatedContacts[i].waStatus2 = await verifyPhone(contact.phone2) as any;

        setContacts([...updatedContacts]);
    }
    
    setIsVerifying(false);
  };

  const handleDownloadAll = () => {
    // Collect all contacts, build vCards for each, ensuring shared notes
    let vcfContent = "";
    contacts.forEach(c => {
        const sharedGroup = getSharedGroup(c, contacts);
        // We only care about the shared note part, we can repurpose generateVCFBlobs part
        // Actually, let's just make a helper that returns just the vCard string for a group
    });
    // This is too complex for now, just iterate and construct it.
    
    // Simplest fix: Just use a set of processed contact IDs
    const processedIds = new Set<string>();
    let allVcfContent = "";

    contacts.forEach(c => {
       const sharedGroup = getSharedGroup(c, contacts);

       const note = `=== HISTORIAL COMPARTIDO DEL TELÉFONO ===\n` +
         sharedGroup.map(item => `• [${new Date().toLocaleDateString('es-ES')}] Contacto: ${item.fullName} - Pasajero: ${item.activities.split(',')[0] || '1'} -> Actividad: ${item.activities || 'Sin actividad'}`).join('\n') +
         `\n=========================================`;

       sharedGroup.forEach(item => {
         if (processedIds.has(item.id)) return;
         processedIds.add(item.id);

         const escapedName = escapeVCardValue(item.fullName);
         const escapedEmail = escapeVCardValue(item.email);

         allVcfContent += "BEGIN:VCARD\r\n";
         allVcfContent += "VERSION:3.0\r\n";
         allVcfContent += `FN;CHARSET=UTF-8:${escapedName}\r\n`;
         allVcfContent += `N;CHARSET=UTF-8:;${escapedName};;;\r\n`;
         if (item.phone1) allVcfContent += `TEL;TYPE=CELL:${item.phone1}\r\n`;
         if (item.phone2) allVcfContent += `TEL;TYPE=CELL:${item.phone2}\r\n`;
         if (item.email) allVcfContent += `EMAIL;TYPE=INTERNET:${escapedEmail}\r\n`;
         
         const encodedNote = note.replace(/\n/g, '\\n');
         allVcfContent += `NOTE;CHARSET=UTF-8:${encodedNote}\r\n`;
         
         allVcfContent += "END:VCARD\r\n";
       });
    });

    const blob = new Blob([allVcfContent], { type: 'text/vcard;charset=utf-8;' });
    downloadVCF(blob, 'contactos_viajes_pro.vcf');
  };

  const updateContact = (index: number, field: keyof Contact, value: string) => {
    const newContacts = [...contacts];
    if (field === 'phone1' || field === 'phone2') {
      newContacts[index] = { ...newContacts[index], [field]: formatPhone(value) };
    } else {
      newContacts[index] = { ...newContacts[index], [field]: value };
    }
    setContacts(newContacts);
  };

  const getWABadge = (status: Contact['waStatus1'], phone: string, fullName: string) => {
    if (config.waMethod === 'manual') {
      const cleanPhone = phone.replace('+', '');
      const text = encodeURIComponent(`Hola ${fullName}`);
      return (
        <a href={`https://wa.me/${cleanPhone}?text=${text}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium">
          <MessageCircle className="w-4 h-4 text-green-500" />
          Chat
        </a>
      );
    }

    switch(status) {
      case 'checking': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800 animate-pulse w-full justify-center">⏳ Check</span>;
      case 'active': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 w-full justify-center">🟢 Activo</span>;
      case 'inactive': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 w-full justify-center">🔴 Inact.</span>;
      case 'error': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800 w-full justify-center">⚠️ Err</span>;
      default: return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-400 w-full justify-center">🔘 -</span>;
    }
  };

  const Calendar72h = ({ contacts }: { contacts: Contact[] }) => {
    const now = new Date();
    const seventyTwoHoursLater = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    const activities = contacts.flatMap(c => {
      const activityParts = c.activities.split(',').map(a => a.trim()).filter(a => a);
      const date = parseDate(c.fullName.split(' ')[0]);
      if (!date) return [];
      
      return activityParts.map(act => ({
        ...c,
        activity: act,
        date
      }));
    }).filter(item => item.date >= now && item.date <= seventyTwoHoursLater);

    if (activities.length === 0) return null;

    return <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-200 mt-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Próximos 3 días (72h)</h2>
      <div className="space-y-4">
        {activities.map((a, i) => (
          <div key={i} className="flex gap-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
             <div className="text-xs font-bold text-blue-700 min-w-[70px]">{a.date.toLocaleDateString()}</div>
             <div className="text-sm text-gray-800 flex-1">{a.activity}</div>
             <div className="text-sm font-semibold text-gray-900 truncate max-w-[150px]">{a.fullName.split(' ').slice(2).join(' ')}</div>
          </div>
        ))}
      </div>
    </div>;
  };

  const [activeTab, setActiveTab] = useState<'contacts' | 'report' | 'comp'>('contacts');
  const [reportSearch, setReportSearch] = useState('');

  const mergeRecords = (sourceId: string) => {
    const recordToMerge = compRecords.find(r => r.id === sourceId);
    if (!recordToMerge) return;

    // Find all records that share phones with this one
    const phones = recordToMerge.phone?.split(',').map(p => p.trim()).filter(p => p.length > 0) || [];
    const cleanPhones = phones.map(p => p.replace(/\D/g, '')).filter(p => p.length >= 8);

    const related = compRecords.filter(r => {
      if (r.id === sourceId) return false;
      const otherPhones = r.phone?.split(',').map(p => p.trim()).filter(p => p.length > 0) || [];
      const otherClean = otherPhones.map(p => p.replace(/\D/g, '')).filter(p => p.length >= 8);
      return cleanPhones.some(cp => otherClean.includes(cp));
    });

    if (related.length === 0) return;

    // We'll merge into the first related record found
    const target = related[0];
    const targetIndex = compRecords.findIndex(r => r.id === target.id);
    
    const newRecords = [...compRecords];
    const updatedTarget = { ...newRecords[targetIndex] };

    // Merge phones
    const allPhones = [...(updatedTarget.phone?.split(',') || []), ...(recordToMerge.phone?.split(',') || [])]
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    // Unique check based on clean number
    const uniquePhones: string[] = [];
    const seenClean = new Set<string>();
    allPhones.forEach(p => {
      const clean = p.replace(/\D/g, '');
      if (!seenClean.has(clean)) {
        seenClean.add(clean);
        uniquePhones.push(p);
      }
    });
    updatedTarget.phone = uniquePhones.join(', ');

    // Merge notes
    const cleanTargetNotes = updatedTarget.notes.replace(/\[DUPLICADO con:.*?\]/g, '').trim();
    const cleanSourceNotes = recordToMerge.notes.replace(/\[DUPLICADO con:.*?\]/g, '').trim();
    
    const fusionInfo = `[FUSIÓN: Datos de ${recordToMerge.titular} combinados el ${new Date().toLocaleDateString()}]`;
    
    let finalNotes = cleanTargetNotes;
    if (cleanSourceNotes && cleanSourceNotes !== cleanTargetNotes) {
      finalNotes = finalNotes ? `${finalNotes} | ${cleanSourceNotes}` : cleanSourceNotes;
    }
    updatedTarget.notes = finalNotes ? `${finalNotes} | ${fusionInfo}` : fusionInfo;

    newRecords[targetIndex] = updatedTarget;
    // Remove the source record
    const finalRecords = newRecords.filter(r => r.id !== sourceId);
    
    setCompRecords(detectCompDuplicates(finalRecords));
  };

  const mergeMainContacts = (sourceId: string) => {
    const contactToMerge = contacts.find(c => c.id === sourceId);
    if (!contactToMerge) return;

    // Find all contacts that share phones with this one
    const p1 = contactToMerge.phone1.replace(/\D/g, '');
    const p2 = contactToMerge.phone2.replace(/\D/g, '');
    const cleanPhones = [p1, p2].filter(p => p.length >= 8);

    const related = contacts.filter(c => {
      if (c.id === sourceId) return false;
      const cp1 = c.phone1.replace(/\D/g, '');
      const cp2 = c.phone2.replace(/\D/g, '');
      return cleanPhones.some(p => p === cp1 || p === cp2);
    });

    if (related.length === 0) return;

    // Merge into the first related contact
    const target = related[0];
    const targetIndex = contacts.findIndex(c => c.id === target.id);
    
    const newContacts = [...contacts];
    const updatedTarget = { ...newContacts[targetIndex] };

    // Merge activities
    const actParts = [...updatedTarget.activities.split(','), ...contactToMerge.activities.split(',')]
      .map(a => a.trim())
      .filter(a => a);
    updatedTarget.activities = [...new Set(actParts)].join(', ');

    // Merge phones
    if (!updatedTarget.phone2 && contactToMerge.phone1 && contactToMerge.phone1 !== updatedTarget.phone1) {
      updatedTarget.phone2 = contactToMerge.phone1;
    }

    // Merge notes
    const cleanTargetNotes = updatedTarget.notes.replace(/\[DUPLICADO con:.*?\]/g, '').trim();
    const cleanSourceNotes = contactToMerge.notes.replace(/\[DUPLICADO con:.*?\]/g, '').trim();
    const fusionInfo = `[FUSIÓN: Datos de ${contactToMerge.fullName} combinados el ${new Date().toLocaleDateString()}]`;
    
    let finalNotes = cleanTargetNotes;
    if (cleanSourceNotes && cleanSourceNotes !== cleanTargetNotes) {
      finalNotes = finalNotes ? `${finalNotes} | ${cleanSourceNotes}` : cleanSourceNotes;
    }
    updatedTarget.notes = finalNotes ? `${finalNotes} | ${fusionInfo}` : fusionInfo;

    newContacts[targetIndex] = updatedTarget;
    // Remove the source
    const finalContacts = newContacts.filter(c => c.id !== sourceId);
    
    setContacts(detectDuplicates(finalContacts));
  };

  const CompTab = () => {
    const compFileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [compSubTab, setCompSubTab] = useState<'all' | 'trf' | 'activities'>('all');

    const processCompFile = (file: File) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
        alert('Selecciona un archivo .csv, .xlsx o .xls válido.');
        return;
      }
      
      const reader = new FileReader();
      
      const processLoadedRows = (rows: string[][]) => {
        const filtered = rows.filter(r => r.length > 0 && r.some(c => c && String(c).trim() !== ''));
        if (filtered.length <= 1) {
            alert('El archivo cargado no contiene datos suficientes.');
            return;
        }
        
        const headerRow = filtered[0].map(h => String(h).toLowerCase().trim());
        
        const colDate = headerRow.findIndex(h => h.includes('fecha de compra'));
        const colCountry = headerRow.findIndex(h => h.includes('país de compra') || h.includes('pais de compra'));
        const colName = headerRow.findIndex(h => h.includes('titular de la reserva'));
        const colPax = headerRow.findIndex(h => h.includes('cantidad adulto') || h.includes('pax'));
        const colPhone = headerRow.findIndex(h => h.includes('teléfono') || h.includes('telefono'));
        const colDest = headerRow.findIndex(h => h.includes('punto de interés destino') || h.includes('interes destino'));
        const colHotel = headerRow.findIndex(h => (h.includes('hotel') || h.includes('punto de interés')) && !h.includes('destino'));
        const colEmail = headerRow.findIndex(h => h.includes('e-mail') || h.includes('email'));
        const colTime = headerRow.findIndex(h => h.includes('hora pickup') || h.includes('hora'));

        // Try to identify if it's TRF or Activities based on name or headers
        let inferredType: 'trf' | 'activities' | 'comp' = 'comp';
        const fileLower = file.name.toLowerCase();
        if (fileLower.includes('trf') || fileLower.includes('transfer')) inferredType = 'trf';
        else if (fileLower.includes('activi') || fileLower.includes('tour')) inferredType = 'activities';

        const newRecords: CompRecord[] = filtered.slice(1).map((row, idx) => {
            const getVal = (colIdx: number) => colIdx >= 0 ? String(row[colIdx] || '').trim() : '';
            
            const date = getVal(colDate);
            const country = getVal(colCountry);
            const name = getVal(colName);
            const pax = getVal(colPax);
            const phone = getVal(colPhone);
            const dest = getVal(colDest);
            const hotel = getVal(colHotel);
            const email = getVal(colEmail);
            const time = getVal(colTime);

            const titularParts = [];
            if (date) titularParts.push(date);
            if (country) titularParts.push(country.substring(0, 2).toLowerCase()); 
            if (pax) titularParts.push(`x${pax}`);
            if (name) titularParts.push(name);
            if (hotel || dest) titularParts.push(hotel || dest);
            
            const fallbackTitular = String(row[0] || '').trim();
            const finalTitular = titularParts.length > 0 ? titularParts.join(' ') : fallbackTitular;

            const notesArr = [];
            if (time) notesArr.push(`Hora: ${time}`);
            if (inferredType !== 'comp') notesArr.push(`[${inferredType.toUpperCase()}]`);
            
            // Include ALL columns in notes as requested
            row.forEach((cell, cIdx) => {
                if (cell && String(cell).trim() !== '') {
                   const headerName = filtered[0][cIdx] || `Col ${cIdx+1}`;
                   notesArr.push(`${headerName}: ${cell}`);
                }
            });

            const finalNotes = notesArr.length > 0 ? notesArr.join(' | ') : row.slice(3).map(c => String(c).trim()).filter(c => c).join(' | ');

            return {
                id: `comp-${Date.now()}-${idx}`,
                titular: finalTitular,
                email: email,
                phone: phone,
                notes: finalNotes
            };
        });
        
        setCompRecords(detectCompDuplicates([...compRecords, ...newRecords]));
      };

      if (extension === 'csv') {
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const rows = parseCSVText(text);
          processLoadedRows(rows);
        };
        reader.readAsText(file, 'UTF-8');
      } else {
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          processLoadedRows(rows.map(r => r.map(c => String(c))));
        };
        reader.readAsArrayBuffer(file);
      }
    };

    const [compSearch, setCompSearch] = useState('');

    const filteredCompRecords = compRecords.filter(r => {
      const matchesSubTab = compSubTab === 'all' || r.notes.includes(`[${compSubTab.toUpperCase()}]`);
      const searchLower = compSearch.toLowerCase();
      const matchesSearch = !compSearch || 
        r.titular.toLowerCase().includes(searchLower) || 
        (r.phone || "").toLowerCase().includes(searchLower) || 
        r.notes.toLowerCase().includes(searchLower);
      return matchesSubTab && matchesSearch;
    });

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-6"
      >
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-100">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-display text-gray-900 tracking-tight">Módulo COMP</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Conciliación de Datos Consolidado</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {compRecords.length > 0 && (
                <>
                  <button
                    onClick={() => setCompRecords([])}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition border border-red-100 flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Limpiar
                  </button>
                  {compRecords.some(r => r.isDuplicate) && (
                    <button
                      onClick={() => {
                        const seenPhones = new Set<string>();
                        const newR = compRecords.filter((r) => {
                          const phones = r.phone?.split(',') || [];
                          const cleanPhones = phones.map(p => p.replace(/\D/g, '')).filter(p => p.length >= 8);
                          
                          if (r.isDuplicate) {
                             const hasBeenSeen = cleanPhones.every(p => seenPhones.has(p));
                             if (hasBeenSeen && cleanPhones.length > 0) return false;
                             cleanPhones.forEach(p => seenPhones.add(p));
                             return true;
                          }
                          return true;
                        });
                        setCompRecords(detectCompDuplicates(newR));
                      }}
                      className="px-4 py-2 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-xl text-xs font-bold border border-orange-200 transition flex items-center gap-2 shadow-sm"
                    >
                      <Filter className="w-4 h-4" />
                      Eliminar Duplicados
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const blob = generateCompVCFBlob(compRecords);
                      downloadVCF(blob, 'contactos_comp.vcf');
                    }}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-200"
                  >
                    <Download className="w-4 h-4" />
                    Exportar VCF
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div 
              className={`border-2 border-dashed ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} rounded-2xl p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition relative overflow-hidden group shadow-sm`}
              onClick={() => compFileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) processCompFile(e.dataTransfer.files[0]); }}
            >
              <input type="file" ref={compFileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={(e) => { if (e.target.files?.length) processCompFile(e.target.files[0]); }} />
              <div className="relative z-10">
                <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-100 group-hover:text-blue-600 transition">
                  <FileSpreadsheet className="w-6 h-6 text-gray-400 group-hover:text-blue-600" />
                </div>
                <p className="text-sm text-gray-600 font-medium">Sube tu archivo <span className="font-bold text-gray-900">Excel</span> o <span className="font-bold text-gray-900">CSV</span></p>
                <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">Arrastra y suelta aquí</p>
              </div>
            </div>

            <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 flex flex-col justify-center gap-4">
               <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Búsqueda Rápida</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar por nombre, teléfono o notas..."
                      value={compSearch}
                      onChange={e => setCompSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition bg-white text-sm"
                    />
                  </div>
               </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-t border-gray-100">
            <div className="flex bg-gray-100 p-1 rounded-[14px] border border-gray-200/50 shadow-inner">
              {[
                { id: 'all', label: 'Todos', color: 'gray' },
                { id: 'trf', label: 'TRF', color: 'blue' },
                { id: 'activities', label: 'Actividades', color: 'emerald' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setCompSubTab(sub.id as any)}
                  className={`px-5 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all duration-200 ${
                    compSubTab === sub.id 
                      ? 'bg-white text-blue-700 shadow-md ring-1 ring-black/5' 
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
            
            {filteredCompRecords.length > 0 && (
              <div className="flex gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</span>
                  <span className="text-xl font-bold text-gray-900 font-display">{filteredCompRecords.length}</span>
                </div>
                {filteredCompRecords.some(r => r.isDuplicate) && (
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Duplicados</span>
                    <span className="text-xl font-bold text-orange-600 font-display">{filteredCompRecords.filter(r => r.isDuplicate).length}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden mt-6">
             <div className="hidden md:grid grid-cols-12 gap-4 bg-gray-50 p-4 text-xs font-semibold uppercase text-gray-700 border-b border-gray-200">
                <div className="col-span-3">Titular de la reserva</div>
                <div className="col-span-2">Teléfonos</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-3">Notas</div>
                <div className="col-span-1">Acciones</div>
             </div>
             <div className="divide-y divide-gray-200 bg-white">
                {filteredCompRecords.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm italic">
                     {compSubTab === 'all' 
                       ? "Aún no has cargado ningún registro COMP. Selecciona el tipo \"Planilla COMP\" arriba y sube tu archivo."
                       : `No hay registros marcados como ${compSubTab.toUpperCase()} en esta lista.`}
                  </div>
                ) : (
                  filteredCompRecords.map((c, idx) => (
                    <div key={c.id} className={`p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center transition border-l-2 ${c.isDuplicate ? 'bg-yellow-50/50 border-yellow-400' : 'hover:bg-blue-50/30 border-transparent hover:border-blue-500'}`}>
                       <div className="md:col-span-3">
                          <label className="block md:hidden text-[10px] font-bold text-gray-400 uppercase mb-1">Titular de la reserva</label>
                          <input 
                            type="text" 
                            value={c.titular} 
                            onChange={e => {
                               const newR = [...compRecords];
                               const rIdx = newR.findIndex(r => r.id === c.id);
                               newR[rIdx].titular = e.target.value;
                               setCompRecords(detectCompDuplicates(newR));
                            }}
                            className="w-full bg-transparent border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-2 text-sm font-medium focus:bg-white"
                          />
                       </div>
                       <div className="md:col-span-2 flex flex-col gap-1.5 py-1">
                          <label className="block md:hidden text-[10px] font-bold text-gray-400 uppercase">Teléfonos</label>
                          <div className="flex flex-col gap-1">
                            {(c.phone || "").split(',').map((p, pIdx, arr) => {
                              const cleanP = p.trim();
                              return (
                                <div key={`${c.id}-phone-${pIdx}`} className="flex items-center gap-1.5 group/phone">
                                  <div className="flex-1">
                                    <input 
                                      type="text" 
                                      value={cleanP} 
                                      onChange={e => {
                                         const pParts = [...arr];
                                         pParts[pIdx] = e.target.value;
                                         const newR = [...compRecords];
                                         const rIdx = newR.findIndex(r => r.id === c.id);
                                         newR[rIdx].phone = pParts.join(', ');
                                         setCompRecords(detectCompDuplicates(newR));
                                      }}
                                      placeholder={`Teléfono ${pIdx + 1}`}
                                      className="w-full bg-transparent border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-2 text-sm focus:bg-white font-mono"
                                    />
                                  </div>
                                  {cleanP.replace(/\D/g, '') && (
                                    <a 
                                      href={`https://wa.me/${cleanP.replace(/\D/g, '')}`} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition shadow-sm border border-green-200 flex-shrink-0"
                                      title={`WhatsApp: ${cleanP}`}
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  {arr.length > 1 && (
                                    <button
                                      onClick={() => {
                                        const pParts = arr.filter((_, i) => i !== pIdx);
                                        const newR = [...compRecords];
                                        const rIdx = newR.findIndex(r => r.id === c.id);
                                        newR[rIdx].phone = pParts.join(', ');
                                        setCompRecords(detectCompDuplicates(newR));
                                      }}
                                      className="p-1 opacity-0 group-hover/phone:opacity-100 text-red-300 hover:text-red-500 transition"
                                      title="Quitar este número"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            <button
                               onClick={() => {
                                 const newR = [...compRecords];
                                 const rIdx = newR.findIndex(r => r.id === c.id);
                                 newR[rIdx].phone = c.phone ? `${c.phone}, ` : " ";
                                 setCompRecords(newR);
                               }}
                               className="text-[10px] text-blue-500 hover:text-blue-700 w-fit italic ml-2 opacity-60 hover:opacity-100 transition-opacity"
                            >
                              + Agregar teléfono
                            </button>
                          </div>
                       </div>
                       <div className="md:col-span-3">
                          <label className="block md:hidden text-[10px] font-bold text-gray-400 uppercase mb-1">Email</label>
                          <input 
                            type="email" 
                            value={c.email} 
                            onChange={e => {
                               const newR = [...compRecords];
                               const rIdx = newR.findIndex(r => r.id === c.id);
                               newR[rIdx].email = e.target.value;
                               setCompRecords(detectCompDuplicates(newR));
                            }}
                            className="w-full bg-transparent border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-2 text-sm text-blue-700/80 focus:bg-white"
                          />
                       </div>
                       <div className="md:col-span-3">
                          <label className="block md:hidden text-[10px] font-bold text-gray-400 uppercase mb-1">Notas</label>
                          <div className="flex gap-1 items-center">
                            <input 
                              type="text" 
                              value={c.notes} 
                              onChange={e => {
                                 const newR = [...compRecords];
                                 const rIdx = newR.findIndex(r => r.id === c.id);
                                 newR[rIdx].notes = e.target.value;
                                 setCompRecords(detectCompDuplicates(newR));
                              }}
                              className="w-full bg-transparent border-transparent hover:border-gray-200 focus:border-blue-500 rounded px-2 text-[11px] text-gray-500 focus:bg-white truncate"
                              title={c.notes}
                            />
                            {c.notes.includes('[TRF]') && <span className="bg-blue-100 text-blue-700 text-[8px] font-bold px-1 rounded">TRF</span>}
                            {c.notes.includes('[ACTIVITIES]') && <span className="bg-emerald-100 text-emerald-700 text-[8px] font-bold px-1 rounded">ACT</span>}
                          </div>
                       </div>
                       <div className="md:col-span-1 flex justify-end gap-1">
                          {c.isDuplicate && (
                            <button 
                              onClick={() => mergeRecords(c.id)}
                              className="p-1 px-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition flex items-center gap-1"
                              title="Fusionar con otros registros que comparten el mismo teléfono"
                            >
                              <GitMerge className="w-3.5 h-3.5" />
                              <span className="md:hidden lg:inline text-[10px] font-bold uppercase">Fusionar</span>
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              const newR = compRecords.filter(r => r.id !== c.id);
                              setCompRecords(detectCompDuplicates(newR));
                            }}
                            className="p-1 px-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="Eliminar registro"
                          >
                            ✕
                          </button>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const EventReportTab = ({ contacts }: { contacts: Contact[] }) => {
    // Flat activities
    const allEvents = contacts.flatMap(c => {
      const activityParts = c.activities.split(',').map(a => a.trim()).filter(a => a);
      const date = parseDate(c.fullName.split(' ')[0]);
      const dateStrForGroup = c.fullName.split(' ')[0] || 'Sin fecha';
      
      const rawNameParts = c.fullName.split(' ');
      const rawPaxVal = c.pax || '1';
      const cleanName = rawNameParts.slice(2).join(' ').split(' - en ')[0] || c.fullName;
      const hotelName = c.fullName.includes(' - en ') ? c.fullName.split(' - en ')[1] : '';

      if (activityParts.length === 0) {
        return [{
          id: `${c.id}-none`,
          contact: c,
          activity: 'Sin actividad asignada',
          date: date,
          dateStr: dateStrForGroup,
          cleanName,
          hotelName,
          pax: rawPaxVal
        }];
      }

      return activityParts.map((act, i) => ({
        id: `${c.id}-${i}`,
        contact: c,
        activity: act,
        date: date,
        dateStr: dateStrForGroup,
        cleanName,
        hotelName,
        pax: rawPaxVal
      }));
    });

    // Filter by search
    const filteredEvents = allEvents.filter(ev => {
      const query = reportSearch.toLowerCase().trim();
      if (!query) return true;
      return ev.activity.toLowerCase().includes(query) || 
             ev.cleanName.toLowerCase().includes(query) || 
             ev.hotelName.toLowerCase().includes(query) ||
             ev.contact.phone1.includes(query) ||
             ev.contact.phone2.includes(query);
    });

    // Grouping by dateStr
    const groups: { [dateStr: string]: typeof filteredEvents } = {};
    filteredEvents.forEach(ev => {
      const key = ev.dateStr;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(ev);
    });

    // Sort dates
    const sortedDateKeys = Object.keys(groups).sort((a, b) => {
      const dateA = parseDate(a);
      const dateB = parseDate(b);
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.getTime() - dateB.getTime();
    });

    if (contacts.length === 0) {
      return (
        <div className="p-8 text-center text-gray-400 text-sm">
          Ningún contacto cargado para generar el reporte. Sube un archivo en el Paso 1.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900">Resumen del Reporte de Actividades</h3>
            <p className="text-xs text-gray-500">Total de actividades/eventos: <span className="font-bold text-gray-800">{filteredEvents.length}</span> (Filtrados de {allEvents.length} en total)</p>
          </div>
          <div className="w-full sm:w-72">
            <input 
              type="text"
              placeholder="🔍 Buscar por actividad, titular, hotel..."
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No se encontraron eventos para el filtro "{reportSearch}".
          </div>
        ) : (
          <div className="space-y-6 max-h-[600px] overflow-y-auto pr-1">
            {sortedDateKeys.map(dateKey => {
              const items = groups[dateKey];
              const parsed = parseDate(dateKey);
              const formattedHeader = parsed 
                ? parsed.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                : `Fecha: ${dateKey}`;

              return (
                <div key={dateKey} className="space-y-2 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 bg-white py-1 z-10">{formattedHeader}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map(ev => {
                      const phone = ev.contact.phone1 || ev.contact.phone2 || '';
                      const phoneClean = phone.replace(/\D/g, '');
                      const text = encodeURIComponent(`Hola ${ev.cleanName}, te escribimos de la agencia para verificar tu actividad "${ev.activity}" programada para el día ${ev.dateStr}.`);
                      
                      return (
                        <div key={ev.id} className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition shadow-sm flex flex-col justify-between h-full">
                          <div>
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                                {ev.activity}
                              </span>
                              {ev.pax && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                  👥 {ev.pax} pax
                                </span>
                              )}
                            </div>
                            
                            <h5 className="font-semibold text-sm text-gray-900 mb-1">{ev.cleanName}</h5>
                            {ev.hotelName && (
                              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                🏨 {ev.hotelName}
                              </p>
                            )}
                            {phone && (
                              <p className="text-xs text-gray-600 font-mono mb-2">
                                📞 {phone}
                              </p>
                            )}
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                            {phone && (
                              <a 
                                href={`https://wa.me/${phoneClean}?text=${text}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-lg border border-green-200 transition"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                                Mensaje WA
                              </a>
                            )}
                            <button
                              onClick={() => {
                                const singleSharedGroup = getSharedGroup(ev.contact, contacts);
                                const singleBlob = generateVCFBlobs(singleSharedGroup);
                                const cleanFn = ev.cleanName.replace(/[^a-zA-Z0-9]/g, '_');
                                downloadVCF(singleBlob, `${cleanFn}_contacto.vcf`);
                              }}
                              className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-medium"
                            >
                              Descargar VCF
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const [isReportOpen, setIsReportOpen] = useState(false);

  const ReportOverlay = ({ contacts }: { contacts: Contact[] }) => {
    if (!isReportOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Reporte Completo de Eventos</h2>
            <button onClick={() => setIsReportOpen(false)} className="text-gray-400 hover:text-gray-600 font-semibold p-2">✕</button>
          </div>
          <div className="p-6 overflow-y-auto">
             {/* Report content (same as Calendar72h but for ALL items) */}
             <div className="space-y-4">
                {contacts.flatMap(c => {
                  const activityParts = c.activities.split(',').map(a => a.trim()).filter(a => a);
                  const date = parseDate(c.fullName.split(' ')[0]);
                  return activityParts.map((act, i) => ({
                    ...c,
                    activity: act,
                    date: date || new Date(0),
                    id: `${c.id}-${i}`
                  }));
                }).sort((a,b) => a.date.getTime() - b.date.getTime()).map((a, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-white rounded-lg border border-gray-100 shadow-sm hover:border-blue-200 transition">
                     <div className="text-sm font-bold text-blue-700 min-w-[100px]">{a.date.getTime() === 0 ? 'N/A' : a.date.toLocaleDateString()}</div>
                     <div className="text-sm text-gray-800 flex-1">{a.activity}</div>
                     <div className="text-sm font-semibold text-gray-900 truncate max-w-[250px]">{a.fullName.split(' ').slice(2).join(' ')}</div>
                  </div>
                ))}
             </div>
           </div>
         </div>
       </div>
     );
   };

   const CalendarPreviewModal = () => {
     const [copied, setCopied] = useState(false);
     
     if (!isPreviewOpen) return null;

     const rawICS = contacts.length > 0 ? generateICSString(contacts) : "";

     const handleCopy = () => {
       navigator.clipboard.writeText(rawICS);
       setCopied(true);
       setTimeout(() => setCopied(false), 2000);
     };

     return (
       <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm animate-in fade-in duration-200">
         <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150">
           <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
             <div>
               <h2 className="text-lg font-bold text-gray-950 flex items-center gap-2">
                 <span className="bg-orange-100 text-orange-850 text-xs font-bold px-2.5 py-0.5 rounded-full">ICS</span>
                 Vista Previa de Calendario (.ics)
               </h2>
               <p className="text-xs text-gray-500 mt-0.5">Código de bloques VEVENT que se integrarán en tu archivo de calendario</p>
             </div>
             <button onClick={() => setIsPreviewOpen(false)} className="text-gray-400 hover:text-gray-650 font-semibold p-2 rounded-lg hover:bg-gray-100 transition-colors">✕</button>
           </div>
           
           <div className="p-6 overflow-hidden bg-gray-950 flex-1 flex flex-col min-h-0">
             <div>
                             </div>{/* Bloque Informativo */}
              <div className="mb-4 p-3.5 bg-teal-950/40 border border-teal-900/30 rounded-xl flex items-start gap-2.5 text-xs text-teal-200">
                <AlertCircle className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div className="leading-normal text-left">
                  <strong className="text-white font-semibold">💡 Sincronización Inteligente de Eventos (Evita Duplicados):</strong>{" "}
                  Cada evento cuenta con un identificador único regulado (<code className="bg-teal-900/50 px-1 py-0.5 rounded text-teal-300 font-mono">UID</code>) determinista. Al importar este archivo en Google Calendar, Outlook o Apple Calendar, si un evento ya existe, la plataforma <span className="font-semibold text-white underline decoration-teal-400">no lo duplicará</span>, sino que <span className="font-semibold text-white">reemplazará y fusionará (merge)</span> la información actual con los nuevos cambios si hay diferencias registradas.
                </div>
              </div>

              <div className="flex items-center justify-between mb-3 text-xs text-gray-400 font-mono border-b border-gray-900 pb-2">
                <span>FORMATO DE EVENTOS GENERADOS (RFC 5545)</span>
                <button 
                  onClick={handleCopy}
                  className="bg-gray-850 hover:bg-gray-800 text-white font-medium px-3 py-1 rounded transition-colors flex items-center gap-1.5 text-xs font-sans"
                >
                  {copied ? "¡Copiado!" : "Copiar archivo completo"}
                </button>
              </div>
              <div className="mb-4 p-3.5 bg-teal-950/40 border border-teal-900/30 rounded-xl flex items-start gap-2.5 text-xs text-teal-200">

                <div className="leading-normal text-left">
                  
                  
                </div>
               <button 
                 onClick={handleCopy}
                 className="hidden"
               >
                 {copied ? "¡Copiado!" : "Copiar archivo completo"}
               </button>
             </div>
             <div className="flex-1 overflow-auto bg-gray-900 p-4 rounded-lg border border-gray-800 font-mono text-xs text-orange-400 leading-relaxed text-left select-all whitespace-pre-wrap">
               {rawICS || "Ningún evento cargado para previsualizar."}
             </div>
           </div>

           <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
             <button
               onClick={() => setIsPreviewOpen(false)}
               className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-105 font-medium text-sm transition"
             >
               Cerrar
            </button>
             <button
               onClick={() => {
                 const blob = generateICSBlob(contacts);
                 downloadVCF(blob, 'calendario_eventos.ics');
                 setIsPreviewOpen(false);
               }}
               className="px-4 py-2 bg-orange-600 hover:bg-orange-750 text-white font-semibold rounded-lg text-sm transition flex items-center gap-1.5 shadow-sm"
             >
               <Download className="w-4 h-4" />
               Descargar .ics
             </button>
           </div>
         </div>
       </div>
     );
   };

  return (
    <div className="bg-gray-50 min-h-screen text-gray-800 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-gray-100 overflow-hidden relative"
        >
          <div className="absolute top-[-20px] right-[-20px] p-8 opacity-[0.03] rotate-12">
             <MessageCircle className="w-48 h-48" />
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-3 mb-1">
                <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
                  <FileSpreadsheet className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold font-display text-gray-900 tracking-tight">WhatsApp <span className="text-blue-600">Pro</span> Manager</h1>
              </div>
              <p className="text-sm text-gray-500 max-w-xl">
                Carga, concilia y verifica tus contactos. Especializado en planillas <span className="font-semibold text-gray-700 font-display">TRF</span>, <span className="font-semibold text-gray-700 font-display">COMP</span> y <span className="font-semibold text-gray-700 font-display">Actividades</span>.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 px-6 py-4 rounded-2xl border border-blue-100/50 flex items-center gap-4 shadow-sm">
              <div className="relative">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md border-2 border-white font-display">P</div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm" title="En línea"></div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-0.5 font-display">Gestión Administrativa</p>
                <p className="text-xl font-bold text-gray-900 leading-none font-display">¡Hola, Paola!</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-200">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">1</span>
                Cargar archivo de datos
              </h2>

              <div className="flex flex-wrap gap-3 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
                {[
                  { value: 'trf', label: 'Planilla TRF', color: 'blue', icon: <FileSpreadsheet className="w-4 h-4" /> },
                  { value: 'comp', label: 'Planilla COMP', color: 'indigo', icon: <FileText className="w-4 h-4" /> },
                  { value: 'activities', label: 'Planilla Actividades', color: 'emerald', icon: <Calendar className="w-4 h-4" /> }
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setSpreadsheetType(type.value as SpreadsheetType)}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                      spreadsheetType === type.value 
                        ? `bg-white text-${type.color}-700 shadow-md border border-gray-200 ring-2 ring-${type.color}-500/10` 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                    }`}
                  >
                    {type.icon}
                    {type.label}
                  </button>
                ))}
              </div>

              <div 
                className={`border-2 border-dashed ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} rounded-lg p-6 md:p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition mb-2`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]); }}
              >
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={(e) => { if (e.target.files?.length) processFile(e.target.files[0]); }} />
                <FileSpreadsheet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Arrastra tu archivo <strong>Excel (.xlsx, .xls)</strong> o <strong>.csv</strong> aquí o haz clic para subirlo</p>
              </div>
              {filename && (
                <div className="text-xs text-gray-500">
                  Archivo actual: <span className="font-semibold text-gray-700">{filename}</span>
                </div>
              )}
            </div>

            {headers.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-200 animate-in fade-in slide-in-from-top-4">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">2</span>
                  Mapear columnas del archivo
                </h2>
                <p className="text-xs text-gray-500 mb-4">Relaciona las columnas detectadas en tu archivo con los datos requeridos para el contacto:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: 'mapName', label: 'Nombre del Titular' },
                    { key: 'mapPhone', label: 'Teléfono' },
                    { key: 'mapEmail', label: 'Correo Electrónico' },
                    { key: 'mapHotel', label: 'Hotel / Destino' },
                    { key: 'mapPax', label: 'Pasajeros (Pax)' },
                    { key: 'mapDate', label: 'Fecha de llegada (Opcional)' },
                    { key: 'mapActivities', label: 'Actividades / Tours' }
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                      <select 
                        value={mappings[field.key as keyof Mappings]}
                        onChange={(e) => setMappings({ ...mappings, [field.key]: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- No usar / Vacío --</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <Calendar72h contacts={contacts} />
            
            {contacts.length > 0 && (
                <button
                  onClick={() => {
                    setActiveTab('report');
                    setTimeout(() => {
                      document.getElementById('data-section')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  className="w-full mt-4 bg-gray-800 hover:bg-gray-900 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm flex items-center justify-center gap-2"
                >
                  Ver Reporte de Eventos (Nueva Solapa)
                </button>
            )}
            
            <ReportOverlay contacts={contacts} />
            <CalendarPreviewModal />
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-blue-50 p-2 rounded-lg">
                  <Settings className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-lg font-bold font-display text-gray-900 uppercase tracking-tight">Configuración Global</h2>
              </div>
              
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha por defecto</label>
                <input 
                  type="text" 
                  value={config.defaultDate} 
                  onChange={(e) => setConfig({ ...config, defaultDate: e.target.value })} 
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" 
                />
              </div>

              <hr className="my-4" />

              <h2 className="text-md font-semibold mb-3 text-gray-950">Módulo de Verificación de WhatsApp</h2>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Método de Validación</label>
                <select 
                  value={config.waMethod} 
                  onChange={(e) => setConfig({ ...config, waMethod: e.target.value as WaMethod })}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="manual">Enlace Manual (Gratuito - Abre Chat)</option>
                  <option value="simulation">Simulación local (Prueba sin costo)</option>
                  <option value="wassenger">Wassenger API (Requiere Token)</option>
                  <option value="wasender">WASenderApi (Requiere Token)</option>
                </select>
              </div>
              
              {(config.waMethod === 'wassenger' || config.waMethod === 'wasender') && (
                <div className="mb-4 animate-in fade-in">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Token de API</label>
                  <input 
                    type="password" 
                    placeholder="Introduce tu Token / Clave API" 
                    value={config.waToken} 
                    onChange={(e) => setConfig({ ...config, waToken: e.target.value })} 
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" 
                  />
                </div>
              )}
              
              <button 
                onClick={handleVerifyWA}
                disabled={contacts.length === 0 || isVerifying || config.waMethod === 'manual'} 
                className="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Comprobando...
                  </>
                ) : 'Comprobar números en masa'}
              </button>

              <hr className="my-4" />

              {contacts.length === 0 ? (
                <div className="mb-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                  <p className="text-xs text-yellow-800">Carga un archivo Excel o CSV para habilitar la conversión.</p>
                </div>
              ) : (
                <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-xs text-green-800">Estado: {contacts.length} contactos procesados correctamente.</p>
                </div>
              )}

              <button 
                onClick={handleDownloadAll}
                disabled={contacts.length === 0} 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Guardar contactos (.vcf)
              </button>
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => {
                     const blob = generateICSBlob(contacts);
                     downloadVCF(blob, 'calendario_eventos.ics');
                  }}
                  disabled={contacts.length === 0} 
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Calendario (.ics)
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  disabled={contacts.length === 0}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-4 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 border border-gray-300"
                  title="Vista Previa de Calendario"
                >
                  <Eye className="w-4 h-4" />
                  Previsualizar
                </button>
              </div>

              {contacts.length > 0 && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-[11px] text-orange-850 leading-normal flex items-start gap-1.5 animate-in fade-in text-left">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-orange-950 block mb-0.5">⚠️ Control de Duplicados en Calendario</span>
                    Al importar el archivo, Google Calendar u Outlook usarán el identificador regulado (<code className="bg-orange-100 px-1 py-0.5 rounded font-mono text-orange-900 text-[10px]">UID</code>) estable de cada cliente. Si subes información con modificaciones, la plataforma <span className="underline decoration-orange-400 font-semibold text-orange-950">no lo duplicará</span>, sino que actualizará y fusionará (<span className="font-semibold text-orange-950 text-[11px]">merge</span>) los cambios directamente sobre el mismo evento.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          id="data-section" 
          className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mt-8 border border-gray-100"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-gray-100 pb-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-100">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold font-display text-gray-900 leading-tight">3. Tablero de Gestión</h2>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-semibold opacity-70">Control integral de contactos y eventos</p>
              </div>
            </div>
            
            <div className="flex bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200/50 backdrop-blur-sm self-start">
              {[
                { id: 'contacts', label: 'Contactos', icon: <Users className="w-4 h-4" /> },
                { id: 'report', label: 'Eventos', icon: <Calendar className="w-4 h-4" /> },
                { id: 'comp', label: 'COMP', icon: <Share2 className="w-4 h-4" /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative flex items-center gap-2 px-6 py-2.5 rounded-[14px] text-xs font-bold uppercase tracking-wider transition-all duration-300 z-10 ${
                    activeTab === tab.id 
                      ? 'text-blue-700' 
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white shadow-sm border border-gray-200 rounded-[14px] z-[-1]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          
          {activeTab === 'contacts' ? (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <div className="hidden md:grid grid-cols-12 gap-4 bg-gray-50 p-4 text-xs font-semibold uppercase text-gray-700 border-b border-gray-200">
                <div className="col-span-3">Nombre Completo de Contacto</div>
                <div className="col-span-2">Teléfonos</div>
                <div className="col-span-2">Email</div>
                <div className="col-span-1">Actividades</div>
                <div className="col-span-2 text-center">WhatsApp</div>
                <div className="col-span-2 text-center">Exportar Contacto</div>
              </div>
              
              <div className="divide-y divide-gray-200 bg-white">
                {contacts.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    {rawRows.length > 0 ? "Verifica que las columnas de Nombre y Teléfono estén asignadas correctamente." : "Ningún archivo cargado."}
                  </div>
                ) : (
                  contacts.map((c, index) => (
                    <div key={c.id} className="p-4 md:p-3 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center hover:bg-gray-50 transition animate-in fade-in">
                      <div className="md:col-span-3 space-y-1">
                        <label className="block md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nombre Completo</label>
                        <div className="flex items-center gap-2">
                          {c.isDuplicate && <span title="Teléfono duplicado"><AlertCircle className="w-4 h-4 text-red-500" /></span>}
                          <input 
                            type="text" 
                            value={c.fullName} 
                            onChange={(e) => updateContact(index, 'fullName', e.target.value)} 
                            className={`w-full bg-transparent border border-gray-200 md:border-transparent md:hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2.5 py-1.5 md:py-0.5 text-sm font-medium ${c.isDuplicate ? 'text-red-700' : 'text-gray-900'} transition-all duration-150`}
                          />
                        </div>
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <div>
                          <label className="block md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-wider">WhatsApp 1 / Móvil</label>
                          <input 
                            type="text" 
                            value={c.phone1} 
                            placeholder="WhatsApp 1"
                            onChange={(e) => updateContact(index, 'phone1', e.target.value)} 
                            className="w-full bg-transparent border border-gray-200 md:border-transparent md:hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2.5 py-1.5 md:py-0.5 text-sm transition-all duration-150" 
                          />
                        </div>
                        <div className={c.phone2 ? "block" : "hidden md:block"}>
                          <label className="block md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-wider">WhatsApp 2 / Casa</label>
                          <input 
                            type="text" 
                            value={c.phone2} 
                            placeholder="WhatsApp 2"
                            onChange={(e) => updateContact(index, 'phone2', e.target.value)} 
                            className="w-full bg-transparent border border-gray-200 md:border-transparent md:hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2.5 py-1.5 md:py-0.5 text-sm transition-all duration-150" 
                          />
                        </div>
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="block md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email</label>
                        <input 
                          type="text" 
                          value={c.email} 
                          placeholder="Sin email" 
                          onChange={(e) => updateContact(index, 'email', e.target.value)} 
                          className="w-full bg-transparent border border-gray-200 md:border-transparent md:hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2.5 py-1.5 md:py-0.5 text-sm font-mono text-xs transition-all duration-150" 
                        />
                      </div>
                      <div className="md:col-span-1 space-y-1">
                        <label className="block md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-wider">Actividades</label>
                        <input 
                          type="text" 
                          value={c.activities} 
                          placeholder="Sin actividades" 
                          onChange={(e) => updateContact(index, 'activities', e.target.value)} 
                          className="w-full bg-transparent border border-gray-200 md:border-transparent md:hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2.5 py-1.5 md:py-0.5 text-sm transition-all duration-150" 
                        />
                      </div>
                      <div className="md:col-span-2 flex flex-col md:justify-center gap-2">
                         <div className="flex items-center gap-2">
                           <span className="block md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-auto">WhatsApp 1</span>
                           {getWABadge(c.waStatus1, c.phone1, c.fullName)}
                         </div>
                         {(c.phone2 || c.waStatus2 !== 'unverified') && (
                           <div className="flex items-center gap-2">
                             <span className="block md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-auto">WhatsApp 2</span>
                             {getWABadge(c.waStatus2, c.phone2, c.fullName)}
                           </div>
                         )}
                      </div>
                      <div className="md:col-span-2 flex flex-col md:items-center justify-center gap-2 pt-2.5 md:pt-0 border-t md:border-t-0 border-gray-100">
                         <span className="block md:hidden text-[10px] font-bold text-gray-450 uppercase tracking-wider mr-auto">Exportar Contacto</span>
                         <div className="flex flex-col gap-1 w-full">
                           <button 
                              onClick={() => {
                                const sharedGroup = getSharedGroup(c, contacts);
                                const blob = generateVCFBlobs(sharedGroup);
                                const cleanFilename = c.fullName.replace(/[^a-zA-Z0-9]/g, '_');
                                downloadVCF(blob, `${cleanFilename}_contactos.vcf`);
                              }} 
                              className="w-full justify-center inline-flex items-center gap-1.5 text-[11px] bg-[#128C7E] hover:bg-[#075E54] text-white px-2 py-1.5 rounded font-semibold transition-colors shadow-sm text-center"
                            >
                              <Download className="w-3.5 h-3.5" /> Guardar contacto de WhatsApp
                           </button>
                           {c.isDuplicate && (
                             <button
                                onClick={() => mergeMainContacts(c.id)}
                                className="w-full justify-center inline-flex items-center gap-1.5 text-[11px] bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1.5 rounded font-semibold transition-colors border border-blue-200"
                                title="Fusionar este contacto con el original"
                             >
                               <GitMerge className="w-3.5 h-3.5" /> Fusionar Contacto
                             </button>
                           )}
                         </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : activeTab === 'report' ? (
            <div className="bg-white rounded-xl p-2 animate-in fade-in duration-200">
              <EventReportTab contacts={contacts} />
            </div>
          ) : (
            <div className="bg-white rounded-xl p-2 animate-in fade-in duration-200">
              <CompTab />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}


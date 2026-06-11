/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Download, AlertCircle, FileSpreadsheet, CheckCircle2, XCircle, MessageCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  parseCSVText,
  computeInitialMappings,
  generateContacts,
  generateVCFBlob,
  downloadVCF,
  delay,
  checkWassenger,
  checkWASender,
  formatPhone
} from './lib/utils';
import { Contact, WaMethod, GlobalConfig, Mappings } from './types';

export default function App() {
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
  const [isVerifying, setIsVerifying] = useState(false);

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

  const processLoadedRows = (rows: string[][]) => {
    let filteredRows = rows.filter(r => r.length > 0 && r.some(cell => cell && String(cell).trim() !== ''));
    if (filteredRows.length === 0) {
      alert('El archivo cargado no contiene datos válidos.');
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
    const blob = generateVCFBlob(contacts);
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

  return (
    <div className="bg-gray-50 min-h-screen text-gray-800 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
        
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Panel de Control de Contactos con Verificación WhatsApp</h1>
          <p className="text-sm text-gray-600">Sube un archivo Excel (.xlsx, .xls) o CSV, asocia las columnas y comprueba de forma manual o automática si los números disponen de WhatsApp activo.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-200">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">1</span>
                Cargar archivo de datos
              </h2>
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
            
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-200">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Configuración Global</h2>
              
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
                Guardar todos
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 mt-6 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">3. Revisar, Editar y Guardar Contactos</h2>
            <span className="text-xs text-gray-500">Puedes modificar directamente los campos en la lista</span>
          </div>
          
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-4 bg-gray-50 p-4 text-xs font-semibold uppercase text-gray-700 border-b border-gray-200">
              <div className="col-span-3">Nombre Completo de Contacto</div>
              <div className="col-span-2">Teléfono</div>
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
                        <label className="block md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-wider">Teléfono 1</label>
                        <input 
                          type="text" 
                          value={c.phone1} 
                          onChange={(e) => updateContact(index, 'phone1', e.target.value)} 
                          className="w-full bg-transparent border border-gray-200 md:border-transparent md:hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2.5 py-1.5 md:py-0.5 text-sm transition-all duration-150" 
                        />
                      </div>
                      <div className={c.phone2 ? "block" : "hidden md:block"}>
                        <label className="block md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-wider">Teléfono 2</label>
                        <input 
                          type="text" 
                          value={c.phone2} 
                          placeholder="Teléfono 2 (opcional)"
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
                       <span className="block md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-auto">Exportar Contacto</span>
                       <button 
                          onClick={() => {
                            const blob = generateVCFBlob([c]);
                            const cleanFilename = c.fullName.replace(/[^a-zA-Z0-9]/g, '_');
                            downloadVCF(blob, `${cleanFilename}.vcf`);
                          }} 
                          className="w-full justify-center inline-flex items-center gap-1.5 text-[11px] bg-[#128C7E] hover:bg-[#075E54] text-white px-2 py-1.5 rounded font-semibold transition-colors shadow-sm text-center"
                        >
                          <Download className="w-3.5 h-3.5" /> Guardar contacto de WhatsApp
                       </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}


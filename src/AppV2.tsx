import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ContactRound,
  FileSpreadsheet,
  GitMerge,
  LayoutDashboard,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import LegacyApp from './App';
import { detectContactDuplicates } from './lib/contacts';
import { loadStoredContacts } from './lib/storage';
import type { Contact } from './types';

type V2View = 'dashboard' | 'operations' | 'contacts' | 'duplicates' | 'settings';

const NAV_ITEMS: Array<{
  id: V2View;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Dashboard', description: 'Resumen operativo', icon: LayoutDashboard },
  { id: 'operations', label: 'Importar', description: 'Excel, CSV y operaciones', icon: FileSpreadsheet },
  { id: 'contacts', label: 'Contactos', description: 'Base consolidada', icon: ContactRound },
  { id: 'duplicates', label: 'Duplicados', description: 'Revisión y limpieza', icon: GitMerge },
  { id: 'settings', label: 'Configuración', description: 'Preferencias y seguridad', icon: Settings },
];

function MetricCard({ label, value, helper, icon: Icon }: { label: string; value: number; helper: string; icon: typeof Users }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Users className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-950">Todavía no hay contactos persistidos</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
        La versión 2 ya tiene preparada la base del CRM. Podés seguir usando el importador actual mientras terminamos de migrar el flujo de datos al almacenamiento persistente.
      </p>
      <button
        onClick={onImport}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
      >
        Abrir importador
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function AppV2() {
  const [view, setView] = useState<V2View>('dashboard');
  const [search, setSearch] = useState('');
  const storedContacts = useMemo(() => loadStoredContacts(), [view]);
  const contacts = useMemo(() => detectContactDuplicates(storedContacts), [storedContacts]);
  const duplicates = contacts.filter(contact => contact.isDuplicate);
  const whatsappReady = contacts.filter(contact => contact.waStatus1 === 'active' || contact.waStatus2 === 'active').length;

  const filteredContacts = contacts.filter(contact => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [contact.fullName, contact.phone1, contact.phone2, contact.email, contact.activities, contact.notes]
      .some(value => (value || '').toLowerCase().includes(query));
  });

  const renderContactRows = (rows: Contact[]) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-12 gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <div className="col-span-4">Contacto</div>
        <div className="col-span-3">Teléfono</div>
        <div className="col-span-3">Email</div>
        <div className="col-span-2">Estado</div>
      </div>
      {rows.map(contact => (
        <div key={contact.id} className="grid grid-cols-12 gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 hover:bg-slate-50/70">
          <div className="col-span-4 min-w-0">
            <p className="truncate font-semibold text-slate-900">{contact.fullName || 'Sin nombre'}</p>
            <p className="truncate text-xs text-slate-400">{contact.activities || 'Sin actividad'}</p>
          </div>
          <div className="col-span-3 self-center text-xs text-slate-600">{contact.phone1 || contact.phone2 || '—'}</div>
          <div className="col-span-3 self-center truncate text-xs text-slate-600">{contact.email || '—'}</div>
          <div className="col-span-2 self-center">
            {contact.isDuplicate ? (
              <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">Duplicado</span>
            ) : (
              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">OK</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-950 px-4 py-6 text-white lg:block">
          <div className="px-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-950/40">
                <ContactRound className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-black tracking-tight">Contactos Pro</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">CRM · v2</p>
              </div>
            </div>
          </div>

          <nav className="mt-8 space-y-1.5">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{item.label}</span>
                    <span className={`block truncate text-[10px] ${active ? 'text-slate-500' : 'text-slate-500'}`}>{item.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Migración segura</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">El gestor actual sigue intacto dentro de Importar mientras pasamos cada módulo a la nueva arquitectura.</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Gestión de contactos</p>
                <h1 className="text-xl font-black tracking-tight text-slate-950">{NAV_ITEMS.find(item => item.id === view)?.label}</h1>
              </div>
              <div className="flex items-center gap-2 lg:hidden">
                <select
                  value={view}
                  onChange={event => setView(event.target.value as V2View)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                >
                  {NAV_ITEMS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </div>
              <div className="hidden items-center gap-3 lg:flex">
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Rama v2 activa</span>
              </div>
            </div>
          </header>

          <div className={view === 'operations' ? 'p-0' : 'p-4 md:p-8'}>
            {view === 'dashboard' && (
              <div className="mx-auto max-w-7xl space-y-6">
                <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">
                  <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">Centro de operaciones</p>
                      <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-tight md:text-4xl">Tus contactos, importaciones y duplicados en un solo lugar.</h2>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">La nueva interfaz separa el trabajo operativo del mantenimiento de datos para que sea más rápida, clara y escalable.</p>
                    </div>
                    <button onClick={() => setView('operations')} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500">
                      Importar archivo <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Contactos" value={contacts.length} helper="Base persistida" icon={Users} />
                  <MetricCard label="Duplicados" value={duplicates.length} helper="Requieren revisión" icon={GitMerge} />
                  <MetricCard label="WhatsApp" value={whatsappReady} helper="Verificados activos" icon={ContactRound} />
                  <MetricCard label="Calidad" value={contacts.length ? Math.round(((contacts.length - duplicates.length) / contacts.length) * 100) : 100} helper="% sin duplicados" icon={LayoutDashboard} />
                </div>

                {contacts.length === 0 ? <EmptyState onImport={() => setView('operations')} /> : (
                  <div className="grid gap-6 xl:grid-cols-3">
                    <div className="xl:col-span-2">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-bold text-slate-950">Contactos recientes</h3>
                        <button onClick={() => setView('contacts')} className="text-xs font-bold text-blue-600 hover:text-blue-700">Ver todos</button>
                      </div>
                      {renderContactRows(contacts.slice(0, 8))}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle className="h-5 w-5" />
                        <h3 className="font-bold">Pendientes de calidad</h3>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{duplicates.length ? `Hay ${duplicates.length} registros marcados como duplicados.` : 'No hay duplicados detectados en la base actual.'}</p>
                      <button onClick={() => setView('duplicates')} className="mt-5 text-xs font-bold text-blue-600">Revisar duplicados →</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {view === 'operations' && (
              <div className="bg-slate-50">
                <div className="border-b border-slate-200 bg-white px-4 py-4 md:px-8">
                  <div className="mx-auto max-w-7xl">
                    <p className="text-sm font-bold text-slate-950">Importador y gestor operativo</p>
                    <p className="mt-1 text-xs text-slate-500">Mantenemos todas las funciones existentes mientras las migramos por módulos.</p>
                  </div>
                </div>
                <LegacyApp />
              </div>
            )}

            {view === 'contacts' && (
              <div className="mx-auto max-w-7xl space-y-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-950">Base de contactos</h2>
                    <p className="text-sm text-slate-500">Búsqueda y revisión rápida de la base persistida.</p>
                  </div>
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar nombre, teléfono, email..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring-4" />
                  </div>
                </div>
                {filteredContacts.length ? renderContactRows(filteredContacts) : <EmptyState onImport={() => setView('operations')} />}
              </div>
            )}

            {view === 'duplicates' && (
              <div className="mx-auto max-w-7xl space-y-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-950">Duplicados</h2>
                  <p className="text-sm text-slate-500">Detectados por teléfono normalizado o email coincidente.</p>
                </div>
                {duplicates.length ? renderContactRows(duplicates) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-800">
                    No hay duplicados en la base persistida actual.
                  </div>
                )}
              </div>
            )}

            {view === 'settings' && (
              <div className="mx-auto max-w-3xl space-y-5">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-950">Configuración</h2>
                  <p className="text-sm text-slate-500">La configuración operativa actual sigue disponible en el importador durante la migración.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="font-bold text-slate-950">Seguridad de credenciales</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">La capa v2 ya evita persistir el token de WhatsApp en localStorage. Los tokens quedan sólo en memoria de sesión.</p>
                  <button onClick={() => setView('operations')} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    Abrir configuración operativa <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

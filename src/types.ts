export type WaStatus = 'unverified' | 'checking' | 'active' | 'inactive' | 'error';
export type WaMethod = 'manual' | 'simulation' | 'wassenger' | 'wasender';

export interface Contact {
  id: string;
  fullName: string;
  phone1: string;
  phone2: string;
  email: string;
  activities: string;
  pax: string;
  notes: string;
  waStatus1: WaStatus;
  waStatus2: WaStatus;
  isDuplicate: boolean;
}

export type SpreadsheetType = 'trf' | 'comp' | 'activities';

export interface CompRecord {
  id: string;
  titular: string;
  email: string;
  phone: string;
  notes: string;
  isDuplicate?: boolean;
}

export interface Mappings {
  mapName: number | "";
  mapPhone: number | "";
  mapEmail: number | "";
  mapHotel: number | "";
  mapPax: number | "";
  mapDate: number | "";
  mapActivities: number | "";
}

export interface GlobalConfig {
  defaultDate: string;
  defaultCountry: string;
  waMethod: WaMethod;
  waToken: string;
}

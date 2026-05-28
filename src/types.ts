export type WaStatus = 'unverified' | 'checking' | 'active' | 'inactive' | 'error';
export type WaMethod = 'manual' | 'simulation' | 'wassenger' | 'wasender';

export interface Contact {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  waStatus: WaStatus;
}

export interface Mappings {
  mapName: number | "";
  mapPhone: number | "";
  mapEmail: number | "";
  mapHotel: number | "";
  mapPax: number | "";
  mapDate: number | "";
}

export interface GlobalConfig {
  defaultDate: string;
  waMethod: WaMethod;
  waToken: string;
}

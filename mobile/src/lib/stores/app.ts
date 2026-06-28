import { create } from 'zustand';
import { api, unwrap } from '../api';
import type { Company, Service } from '../types';

interface AppState {
  company: Company | null;
  services: Service[];
  loadCompany: () => Promise<void>;
  loadServices: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

export const useApp = create<AppState>((set) => ({
  company: null,
  services: [],

  loadCompany: async () => {
    const company = await unwrap<Company>(api.get('/company'));
    set({ company });
  },

  loadServices: async () => {
    const services = await unwrap<Service[]>(api.get('/services'));
    set({ services: Array.isArray(services) ? services : [] });
  },

  refreshAll: async () => {
    const [company, services] = await Promise.all([
      unwrap<Company>(api.get('/company')),
      unwrap<Service[]>(api.get('/services')),
    ]);
    set({ company, services: Array.isArray(services) ? services : [] });
  },
}));

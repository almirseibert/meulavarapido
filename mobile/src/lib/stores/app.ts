import { create } from 'zustand';
import { api, unwrap } from '../api';
import type { Company, Service, Usage } from '../types';

interface AppState {
  company: Company | null;
  services: Service[];
  usage: Usage | null;
  loadCompany: () => Promise<void>;
  loadServices: () => Promise<void>;
  loadUsage: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

export const useApp = create<AppState>((set) => ({
  company: null,
  services: [],
  usage: null,

  loadCompany: async () => {
    const company = await unwrap<Company>(api.get('/company'));
    set({ company });
  },

  loadServices: async () => {
    const services = await unwrap<Service[]>(api.get('/services'));
    set({ services: Array.isArray(services) ? services : [] });
  },

  loadUsage: async () => {
    const usage = await unwrap<Usage>(api.get('/documents/usage'));
    set({ usage });
  },

  refreshAll: async () => {
    const [company, services, usage] = await Promise.all([
      unwrap<Company>(api.get('/company')),
      unwrap<Service[]>(api.get('/services')),
      unwrap<Usage>(api.get('/documents/usage')),
    ]);
    set({ company, services: Array.isArray(services) ? services : [], usage });
  },
}));

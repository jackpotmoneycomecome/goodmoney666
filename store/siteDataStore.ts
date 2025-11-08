import create from 'zustand';
import { apiCall } from '../api';
import type { SiteConfig, Category, LotterySet } from '../types';
import { mockSiteConfig } from '../data/mockData';

interface SiteDataState {
    siteConfig: SiteConfig;
    categories: Category[];
    lotterySets: LotterySet[];
    isLoading: boolean;
    fetchSiteData: () => Promise<void>;
    startPollingLotterySets: () => () => void; // Returns a function to stop polling
    // Admin actions
    addLotterySet: (set: LotterySet) => Promise<void>;
    updateLotterySet: (set: LotterySet) => Promise<void>;
    deleteLotterySet: (setId: string) => Promise<void>;
    updateSiteConfig: (config: SiteConfig) => Promise<void>;
    saveCategories: (categories: Category[]) => Promise<void>;
}

export const useSiteStore = create<SiteDataState>((set, get) => ({
    siteConfig: mockSiteConfig, // Start with mock/default
    categories: [],
    lotterySets: [],
    isLoading: true,

    fetchSiteData: async () => {
        if(!get().isLoading) set({ isLoading: true });
        try {
            const [siteConfig, categories, lotterySets] = await Promise.all([
                apiCall('/site-config'),
                apiCall('/categories'),
                apiCall('/lottery-sets')
            ]);
            set({ siteConfig, categories, lotterySets, isLoading: false });
        } catch (error) {
            console.error("Failed to fetch initial site data", error);
            set({ isLoading: false });
        }
    },

    fetchLotterySets: async () => {
        try {
            const lotterySets = await apiCall('/lottery-sets');
            set({ lotterySets });
        } catch (error) {
            console.error("Failed to poll lottery sets:", error);
        }
    },
    
    startPollingLotterySets: () => {
        const intervalId = setInterval(() => {
            get().fetchLotterySets();
        }, 30000); // Poll every 30 seconds

        return () => clearInterval(intervalId);
    },
    
    // Admin Actions
    addLotterySet: async (set) => {
        const newSet = await apiCall('/admin/lottery-sets', { method: 'POST', body: JSON.stringify(set) });
        set(state => ({ lotterySets: [...state.lotterySets, newSet] }));
    },
    updateLotterySet: async (set) => {
        const updatedSet = await apiCall(`/admin/lottery-sets/${set.id}`, { method: 'PUT', body: JSON.stringify(set) });
        set(state => ({
            lotterySets: state.lotterySets.map(s => s.id === updatedSet.id ? updatedSet : s)
        }));
    },
    deleteLotterySet: async (setId) => {
        await apiCall(`/admin/lottery-sets/${setId}`, { method: 'DELETE' });
        set(state => ({
            lotterySets: state.lotterySets.filter(s => s.id !== setId)
        }));
    },
    updateSiteConfig: async (config) => {
        const updatedConfig = await apiCall('/admin/site-config', { method: 'POST', body: JSON.stringify(config) });
        set({ siteConfig: updatedConfig });
    },
    saveCategories: async (categories) => {
        const updatedCategories = await apiCall('/admin/categories', { method: 'POST', body: JSON.stringify(categories) });
        set({ categories: updatedCategories });
    }
}));

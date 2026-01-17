import { create } from 'zustand';

interface ExternalData {
  id: string;
  source: string;
  value: string;
  trend: 'up' | 'down';
  timestamp: string;
}

interface DataState {
  externalData: ExternalData[];
  isLoading: boolean;
  fetchExternalData: () => Promise<void>;
}

export const useDataStore = create<DataState>((set) => ({
  externalData: [],
  isLoading: false,

  fetchExternalData: async () => {
    set({ isLoading: true });
    try {
      // Simulation of fetching external data (e.g. from a real API like CoinGecko or GitHub)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockData: ExternalData[] = [
        { id: '1', source: 'Global AI Sentiment', value: 'High (84%)', trend: 'up', timestamp: new Date().toISOString() },
        { id: '2', source: 'Market Volatility', value: 'Low (12%)', trend: 'down', timestamp: new Date().toISOString() },
        { id: '3', source: 'System Demand', value: 'Medium (45%)', trend: 'up', timestamp: new Date().toISOString() },
      ];
      
      set({ externalData: mockData, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch external data:', error);
      set({ isLoading: false });
    }
  },
}));

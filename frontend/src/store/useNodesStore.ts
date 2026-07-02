import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TrackedNode {
  id: string;
  server_id: number;
  host_id: string;
  host_name: string;
  added_at: number;
  selected_metrics: string[];
  chart_period: string; // <-- Добавили это поле
}

export type MetricFilter = 'all' | 'speed' | 'availability' | 'other';

interface NodesState {
  trackedNodes: TrackedNode[];
  activeFilters: MetricFilter[];
  searchQuery: string;
  expandedNodeId: string | null;
  
  setTrackedNodes: (nodes: TrackedNode[]) => void;
  addTrackedNode: (node: TrackedNode) => void;
  removeTrackedNode: (nodeId: string) => void;
  updateTrackedNode: (nodeId: string, updates: Partial<TrackedNode>) => void;
  
  setActiveFilters: (filters: MetricFilter[]) => void;
  setSearchQuery: (query: string) => void;
  setExpandedNodeId: (nodeId: string | null) => void;
}

export const useNodesStore = create<NodesState>()(
  persist(
    (set) => ({
      trackedNodes: [],
      activeFilters: ['all'],
      searchQuery: '',
      expandedNodeId: null,
      
      setTrackedNodes: (nodes) => set({ trackedNodes: nodes }),
      
      addTrackedNode: (node) =>
        set((state) => ({
          trackedNodes: [...state.trackedNodes, node]
        })),
      
      removeTrackedNode: (nodeId) =>
        set((state) => ({
          trackedNodes: state.trackedNodes.filter(n => n.id !== nodeId)
        })),
      
      updateTrackedNode: (nodeId, updates) =>
        set((state) => ({
          trackedNodes: state.trackedNodes.map(n =>
            n.id === nodeId ? { ...n, ...updates } : n
          )
        })),
      
      setActiveFilters: (filters) => set({ activeFilters: filters }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setExpandedNodeId: (nodeId) => set({ expandedNodeId: nodeId }),
    }),
    {
      name: 'nodes-storage',
    }
  )
);
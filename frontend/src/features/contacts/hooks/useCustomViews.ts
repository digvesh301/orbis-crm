import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

export interface CustomView {
    id: string;
    module: string;
    name: string;
    is_default: boolean;
    configuration: {
        columns?: any[];
        filters?: Record<string, any>;
        sort?: { field: string; direction: 'asc' | 'desc' } | null;
    };
    created_at?: string;
    updated_at?: string;
}

async function fetchViews(module: string): Promise<CustomView[]> {
    const res = await api.get(`/views?module=${module}`);
    return res.data;
}

async function createView(payload: Omit<CustomView, 'id' | 'created_at' | 'updated_at'>): Promise<CustomView> {
    const res = await api.post('/views', payload);
    return res.data;
}

async function updateView(id: string, payload: Partial<CustomView>): Promise<CustomView> {
    const res = await api.put(`/views/${id}`, payload);
    return res.data;
}

async function deleteView(id: string): Promise<void> {
    await api.delete(`/views/${id}`);
}

export function useCustomViews(module: string) {
    const queryClient = useQueryClient();
    const queryKey = ['custom-views', module];

    const { data: views = [], isLoading } = useQuery({
        queryKey,
        queryFn: () => fetchViews(module),
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    const createMutation = useMutation({
        mutationFn: createView,
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...payload }: Partial<CustomView> & { id: string }) => updateView(id, payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteView,
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });

    return {
        views,
        isLoading,
        createView: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
        updateView: updateMutation.mutateAsync,
        deleteView: deleteMutation.mutateAsync,
    };
}

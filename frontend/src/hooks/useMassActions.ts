import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface MassUpdatePayload {
    ids: string[];
    updates: Record<string, any>;
}

export function useMassActions(module: string) {
    const queryClient = useQueryClient();

    const massDeleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            // Ideally backend supports DELETE /<module>/mass with array of IDs
            // For now, if we don't have mass delete, we can iterate or send as payload
            return await api.post(`/${module}/mass-delete`, { ids });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [module] });
        }
    });

    const massUpdateMutation = useMutation({
        mutationFn: async (payload: MassUpdatePayload) => {
            return await api.put(`/${module}/mass-update`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [module] });
        }
    });

    const massTransferMutation = useMutation({
        mutationFn: async (payload: { ids: string[], new_owner_id: string }) => {
            return await api.put(`/${module}/mass-transfer`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [module] });
        }
    });

    return {
        massDelete: massDeleteMutation.mutateAsync,
        isDeleting: massDeleteMutation.isPending,
        massUpdate: massUpdateMutation.mutateAsync,
        isUpdating: massUpdateMutation.isPending,
        massTransfer: massTransferMutation.mutateAsync,
        isTransferring: massTransferMutation.isPending,
    };
}

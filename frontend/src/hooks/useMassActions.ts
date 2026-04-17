import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface MassTransferPayload {
    ids:          string[];
    new_owner_id: string;
}

interface MassUpdatePayload {
    ids:     string[];
    updates: Record<string, any>;
}

/**
 * useMassActions — provides mass-delete, mass-update, and mass-transfer
 * mutations for any CRM module. All hits the backend with org-scoped endpoints.
 *
 * Usage:
 *   const { massDelete, isDeleting } = useMassActions('contacts');
 *   await massDelete(['uuid1', 'uuid2']);
 */
export function useMassActions(module: string) {
    const queryClient = useQueryClient();

    const invalidate = () => queryClient.invalidateQueries({ queryKey: [module] });

    // ─── Mass Delete: POST /contacts/mass-delete ──────────────────────
    const massDeleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const res = await api.post(`/${module}/mass-delete`, { ids });
            return res.data;
        },
        onSuccess: invalidate,
    });

    // ─── Mass Update: PUT /contacts/mass-update ───────────────────────
    const massUpdateMutation = useMutation({
        mutationFn: async (payload: MassUpdatePayload) => {
            const res = await api.put(`/${module}/mass-update`, payload);
            return res.data;
        },
        onSuccess: invalidate,
    });

    // ─── Mass Transfer: PUT /contacts/mass-transfer ───────────────────
    const massTransferMutation = useMutation({
        mutationFn: async (payload: MassTransferPayload) => {
            const res = await api.put(`/${module}/mass-transfer`, payload);
            return res.data;
        },
        onSuccess: invalidate,
    });

    return {
        massDelete:     massDeleteMutation.mutateAsync,
        isDeleting:     massDeleteMutation.isPending,
        massUpdate:     massUpdateMutation.mutateAsync,
        isUpdating:     massUpdateMutation.isPending,
        massTransfer:   massTransferMutation.mutateAsync,
        isTransferring: massTransferMutation.isPending,
    };
}

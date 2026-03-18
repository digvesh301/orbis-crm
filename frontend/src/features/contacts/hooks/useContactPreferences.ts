import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserPreferences, saveUserPreferences, ViewPreferences } from '../api/preferences.api';

export function useContactPreferences() {
    const queryClient = useQueryClient();
    const [localPrefs, setLocalPrefs] = useState<ViewPreferences | null>(null);

    // 1. Fetch preferences from server (or local storage mock)
    const { data: serverPrefs, isLoading } = useQuery({
        queryKey: ['contact-preferences'],
        queryFn: fetchUserPreferences,
    });

    // 2. Sync server data to local snappy state
    useEffect(() => {
        if (serverPrefs) {
            setLocalPrefs(serverPrefs);
        }
    }, [serverPrefs]);

    // 3. Mutation to save updates silently in the background
    const mutation = useMutation({
        mutationFn: saveUserPreferences,
        onMutate: async (newPrefs) => {
            // Optimistic Update
            await queryClient.cancelQueries({ queryKey: ['contact-preferences'] });
            queryClient.setQueryData(['contact-preferences'], newPrefs);
        }
    });

    const updatePreferences = (updates: Partial<ViewPreferences>) => {
        if (!localPrefs) return;
        const nextPrefs = { ...localPrefs, ...updates };
        setLocalPrefs(nextPrefs);       // Instant UI update
        mutation.mutate(nextPrefs);     // Background network sync
    };

    return { preferences: localPrefs, updatePreferences, isLoading };
}

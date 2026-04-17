import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';

interface UseContactsParams {
    page:    number;
    limit:   number;
    search?: string;
    filters: Record<string, any>;
    sort:    { field: string; direction: 'asc' | 'desc' } | null;
}

export function useContacts({ page, limit, search, filters, sort }: UseContactsParams) {
    return useQuery({
        queryKey: ['contacts', page, limit, search, filters, sort],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page',  page.toString());
            params.append('limit', limit.toString());

            if (search && search.trim()) {
                params.append('search', search.trim());
            }

            if (sort?.field) {
                params.append('sort',  sort.field);
                params.append('order', sort.direction);
            }

            if (filters && Object.keys(filters).length > 0) {
                // Convert date-only strings to ISO format for the backend
                const processed: Record<string, any> = {};
                for (const [k, v] of Object.entries(filters)) {
                    if (!v && v !== 0) continue;
                    // If looks like a date (YYYY-MM-DD), convert to ISO
                    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
                        if (k === 'created_before') {
                            // End of day
                            processed[k] = `${v}T23:59:59Z`;
                        } else {
                            processed[k] = `${v}T00:00:00Z`;
                        }
                    } else {
                        processed[k] = v;
                    }
                }
                params.append('filters', JSON.stringify(processed));
            }

            const res = await api.get(`/contacts?${params.toString()}`);

            return {
                items:      res.data.data || [],
                totalCount: res.data.meta?.total || 0,
                hasNext:    res.data.meta?.has_next || false,
                hasPrev:    res.data.meta?.has_prev || false,
            };
        },
        placeholderData: (prev) => prev, // keep stale data while re-fetching
    });
}

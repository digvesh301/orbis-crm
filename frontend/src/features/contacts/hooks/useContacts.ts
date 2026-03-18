import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';

export function useContacts({ page, limit, filters, sort }: any) {
    return useQuery({
        queryKey: ['contacts', page, limit, filters, sort],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (page) params.append('page', page.toString());
            if (limit) params.append('limit', limit.toString());
            
            if (sort && sort.field) {
                params.append('sort', sort.field);
                params.append('order', sort.direction);
            }
            
            if (filters && Object.keys(filters).length > 0) {
                // We send filters as a JSON string to a generic `filters` backend query param
                params.append('filters', JSON.stringify(filters));
            }

            const res = await api.get(`/contacts?${params.toString()}`);
            
            return {
                items: res.data.data || [],
                totalCount: res.data.meta?.total || 0,
                hasNext: res.data.meta?.has_next || false,
            };
        }
    });
}

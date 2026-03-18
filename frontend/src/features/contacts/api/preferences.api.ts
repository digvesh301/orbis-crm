export interface ColumnPreference {
    id: string;
    isVisible: boolean;
    order: number;
    label: string;
}

export interface ViewPreferences {
    columns: ColumnPreference[];
    filters: Record<string, any>;
    sort: { field: string; direction: 'asc' | 'desc' } | null;
}

const DEFAULT_PREFS: ViewPreferences = {
    columns: [
        { id: 'name', isVisible: true, order: 0, label: 'Name' },
        { id: 'title', isVisible: true, order: 1, label: 'Job Title' },
        { id: 'phone', isVisible: true, order: 2, label: 'Phone' },
        { id: 'city', isVisible: true, order: 3, label: 'City' },
        { id: 'owner', isVisible: true, order: 4, label: 'Owner' }
    ],
    filters: {},
    sort: { field: 'created_at', direction: 'desc' }
};

// Mocking the interaction API that saves the view state per-user
// We use localStorage here so it persists without needing a real backend route for this demo
export const fetchUserPreferences = async (): Promise<ViewPreferences> => {
    const raw = localStorage.getItem('contacts_preferences');
    if (raw) {
        return JSON.parse(raw);
    }
    return DEFAULT_PREFS;
};

export const saveUserPreferences = async (prefs: ViewPreferences): Promise<void> => {
    localStorage.setItem('contacts_preferences', JSON.stringify(prefs));
};

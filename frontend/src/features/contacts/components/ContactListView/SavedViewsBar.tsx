import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, MoreHorizontal, Check, Trash2, X, Save } from 'lucide-react';
import { CustomView, useCustomViews } from '../../hooks/useCustomViews';
import { useAuthStore } from '../../../../store/auth.store';

interface SavedViewsBarProps {
    module: string;
    activeViewId: string | null;
    currentConfiguration: {
        columns?: any[];
        filters?: Record<string, any>;
        sort?: { field: string; direction: 'asc' | 'desc' } | null;
    };
    onViewSelect: (view: CustomView | null) => void;
}

const DEFAULT_VIEWS_TEMPLATE = [
    { id: '__all__', name: 'All Contacts', is_default: true, configBuilder: () => ({ filters: {}, sort: null }) },
    { id: '__mine__', name: 'My Contacts', is_default: false, configBuilder: (userId: string) => ({ filters: { owner_id: userId }, sort: null }) },
    { id: '__week__', name: 'New this week', is_default: false, configBuilder: () => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return { filters: { created_after: d.toISOString() }, sort: null };
    }},
];

export default function SavedViewsBar({ module, activeViewId, currentConfiguration, onViewSelect }: SavedViewsBarProps) {
    const { views, createView, deleteView, updateView, isCreating } = useCustomViews(module);
    const [isCreatingView, setIsCreatingView] = useState(false);
    const [newViewName, setNewViewName] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSaveView = async () => {
        if (!newViewName.trim()) return;
        try {
            const newView = await createView({
                module,
                name: newViewName.trim(),
                is_default: false,
                configuration: currentConfiguration,
            });
            setNewViewName('');
            setIsCreatingView(false);
            if (newView) {
                onViewSelect(newView);
            }
        } catch (error) {
            console.error("Failed to create view:", error);
        }
    };

    const handleUpdateView = async (id: string) => {
        await updateView({ id, configuration: currentConfiguration });
        setOpenMenuId(null);
    };

    const handleDeleteView = async (id: string) => {
        await deleteView(id);
        if (activeViewId === id) onViewSelect(null);
        setOpenMenuId(null);
    };

    const user = useAuthStore(state => state.user);

    const allViewItems = useMemo(() => {
        const defaults = DEFAULT_VIEWS_TEMPLATE.map(v => ({ 
            id: v.id, 
            name: v.name, 
            is_default: v.is_default, 
            configuration: v.configBuilder(user?.id || '') 
        }));
        return [...defaults, ...views];
    }, [views, user]);

    return (
        <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-8 overflow-x-auto shrink-0">
            {allViewItems.map((view) => {
                const isActive = activeViewId === view.id;
                const isCustom = !DEFAULT_VIEWS_TEMPLATE.find(d => d.id === view.id);
                return (
                    <div key={view.id} className="relative flex items-center group shrink-0">
                        <button
                            onClick={() => onViewSelect(view as CustomView)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                isActive
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                            }`}
                        >
                            {view.name}
                        </button>

                        {/* Kebab menu for custom views */}
                        {isCustom && (
                            <div ref={menuRef}>
                                <button
                                    className="opacity-0 group-hover:opacity-100 ml-0.5 p-1 rounded hover:bg-slate-100 text-slate-400 transition-all"
                                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === view.id ? null : view.id); }}
                                >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                </button>

                                {openMenuId === view.id && (
                                    <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-lg shadow-xl border border-slate-100 py-1.5 z-50">
                                        <button
                                            onClick={() => handleUpdateView(view.id)}
                                            className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"
                                        >
                                            <Save className="w-3.5 h-3.5 text-slate-400" /> Save current filters
                                        </button>
                                        <div className="h-px bg-slate-100 my-1" />
                                        <button
                                            onClick={() => handleDeleteView(view.id)}
                                            className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Delete view
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Add New View */}
            <div className="ml-2 flex items-center shrink-0">
                {isCreatingView ? (
                    <div className="flex items-center gap-1.5 py-1.5">
                        <input
                            type="text"
                            autoFocus
                            value={newViewName}
                            onChange={(e) => setNewViewName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveView(); if (e.key === 'Escape') setIsCreatingView(false); }}
                            className="text-sm border border-indigo-300 rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
                            placeholder="View name..."
                        />
                        <button
                            onClick={handleSaveView}
                            disabled={isCreating || !newViewName.trim()}
                            className="p-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => { setIsCreatingView(false); setNewViewName(''); }}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsCreatingView(true)}
                        className="flex items-center gap-1 text-sm text-slate-400 hover:text-indigo-600 px-2 py-3 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Save view
                    </button>
                )}
            </div>
        </div>
    );
}

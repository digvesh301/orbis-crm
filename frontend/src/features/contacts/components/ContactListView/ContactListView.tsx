import { useState } from 'react';
import { useContacts } from '../../hooks/useContacts';
import { useContactPreferences } from '../../hooks/useContactPreferences';
import { usePermissions } from '../../../../hooks/usePermissions';
import DataTable from './DataTable';
import FilterSidebar from './FilterSidebar';
import ColumnManager from './ColumnManager';
import ContactModal from '../../../../pages/contacts/ContactModal';
import { exportToCsv } from '../../../../lib/exportUtils';
import { Loader2, Settings2, Filter, Plus, Download, Users, ChevronDown, Trash2, Send, Merge } from 'lucide-react';
import SavedViewsBar from './SavedViewsBar';
import { CustomView } from '../../hooks/useCustomViews';

export default function ContactListView() {
    const { preferences, updatePreferences, isLoading: loadingPrefs } = useContactPreferences();
    const { canCreate, canExport } = usePermissions();
    
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isColManagerOpen, setIsColManagerOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isActionsOpen, setIsActionsOpen] = useState(false);
    const [activeViewId, setActiveViewId] = useState<string | null>('__all__');

    const handleViewSelect = (view: CustomView | null) => {
        setActiveViewId(view?.id ?? null);
        // If it's a custom saved view, apply its configuration
        if (view && view.configuration) {
            if (view.configuration.filters) updatePreferences({ filters: view.configuration.filters });
            if (view.configuration.sort !== undefined) updatePreferences({ sort: view.configuration.sort ?? null });
        }
    };

    // Core Data Fetch using persistent queries
    const { data: contactsData, isLoading: loadingContacts } = useContacts({
        page,
        limit: 50,
        filters: preferences?.filters || {},
        sort: preferences?.sort || null,
    });

    if (loadingPrefs || !preferences) {
        return <div className="h-full flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Saved Views Tab Bar */}
            <SavedViewsBar
                module="contacts"
                activeViewId={activeViewId}
                currentConfiguration={{ filters: preferences.filters, sort: preferences.sort }}
                onViewSelect={handleViewSelect}
            />

            <div className="flex flex-col flex-1 p-8 space-y-6 overflow-auto">
            
            {/* Header Options */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contacts Archive</h1>
                    <p className="text-slate-500 mt-1">Manage standard lists, segments, and external prospects.</p>
                </div>
                
                <div className="flex gap-3">
                    {/* View Options */}
                    <button 
                        onClick={() => setIsFilterOpen(true)} 
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer flex items-center gap-2"
                    >
                        <Filter className="w-4 h-4" /> Filters {Object.keys(preferences.filters).length > 0 && <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold">{Object.keys(preferences.filters).length}</span>}
                    </button>
                    
                    <button 
                        onClick={() => setIsColManagerOpen(true)} 
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer flex items-center gap-2"
                    >
                        <Settings2 className="w-4 h-4" /> Columns
                    </button>

                    {/* RBAC Protected Actions */}
                    {canExport && (
                        <button 
                            onClick={() => exportToCsv('/contacts', 'contacts_archive')}
                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                    )}

                    {canCreate && (
                        <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer flex items-center gap-2 border border-transparent"
                        >
                            <Plus className="w-4 h-4" /> New Contact
                        </button>
                    )}

                    {/* Mass Actions Dropdown */}
                    <div className="relative">
                        <button 
                            onClick={() => setIsActionsOpen(!isActionsOpen)}
                            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer flex items-center gap-2"
                        >
                            Actions <ChevronDown className="w-4 h-4" />
                            {selectedIds.length > 0 && (
                                <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-1">
                                    {selectedIds.length}
                                </span>
                            )}
                        </button>

                        {isActionsOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-2 z-50">
                                <button className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2 disabled:opacity-50" disabled={selectedIds.length === 0}>
                                    <Send className="w-4 h-4 text-slate-400" /> Mass Transfer
                                </button>
                                <button className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2 disabled:opacity-50" disabled={selectedIds.length < 2}>
                                    <Merge className="w-4 h-4 text-slate-400" /> Merge
                                </button>
                                <div className="h-px bg-slate-100 my-1"></div>
                                <button className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2 disabled:opacity-50" disabled={selectedIds.length === 0}>
                                    <Trash2 className="w-4 h-4 opacity-70" /> Mass Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Data Table Core */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 overflow-auto">
                {loadingContacts ? (
                    <div className="p-24 flex flex-col items-center justify-center text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-4" />
                        Loading dataset...
                    </div>
                ) : contactsData?.items.length === 0 ? (
                    <div className="text-center py-24 text-slate-500">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        No contacts match the current filters.
                    </div>
                ) : (
                    <DataTable 
                        data={contactsData?.items || []} 
                        columns={preferences.columns} 
                        sortState={preferences.sort}
                        onSortChange={(sort) => updatePreferences({ sort })}
                        onRowSelectionChange={setSelectedIds}
                    />
                )}
            </div>
            
            {/* Pagination implementation */}
            <div className="flex justify-between items-center shrink-0">
                <span className="text-sm font-semibold text-slate-500">
                    Showing {contactsData?.items.length || 0} of {contactsData?.totalCount || 0}
                </span>
                <div className="flex gap-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="bg-white border border-slate-200 disabled:opacity-50 text-slate-700 px-3 py-1.5 rounded-lg font-medium shadow-sm transition-colors text-sm">Prev</button>
                    <button disabled={!contactsData?.hasNext} onClick={() => setPage(p => p + 1)} className="bg-white border border-slate-200 disabled:opacity-50 text-slate-700 px-3 py-1.5 rounded-lg font-medium shadow-sm transition-colors text-sm">Next</button>
                </div>
            </div>

            {/* FLYOUTS & MODALS */}
            {isFilterOpen && (
                <FilterSidebar 
                    activeFilters={preferences.filters} 
                    onApply={(filters) => { updatePreferences({ filters }); setPage(1); }} 
                    onClose={() => setIsFilterOpen(false)} 
                />
            )}

            {isColManagerOpen && (
                <ColumnManager 
                    columns={preferences.columns} 
                    onChange={(columns) => updatePreferences({ columns })}
                    onClose={() => setIsColManagerOpen(false)}
                />
            )}

            <ContactModal 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)} 
            />
            </div>
        </div>
    );
}

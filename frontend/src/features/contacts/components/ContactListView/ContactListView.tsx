import { useState, useRef, useEffect } from 'react';
import { useContacts } from '../../hooks/useContacts';
import { useContactPreferences } from '../../hooks/useContactPreferences';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useMassActions } from '../../../../hooks/useMassActions';
import DataTable from './DataTable';
import FilterSidebar from './FilterSidebar';
import ColumnManager from './ColumnManager';
import ContactModal from '../../../../pages/contacts/ContactModal';
import { exportToCsv } from '../../../../lib/exportUtils';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import {
    Loader2, Settings2, Plus, Download,
    Users, ChevronDown, Trash2, Send, Search, X,
    AlertTriangle, UserCheck, SlidersHorizontal
} from 'lucide-react';
import SavedViewsBar from './SavedViewsBar';
import { CustomView } from '../../hooks/useCustomViews';
import { toast } from 'sonner';

// ─── Mass Transfer Modal ──────────────────────────────────────────────────────
interface TransferModalProps {
    count: number;
    onConfirm: (newOwnerId: string) => void;
    onClose: () => void;
    isLoading: boolean;
}

function TransferModal({ count, onConfirm, onClose, isLoading }: TransferModalProps) {
    const [selectedUser, setSelectedUser] = useState('');

    const { data: usersRes } = useQuery({
        queryKey: ['org-users-list'],
        queryFn: async () => {
            const res = await api.get('/admin/users');
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const users: any[] = usersRes?.data || [];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Transfer Contacts</h2>
                            <p className="text-sm text-slate-500">
                                Re-assign <strong>{count}</strong> contact{count !== 1 ? 's' : ''} to a new owner
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Transfer to
                        </label>
                        <select
                            value={selectedUser}
                            onChange={e => setSelectedUser(e.target.value)}
                            className="w-full border border-slate-200 bg-slate-50 text-slate-800 text-sm rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                        >
                            <option value="">— Select a team member —</option>
                            {users.map((u: any) => (
                                <option key={u.id} value={u.id}>
                                    {u.first_name} {u.last_name} ({u.email})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-semibold rounded-xl py-2.5 text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={!selectedUser || isLoading}
                        onClick={() => onConfirm(selectedUser)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold rounded-xl py-2.5 text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                        {isLoading ? 'Transferring...' : 'Transfer Now'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
interface DeleteModalProps {
    count: number;
    onConfirm: () => void;
    onClose: () => void;
    isLoading: boolean;
}

function DeleteConfirmModal({ count, onConfirm, onClose, isLoading }: DeleteModalProps) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Delete Contacts</h2>
                            <p className="text-sm text-slate-500">This action cannot be undone</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-600 bg-red-50 border border-red-100 rounded-xl p-3 mt-2">
                        You are about to permanently delete{' '}
                        <strong className="text-red-700">{count} contact{count !== 1 ? 's' : ''}</strong>.
                        All associated data (notes, activities) will be unlinked.
                    </p>
                </div>

                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-semibold rounded-xl py-2.5 text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white font-bold rounded-xl py-2.5 text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        {isLoading ? 'Deleting...' : `Delete ${count}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main List View ───────────────────────────────────────────────────────────
export default function ContactListView() {
    const { preferences, updatePreferences, isLoading: loadingPrefs } = useContactPreferences();
    const { canCreate, canExport } = usePermissions();
    const { massDelete, isDeleting, massTransfer, isTransferring } = useMassActions('contacts');

    const [isFilterOpen, setIsFilterOpen]     = useState(false);
    const [isColManagerOpen, setIsColManagerOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isActionsOpen, setIsActionsOpen]   = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [page, setPage]                     = useState(1);
    const [selectedIds, setSelectedIds]       = useState<string[]>([]);
    const [activeViewId, setActiveViewId]     = useState<string | null>('__all__');
    const [searchQuery, setSearchQuery]       = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const actionsRef = useRef<HTMLDivElement>(null);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Close actions dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
                setIsActionsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleViewSelect = (view: CustomView | null) => {
        setActiveViewId(view?.id ?? null);
        if (view && view.configuration) {
            if (view.configuration.filters) updatePreferences({ filters: view.configuration.filters });
            if (view.configuration.sort !== undefined) updatePreferences({ sort: view.configuration.sort ?? null });
        }
    };

    // Core Data Fetch
    const { data: contactsData, isLoading: loadingContacts } = useContacts({
        page,
        limit: 50,
        search: debouncedSearch || undefined,
        filters: preferences?.filters || {},
        sort: preferences?.sort || null,
    });

    // ─── Bulk Handlers ────────────────────────────────────────────────────────

    const handleMassDelete = async () => {
        try {
            await massDelete(selectedIds);
            toast.success(`${selectedIds.length} contact(s) deleted successfully`);
            setSelectedIds([]);
            setIsDeleteModalOpen(false);
        } catch (err: any) {
            toast.error(err?.response?.data?.error?.message || 'Delete failed');
        }
    };

    const handleMassTransfer = async (newOwnerId: string) => {
        try {
            await massTransfer({ ids: selectedIds, new_owner_id: newOwnerId });
            toast.success(`${selectedIds.length} contact(s) transferred successfully`);
            setSelectedIds([]);
            setIsTransferModalOpen(false);
        } catch (err: any) {
            toast.error(err?.response?.data?.error?.message || 'Transfer failed');
        }
    };

    // ─── Filter badge count ───────────────────────────────────────────────────
    const activeFilterCount = preferences ? Object.keys(preferences.filters).filter(
        k => preferences.filters[k] !== '' && preferences.filters[k] !== null && preferences.filters[k] !== undefined
    ).length : 0;

    if (loadingPrefs || !preferences) {
        return (
            <div className="h-full flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <>
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Saved Views Tab Bar */}
            <SavedViewsBar
                module="contacts"
                activeViewId={activeViewId}
                currentConfiguration={{ filters: preferences.filters, sort: preferences.sort }}
                onViewSelect={handleViewSelect}
            />

            <div className="flex flex-col flex-1 p-6 min-h-0">
                {/* ── Page Header ────────────────────────────────────────────── */}
                <div className="flex justify-between items-end mb-5 shrink-0 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contacts</h1>
                        <p className="text-slate-500 mt-1 text-sm font-medium">
                            {loadingContacts ? 'Loading contacts...' : (
                                <>
                                    {contactsData?.totalCount?.toLocaleString() || 0} total records
                                    {selectedIds.length > 0 && (
                                        <span className="ml-2 text-indigo-600 font-semibold">
                                            · {selectedIds.length} selected
                                        </span>
                                    )}
                                </>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {canExport && (
                            <button
                                onClick={() => exportToCsv('/contacts', 'contacts_export')}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold shadow-sm transition-colors flex items-center gap-2 text-sm"
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                        )}
                        {canCreate && (
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition-colors flex items-center gap-2 text-sm border border-transparent"
                            >
                                <Plus className="w-4.5 h-4.5" />
                                New Contact
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Main Data Card ────────────────────────────────────── */}
                <div className="flex flex-col flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-0">
                    
                    {/* Toolbar */}
                    <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-white shrink-0 gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            {/* Search Input */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search contacts..."
                                    className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg pl-9 pr-8 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white w-64 transition-all"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Filter */}
                            <button
                                onClick={() => setIsFilterOpen(true)}
                                className={`border text-sm px-3 py-2 rounded-lg font-semibold shadow-sm transition-all flex items-center gap-2 ${
                                    activeFilterCount > 0
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                                <SlidersHorizontal className="w-4 h-4" />
                                Filters
                                {activeFilterCount > 0 && (
                                    <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </button>

                            {/* Columns */}
                            <button
                                onClick={() => setIsColManagerOpen(true)}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-semibold shadow-sm transition-colors flex items-center gap-2 text-sm"
                            >
                                <Settings2 className="w-4 h-4 text-slate-500" />
                                <span className="hidden sm:inline">Columns</span>
                            </button>

                            <div className="w-px h-6 bg-slate-200 mx-1"></div>

                            {/* ── Bulk Actions ──────────────────────────────── */}
                            <div className="relative" ref={actionsRef}>
                                <button
                                    onClick={() => setIsActionsOpen(v => !v)}
                                    className={`border text-sm px-3 py-2 rounded-lg font-semibold shadow-sm transition-all flex items-center gap-2 ${
                                        selectedIds.length > 0
                                            ? 'bg-slate-800 text-white border-slate-800 hover:bg-slate-900'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    Actions
                                    {selectedIds.length > 0 && (
                                        <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none">
                                            {selectedIds.length}
                                        </span>
                                    )}
                                    <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                                </button>

                                {isActionsOpen && (
                                    <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50">
                                        {selectedIds.length === 0 && (
                                            <p className="px-4 py-2 text-xs text-slate-400 italic">
                                                Select contacts first
                                            </p>
                                        )}

                                        <button
                                            className="w-full text-left px-4 py-2 hover:bg-blue-50 text-slate-700 text-sm flex items-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            disabled={selectedIds.length === 0}
                                            onClick={() => { setIsActionsOpen(false); setIsTransferModalOpen(true); }}
                                        >
                                            <Send className="w-4 h-4 text-blue-500" />
                                            <span className="font-medium">Mass Transfer</span>
                                        </button>

                                        <div className="h-px bg-slate-100 my-1.5" />

                                        <button
                                            className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            disabled={selectedIds.length === 0}
                                            onClick={() => { setIsActionsOpen(false); setIsDeleteModalOpen(true); }}
                                        >
                                            <Trash2 className="w-4 h-4 opacity-80" />
                                            <span className="font-medium">Mass Delete</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Active Filters / Selection Banner */}
                    {(selectedIds.length > 0 || activeFilterCount > 0) && (
                        <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex flex-col gap-2 shrink-0">
                            {/* ── Selection Banner ──────────────────────────────────── */}
                            {selectedIds.length > 0 && (
                                <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200/50 rounded-lg px-3 py-2 animate-in fade-in duration-200">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                    <span className="text-sm font-semibold text-indigo-700">
                                        {selectedIds.length} contact{selectedIds.length !== 1 ? 's' : ''} selected
                                    </span>
                                    <div className="flex gap-2 ml-auto">
                                        <button
                                            onClick={() => { setIsTransferModalOpen(true); }}
                                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5"
                                        >
                                            <Send className="w-3 h-3" /> Transfer
                                        </button>
                                        <button
                                            onClick={() => setIsDeleteModalOpen(true)}
                                            className="text-xs bg-white text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5"
                                        >
                                            <Trash2 className="w-3 h-3" /> Delete
                                        </button>
                                        <button
                                            onClick={() => setSelectedIds([])}
                                            className="text-xs bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-md font-semibold transition-colors"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── Active Filter Pills ───────────────────────────────── */}
                            {activeFilterCount > 0 && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Filters:</span>
                                    {Object.entries(preferences.filters).map(([key, val]) => {
                                        if (!val) return null;
                                        return (
                                            <span
                                                key={key}
                                                className="inline-flex items-center gap-1.5 bg-white text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-md border border-slate-200 shadow-sm"
                                            >
                                                <span className="capitalize text-slate-500">{key.replace(/_/g, ' ')}:</span>
                                                <span>{String(val)}</span>
                                                <button
                                                    onClick={() => {
                                                        const next = { ...preferences.filters };
                                                        delete next[key];
                                                        updatePreferences({ filters: next });
                                                        setPage(1);
                                                    }}
                                                    className="hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition-colors ml-0.5"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        );
                                    })}
                                    <button
                                        onClick={() => { updatePreferences({ filters: {} }); setPage(1); }}
                                        className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 transition-colors font-medium ml-1"
                                    >
                                        Clear all
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Data Table Area ───────────────────────────────────────── */}
                    <div className="flex-1 bg-white relative">
                        {loadingContacts ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-white/50 backdrop-blur-sm z-20">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                                <p className="text-sm font-medium text-slate-600">Loading contacts...</p>
                            </div>
                        ) : contactsData?.items.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-white z-10">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100 shadow-sm">
                                    <Users className="w-8 h-8 text-slate-400" />
                                </div>
                                <h3 className="text-slate-900 font-bold mb-1">No contacts found</h3>
                                <p className="text-sm text-slate-500 max-w-sm text-center mb-5">
                                    {debouncedSearch || activeFilterCount > 0
                                        ? 'We couldn\'t find any contacts matching your search criteria. Try adjusting your filters.'
                                        : 'You haven\'t added any contacts yet. Create your first contact to get started.'}
                                </p>
                                {(debouncedSearch || activeFilterCount > 0) ? (
                                    <button
                                        onClick={() => { setSearchQuery(''); updatePreferences({ filters: {} }); }}
                                        className="text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 font-semibold px-4 py-2 rounded-lg transition-colors"
                                    >
                                        Clear search & filters
                                    </button>
                                ) : (
                                    canCreate && (
                                        <button
                                            onClick={() => setIsCreateModalOpen(true)}
                                            className="text-sm bg-indigo-600 text-white hover:bg-indigo-700 font-bold px-5 py-2.5 rounded-lg transition-colors shadow-sm flex items-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" /> Add your first contact
                                        </button>
                                    )
                                )}
                            </div>
                        ) : (
                            <div className="absolute inset-0 overflow-hidden">
                                <DataTable
                                    data={contactsData?.items || []}
                                    columns={preferences.columns}
                                    sortState={preferences.sort}
                                    onSortChange={sort => updatePreferences({ sort })}
                                    onRowSelectionChange={setSelectedIds}
                                />
                            </div>
                        )}
                    </div>

                    {/* ── Pagination Footer ──────────────────────────────────────── */}
                    <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                        <div className="text-sm font-medium text-slate-600">
                            Showing <strong className="text-slate-900">{contactsData?.items.length || 0}</strong> of <strong className="text-slate-900">{contactsData?.totalCount?.toLocaleString() || 0}</strong> contacts
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 bg-slate-200/50 px-2 py-1 rounded-md mr-1">
                                Page {page}
                            </span>
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="bg-white border border-slate-200 disabled:opacity-50 text-slate-700 px-3 py-1.5 rounded-md font-semibold shadow-sm transition-colors text-sm hover:bg-slate-50 disabled:hover:bg-white flex items-center gap-1"
                            >
                                <span>←</span> Prev
                            </button>
                            <button
                                disabled={!contactsData?.hasNext}
                                onClick={() => setPage(p => p + 1)}
                                className="bg-white border border-slate-200 disabled:opacity-50 text-slate-700 px-3 py-1.5 rounded-md font-semibold shadow-sm transition-colors text-sm hover:bg-slate-50 disabled:hover:bg-white flex items-center gap-1"
                            >
                                Next <span>→</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* ── FLYOUTS & MODALS ─────────────────────────────────────────── */}
        {isFilterOpen && (
            <FilterSidebar
                activeFilters={preferences.filters}
                onApply={filters => { updatePreferences({ filters }); setPage(1); }}
                onClose={() => setIsFilterOpen(false)}
            />
        )}

        {isColManagerOpen && (
            <ColumnManager
                columns={preferences.columns}
                onChange={columns => updatePreferences({ columns })}
                onClose={() => setIsColManagerOpen(false)}
            />
        )}

        <ContactModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
        />

        {isDeleteModalOpen && (
            <DeleteConfirmModal
                count={selectedIds.length}
                isLoading={isDeleting}
                onConfirm={handleMassDelete}
                onClose={() => setIsDeleteModalOpen(false)}
            />
        )}

        {isTransferModalOpen && (
            <TransferModal
                count={selectedIds.length}
                isLoading={isTransferring}
                onConfirm={handleMassTransfer}
                onClose={() => setIsTransferModalOpen(false)}
            />
        )}
        </>
    );
}

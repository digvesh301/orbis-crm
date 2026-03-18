import { useState, useEffect } from 'react';
import { X, Shield, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile?: any; // If provided, we're editing
}

const MODULES = [
    { id: 'contacts', label: 'Contacts' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'leads', label: 'Leads' },
    { id: 'deals', label: 'Deals' },
    { id: 'products', label: 'Products' },
    { id: 'quotes', label: 'Quotes' },
    { id: 'settings', label: 'Admin/Settings' }
];

const ACTIONS = ['read', 'write', 'delete'];

export default function ProfileModal({ isOpen, onClose, profile }: ProfileModalProps) {
    const queryClient = useQueryClient();
    
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [permissions, setPermissions] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (isOpen) {
            if (profile) {
                setName(profile.name || '');
                setDescription(profile.description || '');
                setPermissions(profile.permissions || {});
            } else {
                setName('');
                setDescription('');
                setPermissions({});
            }
        }
    }, [isOpen, profile]);

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            if (profile?.id) {
                return api.patch(`/admin/profiles/${profile.id}`, data);
            } else {
                return api.post('/admin/profiles', data);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
            onClose();
        }
    });

    const togglePermission = (moduleId: string, action: string) => {
        setPermissions(prev => {
            const currentModPerms = prev[moduleId] || [];
            const newModPerms = currentModPerms.includes(action)
                ? currentModPerms.filter(a => a !== action)
                : [...currentModPerms, action];
            
            const next = { ...prev, [moduleId]: newModPerms };
            if (next[moduleId].length === 0) {
                delete next[moduleId];
            }
            return next;
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                {profile ? 'Edit Security Profile' : 'Create Custom Profile'}
                            </h2>
                            <p className="text-sm font-medium text-slate-500">
                                Configure role-based access control policies.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
                    {profile?.is_system && (
                        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-sm font-medium border border-amber-200">
                            This is a system profile. You cannot edit its permissions directly.
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Profile Name</label>
                            <input 
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                disabled={profile?.is_system}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 font-medium disabled:opacity-50"
                                placeholder="e.g. Sales Manager"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                            <textarea 
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                disabled={profile?.is_system}
                                rows={2}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 font-medium disabled:opacity-50 placeholder:-slate-400"
                                placeholder="Briefly describe the purpose of this profile"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="mb-4">
                            <h3 className="text-sm font-bold text-slate-900">Module Permissions</h3>
                            <p className="text-xs font-medium text-slate-500">Select which actions this profile can perform across CRM modules.</p>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-left bg-white">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Module</th>
                                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Read</th>
                                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Write</th>
                                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Delete</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {MODULES.map(mod => {
                                        const modPerms = permissions[mod.id] || [];
                                        const isSystem = profile?.is_system;

                                        return (
                                            <tr key={mod.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3 px-4 font-bold text-slate-700 text-sm">
                                                    {mod.label}
                                                </td>
                                                {ACTIONS.map(action => {
                                                    const isChecked = modPerms.includes(action);
                                                    return (
                                                        <td key={action} className="py-3 px-4 text-center">
                                                            <button
                                                                type="button"
                                                                disabled={isSystem}
                                                                onClick={() => togglePermission(mod.id, action)}
                                                                className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                                                                    isChecked 
                                                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                                                        : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-transparent'
                                                                }`}
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={profile?.is_system || !name.trim() || saveMutation.isPending}
                        onClick={() => saveMutation.mutate({ name, description, permissions })}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                    >
                        {saveMutation.isPending ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>
        </div>
    );
}

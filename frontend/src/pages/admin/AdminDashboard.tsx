import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Users, Shield, UserPlus, MoreVertical, Building } from 'lucide-react';
import ProfileModal from './ProfileModal';

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<'users' | 'profiles'>('users');
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<any>(null);

    const { data: usersRes } = useQuery({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const res = await api.get('/admin/users');
            return res.data;
        },
        enabled: activeTab === 'users'
    });

    const { data: profilesRes } = useQuery({
        queryKey: ['admin-profiles'],
        queryFn: async () => {
            const res = await api.get('/admin/profiles');
            return res.data;
        },
        enabled: activeTab === 'profiles'
    });

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header Section */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 shrink-0 z-10 sticky top-0">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm">
                                <Building className="w-5 h-5" />
                            </div>
                            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Organization Settings</h1>
                        </div>
                        <p className="text-slate-500 font-medium ml-14">Manage users, security profiles, and global workspace defaults.</p>
                    </div>
                    {activeTab === 'users' && (
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-2">
                            <UserPlus className="w-4 h-4" /> Invite User
                        </button>
                    )}
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-6 mt-8 -mb-6 ml-14">
                    {(['users', 'profiles'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 px-1 text-sm font-bold capitalize border-b-2 transition-colors duration-200 flex items-center gap-2 ${
                                activeTab === tab 
                                    ? 'border-indigo-500 text-indigo-600' 
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                            }`}
                        >
                            {tab === 'users' ? <Users className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                            {tab === 'profiles' ? 'Roles & Profiles' : 'Users'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 overflow-auto p-8 relative">
                <div className="max-w-6xl mx-auto">
                    
                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-4 px-6">User</th>
                                        <th className="py-4 px-6 hidden md:table-cell">Role / Profile</th>
                                        <th className="py-4 px-6 hidden lg:table-cell">Status</th>
                                        <th className="py-4 px-6 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {usersRes?.data?.map((user: any) => (
                                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 border border-indigo-100 shadow-sm">
                                                        {user.first_name?.[0]}{user.last_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 flex items-center gap-2">
                                                            {user.first_name} {user.last_name}
                                                        </div>
                                                        <div className="text-slate-500 font-medium text-xs mt-0.5">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 hidden md:table-cell">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold text-slate-700">{user.title || 'Team Member'}</span>
                                                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit">
                                                        {user.profile?.name || 'Standard User'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 hidden lg:table-cell">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                                    user.status === 'active' 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    {user.status}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <button className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors">
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!usersRes?.data || usersRes.data.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="py-12 text-center text-slate-500">
                                                No users found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* PROFILES TAB */}
                    {activeTab === 'profiles' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Security Profiles</h3>
                                    <p className="text-sm font-medium text-slate-500 mt-1">Configure role-based access control policies.</p>
                                </div>
                                <button 
                                    onClick={() => { setEditingProfile(null); setIsProfileModalOpen(true); }}
                                    className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer">
                                    Create Custom Profile
                                </button>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                                {profilesRes?.data?.map((profile: any) => (
                                    <div key={profile.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                                <Shield className="w-5 h-5 text-indigo-500" />
                                                {profile.name}
                                                {profile.is_system && (
                                                    <span className="text-[10px] bg-slate-800 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">System</span>
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => { setEditingProfile(profile); setIsProfileModalOpen(true); }}
                                                className="text-indigo-600 text-sm font-bold hover:underline">Edit Policy</button>
                                        </div>
                                        <p className="text-sm text-slate-500 font-medium mb-4">{profile.description || 'No description'}</p>
                                        
                                        <div className="bg-slate-50 rounded-lg border border-slate-100 p-3">
                                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Enabled Feature Permissions:</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {Object.keys(profile.permissions || {}).length > 0 ? (
                                                    Object.entries(profile.permissions as Record<string, any>).slice(0, 5).map(([module, perms]) => (
                                                        <span key={module} className="bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-semibold shadow-sm">
                                                            {module} ({Array.isArray(perms) ? perms.length : 'full'})
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic">Read-only or restrictive access</span>
                                                )}
                                                {Object.keys(profile.permissions || {}).length > 5 && (
                                                    <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-bold shadow-sm">
                                                        +{Object.keys(profile.permissions || {}).length - 5} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>

            <ProfileModal 
                isOpen={isProfileModalOpen} 
                onClose={() => setIsProfileModalOpen(false)} 
                profile={editingProfile} 
            />
        </div>
    );
}

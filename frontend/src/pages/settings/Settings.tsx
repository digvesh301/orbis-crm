import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Building, User, Lock, Save, Loader2, Globe, Building2 } from 'lucide-react';

export default function Settings() {
    const [activeTab, setActiveTab] = useState<'profile' | 'organization' | 'security'>('profile');
    const queryClient = useQueryClient();

    // Queries
    const { data: profileData, isLoading: isProfileLoading } = useQuery({
        queryKey: ['settings-profile'],
        queryFn: () => api.get('/settings/profile').then(res => res.data?.data)
    });

    const { data: orgData, isLoading: isOrgLoading } = useQuery({
        queryKey: ['settings-org'],
        queryFn: () => api.get('/settings/org').then(res => res.data?.data)
    });

    // Mutations
    const updateProfile = useMutation({
        mutationFn: (data: any) => api.patch('/settings/profile', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings-profile'] });
            queryClient.invalidateQueries({ queryKey: ['auth-me'] });
            alert("Profile updated successfully!");
        }
    });

    const updateOrg = useMutation({
        mutationFn: (data: any) => api.patch('/settings/org', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings-org'] });
            alert("Organization settings updated successfully!");
        }
    });

    const updatePassword = useMutation({
        mutationFn: (data: any) => api.post('/settings/password', data),
        onSuccess: () => alert("Password changed securely."),
        onError: (err: any) => alert(err.response?.data?.error || "Failed to update password.")
    });

    // Local State Handlers
    const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        updateProfile.mutate({
            first_name: fd.get('first_name'),
            last_name: fd.get('last_name'),
            title: fd.get('title'),
        });
    };

    const handleOrgSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        updateOrg.mutate({
            name: fd.get('name'),
            website: fd.get('website'),
            phone: fd.get('phone'),
            timezone: fd.get('timezone'),
            currency: fd.get('currency'),
        });
    };

    const handlePasswordSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        updatePassword.mutate({
            current_password: fd.get('current_password'),
            new_password: fd.get('new_password'),
        });
        e.currentTarget.reset();
    };

    const isLoading = isProfileLoading || isOrgLoading;

    if (isLoading) {
        return <div className="p-8 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
    }

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
                <p className="text-slate-500 mt-1">Manage your account and organization preferences.</p>
            </div>

            <div className="flex border-b border-slate-200 gap-6">
                <button 
                    onClick={() => setActiveTab('profile')}
                    className={`pb-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'profile' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <User className="w-4 h-4" /> Personal Profile
                </button>
                <button 
                    onClick={() => setActiveTab('organization')}
                    className={`pb-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'organization' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Building className="w-4 h-4" /> Organization
                </button>
                <button 
                    onClick={() => setActiveTab('security')}
                    className={`pb-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'security' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Lock className="w-4 h-4" /> Security
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-hidden">
                {activeTab === 'profile' && profileData && (
                    <form onSubmit={handleProfileSubmit} className="max-w-xl space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                                <input name="first_name" defaultValue={profileData.first_name} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                                <input name="last_name" defaultValue={profileData.last_name || ''} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email (Read Only)</label>
                            <input value={profileData.email} disabled className="w-full bg-slate-50 border border-slate-200 text-slate-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                            <input name="title" defaultValue={profileData.title || ''} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none" placeholder="e.g. Sales Director" />
                        </div>
                        <div className="pt-4 flex justify-end">
                            <button type="submit" disabled={updateProfile.isPending} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer">
                                {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Profile
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === 'organization' && orgData && (
                    <form onSubmit={handleOrgSubmit} className="max-w-2xl space-y-6">
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-900">{orgData.name}</p>
                                <p className="text-xs text-slate-500">Plan: <span className="uppercase text-indigo-600 font-bold">{orgData.plan}</span></p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Organization Name</label>
                                <input name="name" defaultValue={orgData.name} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Company Website</label>
                                <div className="relative">
                                    <Globe className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                    <input name="website" defaultValue={orgData.website || ''} placeholder="https://example.com" className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Corporate Phone</label>
                                <input name="phone" defaultValue={orgData.phone || ''} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
                                <select name="timezone" defaultValue={orgData.timezone} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none">
                                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                                    <option value="UTC">UTC</option>
                                    <option value="America/New_York">America/New_York</option>
                                    <option value="Europe/London">Europe/London</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Base Currency</label>
                                <select name="currency" defaultValue={orgData.currency} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none">
                                    <option value="INR">INR (₹)</option>
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="GBP">GBP (£)</option>
                                </select>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button type="submit" disabled={updateOrg.isPending} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer">
                                {updateOrg.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Organization
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === 'security' && (
                    <form onSubmit={handlePasswordSubmit} className="max-w-xl space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                            <input name="current_password" type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                            <input name="new_password" type="password" minLength={8} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none" required />
                        </div>
                        <div className="pt-4">
                            <button type="submit" disabled={updatePassword.isPending} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer">
                                {updatePassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                                Update Password
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Building2, Globe, IndianRupee, MoreVertical } from 'lucide-react';

export default function AccountsList() {
    const { data: accounts, isLoading } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => {
            const res = await api.get('/accounts');
            return res.data;
        }
    });

    if (isLoading) return <div className="p-8">Loading accounts...</div>;

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accounts</h1>
                    <p className="text-slate-500 mt-1">Companies and organizations you do business with.</p>
                </div>
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer">
                    Add Account
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-500">
                            <th className="py-4 px-6 font-medium">Account Name</th>
                            <th className="py-4 px-6 font-medium">Industry</th>
                            <th className="py-4 px-6 font-medium hidden md:table-cell">Revenue</th>
                            <th className="py-4 px-6 font-medium hidden lg:table-cell">Website</th>
                            <th className="py-4 px-6 font-medium text-right">Owner</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {accounts?.data?.map((account: any) => (
                            <tr key={account.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 border border-indigo-100 shadow-sm">
                                            {account.name?.[0]}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-900">{account.name}</div>
                                            <div className="text-slate-500">{account.account_type || 'Customer'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 px-6 text-slate-700">
                                    {account.industry || '—'}
                                </td>
                                <td className="py-4 px-6 text-slate-600 hidden md:table-cell font-medium">
                                    <div className="flex items-center gap-1">
                                        <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                                        {account.annual_revenue ? Number(account.annual_revenue).toLocaleString() : '—'}
                                    </div>
                                </td>
                                <td className="py-4 px-6 text-indigo-600 hidden lg:table-cell">
                                    {account.website ? (
                                        <a href={`https://${account.website.replace(/^https?:\/\//, '')}`} className="flex items-center gap-2 hover:underline" target="_blank" rel="noreferrer">
                                            <Globe className="w-4 h-4 text-slate-400" />
                                            {account.website.replace(/^https?:\/\//, '')}
                                        </a>
                                    ) : '—'}
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <div className="text-slate-600">{account.owner?.name}</div>
                                        <button className="text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="w-5 h-5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {accounts?.data?.length === 0 && (
                    <div className="text-center py-24 text-slate-500">
                        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        No accounts found. Create your first one to get started!
                    </div>
                )}
            </div>
        </div>
    );
}

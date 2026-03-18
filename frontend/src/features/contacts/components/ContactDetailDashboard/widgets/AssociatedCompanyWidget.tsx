import { Building2 } from 'lucide-react';

export default function AssociatedCompanyWidget({ contact }: { contact: any }) {
    if (!contact.account_id) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-slate-300" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-600">No Account Associated</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Link this contact to a parent organization to track B2B history.</p>
                </div>
                <button className="text-indigo-600 text-sm font-bold hover:underline">Link Account</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full justify-between">
            <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm border border-indigo-400">
                    <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                    <a href={`/accounts/${contact.account_id}`} className="font-bold text-lg text-slate-900 hover:text-indigo-600 transition-colors">
                        Parent Enterprise Inc.
                    </a>
                    <div className="text-sm text-slate-500 font-medium mt-0.5">Software Development • B2B</div>
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-slate-500 font-medium">Role at Company</span>
                    <span className="font-bold text-slate-900">{contact.title || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Buying Power</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase text-[10px] tracking-wider">Decision Maker</span>
                </div>
            </div>
            
            <a href={`/accounts/${contact.account_id}`} className="block text-center w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2 mt-4 text-sm font-bold transition-all shadow-sm">
                View Enterprise Record
            </a>
        </div>
    );
}

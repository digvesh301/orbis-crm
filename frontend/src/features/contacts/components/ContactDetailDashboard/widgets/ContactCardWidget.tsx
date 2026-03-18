import { MapPin, Clock } from 'lucide-react';
import { usePermissions } from '../../../../../hooks/usePermissions';

export default function ContactCardWidget({ contact }: { contact: any }) {
    const { canUpdate } = usePermissions();

    return (
        <div className="space-y-6">
            <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Location
                </h4>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm font-semibold text-slate-800 space-y-1">
                    <div>{contact.address?.street || 'No street provided'}</div>
                    <div className="flex gap-2 text-slate-600">
                        <span>{contact.address?.city || 'City'},</span>
                        <span>{contact.address?.state || 'State'} {contact.address?.zip || ''}</span>
                    </div>
                    <div className="text-slate-500">{contact.address?.country || 'Country'}</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</h4>
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                        {contact.status || 'Active'}
                    </span>
                </div>
                <div>
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Created
                    </h4>
                    <div className="text-sm font-semibold text-slate-700">
                        {new Date(contact.created_at).toLocaleDateString()}
                    </div>
                </div>
            </div>

            {canUpdate && (
                <button className="w-full mt-4 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-indigo-600 py-2 rounded-xl text-sm font-bold shadow-sm transition-all text-center">
                    Edit Profile Details
                </button>
            )}
        </div>
    );
}

import { useState, useEffect } from 'react';
import { X, IndianRupee } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface DealModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DealModal({ isOpen, onClose }: DealModalProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        name: '',
        amount: '',
        stage_id: '',
        contact_id: null as string | null, // optional for simplicity
    });

    const { data: stagesData } = useQuery({
        queryKey: ['pipeline-stages'],
        queryFn: async () => {
            const res = await api.get('/pipeline');
            return res.data;
        },
        enabled: isOpen,
    });
    const pipelineStages = stagesData?.data || [];

    useEffect(() => {
        if (isOpen && pipelineStages.length > 0 && !formData.stage_id) {
            setFormData(prev => ({ ...prev, stage_id: pipelineStages[0].id }));
        }
    }, [isOpen, pipelineStages]);

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            return api.post('/deals', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deals'] });
            setFormData({ name: '', amount: '', stage_id: pipelineStages[0]?.id || '', contact_id: null });
            onClose();
        }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <IndianRupee className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Create Deal</h2>
                            <p className="text-sm font-medium text-slate-500">Track a new opportunity.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Deal Name *</label>
                        <input 
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 font-medium"
                            placeholder="Website Redesign Q3"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Amount</label>
                        <input 
                            type="number"
                            value={formData.amount}
                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 font-medium"
                            placeholder="5000"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Pipeline Stage *</label>
                        <select
                            value={formData.stage_id}
                            onChange={e => setFormData({ ...formData, stage_id: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 font-medium"
                        >
                            {pipelineStages.map((stage: any) => (
                                <option key={stage.id} value={stage.id}>{stage.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={!formData.name.trim() || !formData.stage_id || mutation.isPending}
                        onClick={() => mutation.mutate({
                            ...formData,
                            amount: formData.amount ? Number(formData.amount) : undefined
                        })}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                    >
                        {mutation.isPending ? 'Saving...' : 'Save Deal'}
                    </button>
                </div>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { ColumnPreference } from '../../api/preferences.api';

interface ColumnManagerProps {
    columns: ColumnPreference[];
    onChange: (columns: ColumnPreference[]) => void;
    onClose: () => void;
}

export default function ColumnManager({ columns, onChange, onClose }: ColumnManagerProps) {
    const [cols, setCols] = useState(columns);

    const toggleColumn = (id: string) => {
        setCols(cols.map(c => c.id === id ? { ...c, isVisible: !c.isVisible } : c));
    };

    return (
        <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col transform transition-transform animate-in slide-in-from-right duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="font-bold text-slate-900">Manage Columns</h2>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 transition-colors text-slate-500">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Visible Columns</p>
                {cols.map(c => (
                    <label 
                        key={c.id} 
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${c.isVisible ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <span className="text-sm font-medium">{c.label}</span>
                        <input 
                            type="checkbox" 
                            checked={c.isVisible} 
                            onChange={() => toggleColumn(c.id)} 
                            className="sr-only" 
                        />
                        <div className={`w-5 h-5 rounded flex items-center justify-center ${c.isVisible ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                            {c.isVisible && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                    </label>
                ))}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50">
                <button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl py-3 shadow-sm transition-colors"
                    onClick={() => {
                        onChange(cols);
                        onClose();
                    }}
                >
                    Save View State
                </button>
            </div>
        </div>
    );
}

import { X, Filter, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface FilterSidebarProps {
    activeFilters: Record<string, any>;
    onApply: (filters: Record<string, any>) => void;
    onClose: () => void;
}

const AVAILABLE_FIELDS = [
    { id: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'lead'] },
    { id: 'city', label: 'City', type: 'text', placeholder: 'e.g. New York' },
    { id: 'tag', label: 'Tag', type: 'text', placeholder: 'e.g. VIP' },
];

export default function FilterSidebar({ activeFilters, onApply, onClose }: FilterSidebarProps) {
    // Convert generic object { status: 'active', city: 'NY' } 
    // into an array of rules like [{ field: 'status', value: 'active'}, { field: 'city', value: 'NY' }]
    const initialRules = Object.entries(activeFilters).map(([field, value]) => ({ field, value: String(value) }));
    
    // If empty, start with one empty rule row
    const [rules, setRules] = useState<{ field: string; value: string }[]>(
        initialRules.length > 0 ? initialRules : [{ field: 'status', value: '' }]
    );

    const updateRule = (index: number, key: 'field' | 'value', val: string) => {
        const newRules = [...rules];
        newRules[index][key] = val;
        // If field changes, reset value to empty
        if (key === 'field') {
            newRules[index].value = '';
        }
        setRules(newRules);
    };

    const addRule = () => {
        setRules([...rules, { field: 'status', value: '' }]);
    };

    const removeRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index));
    };

    const applyFilters = () => {
        // Build the object back
        const filters: Record<string, any> = {};
        rules.forEach(r => {
            if (r.field && r.value.trim() !== '') {
                filters[r.field] = r.value.trim();
            }
        });
        onApply(filters);
        onClose();
    };

    const clearFilters = () => {
        setRules([{ field: 'status', value: '' }]);
        onApply({});
        onClose();
    };

    return (
        <div className="fixed inset-y-0 right-0 w-[400px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col transform transition-transform animate-in slide-in-from-right duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-indigo-500" /> Universal Filter Engine
                </h2>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 transition-colors text-slate-500">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {rules.length === 0 && (
                    <div className="text-sm text-slate-500 italic text-center py-4 bg-slate-50 rounded-lg">
                        No filters configured.
                    </div>
                )}

                {rules.map((rule, index) => {
                    const fieldDef = AVAILABLE_FIELDS.find(f => f.id === rule.field);

                    return (
                        <div key={index} className="flex gap-2 items-start bg-slate-50 p-3 rounded-lg border border-slate-100 relative group">
                            <div className="flex-1 space-y-3">
                                <select 
                                    value={rule.field}
                                    onChange={(e) => updateRule(index, 'field', e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 block p-2"
                                >
                                    {AVAILABLE_FIELDS.map(f => (
                                        <option key={f.id} value={f.id}>{f.label}</option>
                                    ))}
                                </select>

                                {fieldDef?.type === 'select' ? (
                                    <select 
                                        value={rule.value}
                                        onChange={(e) => updateRule(index, 'value', e.target.value)}
                                        className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 block p-2 font-medium"
                                    >
                                        <option value="">Any {fieldDef.label}</option>
                                        {fieldDef.options?.map(opt => (
                                            <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input 
                                        type="text"
                                        value={rule.value}
                                        onChange={(e) => updateRule(index, 'value', e.target.value)}
                                        placeholder={fieldDef?.placeholder || 'Enter value...'}
                                        className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 block p-2"
                                    />
                                )}
                            </div>
                            
                            <button 
                                onClick={() => removeRule(index)}
                                className="p-2 border border-slate-200 bg-white rounded-md text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
                                title="Remove rule"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })}

                <button 
                    onClick={addRule}
                    className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-200 rounded-lg text-sm font-medium text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                >
                    <Plus className="w-4 h-4" /> Add Rule
                </button>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50 shrink-0">
                <button 
                    onClick={clearFilters}
                    className="flex-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl py-3 shadow-sm transition-colors text-sm"
                >
                    Clear All
                </button>
                <button 
                    onClick={applyFilters}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl py-3 shadow-sm transition-colors text-sm"
                >
                    Apply Filters
                </button>
            </div>
        </div>
    );
}

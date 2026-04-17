import { X, Filter, Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

interface FilterRule {
    field: string;
    operator: string;
    value: string;
}

interface FilterSidebarProps {
    activeFilters: Record<string, any>;
    onApply: (filters: Record<string, any>) => void;
    onClose: () => void;
}

// ─── All filterable fields with their operators ───────────────────────────────
const FILTER_FIELDS = [
    {
        id: 'status',
        label: 'Status',
        type: 'select',
        options: [
            { value: 'active',   label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'lead',     label: 'Lead' },
        ],
        operators: ['is', 'is_not'],
    },
    {
        id: 'lead_source',
        label: 'Lead Source',
        type: 'select',
        options: [
            { value: 'web',          label: 'Website' },
            { value: 'referral',     label: 'Referral' },
            { value: 'cold_call',    label: 'Cold Call' },
            { value: 'social_media', label: 'Social Media' },
            { value: 'email',        label: 'Email Campaign' },
            { value: 'event',        label: 'Event' },
            { value: 'other',        label: 'Other' },
        ],
        operators: ['is', 'is_not'],
    },
    {
        id: 'city',
        label: 'City',
        type: 'text',
        placeholder: 'e.g. Mumbai',
        operators: ['contains', 'equals'],
    },
    {
        id: 'tag',
        label: 'Tag',
        type: 'text',
        placeholder: 'e.g. VIP',
        operators: ['contains'],
    },
    {
        id: 'created_after',
        label: 'Created After',
        type: 'date',
        operators: ['on_or_after'],
    },
    {
        id: 'created_before',
        label: 'Created Before',
        type: 'date',
        operators: ['on_or_before'],
    },
    {
        id: 'do_not_email',
        label: 'Do Not Email',
        type: 'boolean',
        options: [
            { value: 'true',  label: 'Yes — blocked' },
            { value: 'false', label: 'No — allowed' },
        ],
        operators: ['is'],
    },
    {
        id: 'do_not_call',
        label: 'Do Not Call',
        type: 'boolean',
        options: [
            { value: 'true',  label: 'Yes — blocked' },
            { value: 'false', label: 'No — allowed' },
        ],
        operators: ['is'],
    },
];

const OPERATOR_LABELS: Record<string, string> = {
    is:           'is',
    is_not:       'is not',
    contains:     'contains',
    equals:       'equals',
    on_or_after:  'on or after',
    on_or_before: 'on or before',
};

// Convert the flat filter object back into an array of rules for editing
function filtersToRules(filters: Record<string, any>): FilterRule[] {
    const rules: FilterRule[] = [];
    for (const [field, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue;
        const fieldDef = FILTER_FIELDS.find(f => f.id === field);
        rules.push({
            field,
            operator: fieldDef?.operators?.[0] ?? 'is',
            value: String(value),
        });
    }
    return rules;
}

// Convert rules array back to object for API
function rulesToFilters(rules: FilterRule[]): Record<string, any> {
    const out: Record<string, any> = {};
    for (const rule of rules) {
        if (!rule.field || !rule.value.trim()) continue;
        // For date fields we just pass the value through
        out[rule.field] = rule.value.trim();
    }
    return out;
}

export default function FilterSidebar({ activeFilters, onApply, onClose }: FilterSidebarProps) {
    const initial = filtersToRules(activeFilters);
    const [rules, setRules] = useState<FilterRule[]>(
        initial.length > 0 ? initial : [{ field: 'status', operator: 'is', value: '' }]
    );

    const updateRule = (index: number, key: keyof FilterRule, val: string) => {
        const next = [...rules];
        next[index] = { ...next[index], [key]: val };
        // Reset value + operator when field changes
        if (key === 'field') {
            const def = FILTER_FIELDS.find(f => f.id === val);
            next[index].operator = def?.operators?.[0] ?? 'is';
            next[index].value = '';
        }
        setRules(next);
    };

    const addRule = () =>
        setRules(r => [...r, { field: 'status', operator: 'is', value: '' }]);

    const removeRule = (index: number) =>
        setRules(r => r.filter((_, i) => i !== index));

    const apply = () => {
        onApply(rulesToFilters(rules));
        onClose();
    };

    const clear = () => {
        setRules([{ field: 'status', operator: 'is', value: '' }]);
        onApply({});
        onClose();
    };

    const activeRuleCount = rules.filter(r => r.value.trim() !== '').length;

    return (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900 text-sm">Filter Contacts</h2>
                        <p className="text-xs text-slate-500">
                            {activeRuleCount > 0 ? `${activeRuleCount} active filter${activeRuleCount > 1 ? 's' : ''}` : 'No active filters'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-full hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-700"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Filter Rules */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Show contacts where ALL conditions match:
                </p>

                {rules.map((rule, index) => {
                    const fieldDef = FILTER_FIELDS.find(f => f.id === rule.field);

                    return (
                        <div
                            key={index}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 relative group"
                        >
                            {/* AND pill between rules */}
                            {index > 0 && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                        AND
                                    </span>
                                </div>
                            )}

                            {/* Row 1: Field selector */}
                            <div className="flex items-center gap-2">
                                <select
                                    value={rule.field}
                                    onChange={e => updateRule(index, 'field', e.target.value)}
                                    className="flex-1 bg-white border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 font-medium cursor-pointer"
                                >
                                    {FILTER_FIELDS.map(f => (
                                        <option key={f.id} value={f.id}>{f.label}</option>
                                    ))}
                                </select>

                                {(fieldDef?.operators?.length ?? 0) > 1 && (
                                    <select
                                        value={rule.operator}
                                        onChange={e => updateRule(index, 'operator', e.target.value)}
                                        className="bg-white border border-slate-200 text-slate-500 text-xs rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 cursor-pointer"
                                    >
                                        {fieldDef?.operators.map(op => (
                                            <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Row 2: Value input */}
                            <div className="flex items-center gap-2">
                                {(fieldDef?.type === 'select' || fieldDef?.type === 'boolean') ? (
                                    <select
                                        value={rule.value}
                                        onChange={e => updateRule(index, 'value', e.target.value)}
                                        className="flex-1 bg-white border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 font-medium cursor-pointer"
                                    >
                                        <option value="">— Choose value —</option>
                                        {fieldDef.options?.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                ) : fieldDef?.type === 'date' ? (
                                    <input
                                        type="date"
                                        value={rule.value}
                                        onChange={e => updateRule(index, 'value', e.target.value)}
                                        className="flex-1 bg-white border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 cursor-pointer"
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={rule.value}
                                        onChange={e => updateRule(index, 'value', e.target.value)}
                                        placeholder={fieldDef?.placeholder || 'Enter value...'}
                                        className="flex-1 bg-white border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
                                    />
                                )}

                                <button
                                    onClick={() => removeRule(index)}
                                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors shrink-0"
                                    title="Remove rule"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {/* Add Rule Button */}
                <button
                    onClick={addRule}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add Another Rule
                </button>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-slate-100 flex gap-3 bg-slate-50 shrink-0">
                <button
                    onClick={clear}
                    className="flex-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold rounded-xl py-2.5 shadow-sm transition-colors text-sm"
                >
                    Clear All
                </button>
                <button
                    onClick={apply}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl py-2.5 shadow-sm transition-colors text-sm flex items-center justify-center gap-2"
                >
                    <Filter className="w-4 h-4" />
                    Apply Filters
                </button>
            </div>
        </div>
    );
}

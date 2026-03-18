import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  SortingState,
  ColumnDef,
} from '@tanstack/react-table';
import { ArrowUpDown, CheckSquare, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ColumnPreference } from '../../api/preferences.api';
import { useMemo, useState, useEffect } from 'react';

interface DataTableProps {
    data: any[];
    columns: ColumnPreference[];
    sortState: { field: string; direction: 'asc' | 'desc' } | null;
    onSortChange: (sort: { field: string; direction: 'asc' | 'desc' }) => void;
    onRowSelectionChange?: (selectedIds: string[]) => void;
}

export default function DataTable({ data, columns: prefColumns, sortState, onSortChange, onRowSelectionChange }: DataTableProps) {
    const navigate = useNavigate();
    const [rowSelection, setRowSelection] = useState({});

    // Notify parent on row selection change
    useEffect(() => {
        if (onRowSelectionChange) {
            const selectedIds = Object.keys(rowSelection).map(index => data[parseInt(index)]?.id).filter(Boolean);
            onRowSelectionChange(selectedIds);
        }
    }, [rowSelection, data, onRowSelectionChange]);

    const visibleCols = useMemo(() => {
        return [...prefColumns]
            .filter(c => c.isVisible)
            .sort((a, b) => a.order - b.order);
    }, [prefColumns]);

    const tableColumns = useMemo<ColumnDef<any>[]>(() => {
        const cols: ColumnDef<any>[] = [
            {
                id: 'select',
                header: ({ table }) => (
                    <div className="px-1 flex items-center h-full w-full" onClick={(e) => { e.stopPropagation(); table.toggleAllRowsSelected(); }}>
                        {table.getIsAllRowsSelected() ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600 cursor-pointer" />
                        ) : (
                            <Square className="w-5 h-5 text-slate-300 cursor-pointer hover:text-slate-400" />
                        )}
                    </div>
                ),
                cell: ({ row }) => (
                    <div className="px-1 flex items-center h-full w-full" onClick={(e) => { e.stopPropagation(); row.toggleSelected(); }}>
                        {row.getIsSelected() ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600 cursor-pointer" />
                        ) : (
                            <Square className="w-5 h-5 text-slate-300 cursor-pointer hover:text-slate-400" />
                        )}
                    </div>
                ),
                enableSorting: false,
            },
        ];

        visibleCols.forEach(prefCol => {
            cols.push({
                accessorKey: prefCol.id,
                header: prefCol.label,
                enableSorting: prefCol.id !== 'actions', // don't sort actions
                cell: (info) => {
                    const row = info.row.original;
                    const val = info.getValue() as any;
                    
                    if (prefCol.id === 'name') {
                        return (
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 text-xs shadow-sm">
                                    {row.first_name?.[0]}{row.last_name?.[0]}
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                        {row.first_name} {row.last_name}
                                    </div>
                                    <div className="text-xs text-slate-500">{row.email}</div>
                                </div>
                            </div>
                        );
                    }
                    if (prefCol.id === 'owner') return row.owner?.name;
                    if (prefCol.id === 'city') return row.address?.city || '—';
                    if (prefCol.id === 'status' || prefCol.id === 'module') {
                         return (
                             <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200">
                                 {val || '—'}
                             </span>
                         );
                    }
                    return val || '—';
                }
            });
        });
        return cols;
    }, [visibleCols]);

    // Map custom sortState to Tanstack SortingState
    const sorting: SortingState = useMemo(() => {
        if (!sortState) return [];
        return [{ id: sortState.field, desc: sortState.direction === 'desc' }];
    }, [sortState]);

    const table = useReactTable({
        data,
        columns: tableColumns,
        state: {
            sorting,
            rowSelection,
        },
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: (updater) => {
            if (typeof updater === 'function') {
                const newSorting = updater(sorting);
                if (newSorting.length > 0) {
                    onSortChange({ field: newSorting[0].id, direction: newSorting[0].desc ? 'desc' : 'asc' });
                }
            }
        },
        getCoreRowModel: getCoreRowModel(),
        manualSorting: true, // We handle sorting in the parent component via API
    });

    return (
        <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
                {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id} className="bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-500 uppercase tracking-wider">
                        {headerGroup.headers.map(header => (
                            <th 
                                key={header.id} 
                                onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                                className={`py-4 px-6 ${header.column.getCanSort() ? 'cursor-pointer hover:bg-slate-100 group' : ''} transition-colors select-none`}
                                style={{ width: header.id === 'select' ? '40px' : 'auto' }}
                            >
                                <div className="flex items-center gap-2">
                                    {flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                    )}
                                    {header.column.getCanSort() && (
                                        <ArrowUpDown className={`w-3.5 h-3.5 ${header.column.getIsSorted() ? 'text-indigo-500' : 'text-slate-300 group-hover:text-slate-400'}`} />
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
                {table.getRowModel().rows.map(row => (
                    <tr 
                        key={row.id} 
                        onClick={() => navigate(`/contacts/${row.original.id}`)}
                        className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${row.getIsSelected() ? 'bg-indigo-50/50' : ''}`}
                    >
                        {row.getVisibleCells().map(cell => (
                            <td key={cell.id} className="py-4 px-6 text-slate-700">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

import * as React from 'react';
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type ColumnFiltersState,
    type SortingState,
} from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    CheckmarkCircle01Icon,
    Loading03Icon,
    AlertCircleIcon,
    ArrowLeftDoubleIcon,
    ArrowLeft01Icon,
    ArrowRight01Icon,
    ArrowRightDoubleIcon,
    SearchIcon,
} from '@hugeicons/core-free-icons';

import type { OacRecord } from '@/lib/types';

function EstadoBadge({ estado }: { estado: string }) {
    switch (estado) {
        case 'enviado':
            return (
                <Badge variant="outline" className="border-green-600/30 text-green-600">
                    <HugeiconsIcon
                        icon={CheckmarkCircle01Icon}
                        strokeWidth={2}
                        className="size-3 fill-green-500"
                    />
                    Enviado
                </Badge>
            );
        case 'pendiente':
            return (
                <Badge variant="outline" className="border-yellow-600/30 text-yellow-600">
                    <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-3" />
                    Pendiente
                </Badge>
            );
        case 'error_carga':
            return (
                <Badge variant="outline" className="border-red-600/30 text-red-600">
                    <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-3" />
                    Error
                </Badge>
            );
        default:
            return <Badge variant="outline">{estado}</Badge>;
    }
}

function ConfianzaBadge({ confianza }: { confianza: string | null }) {
    if (!confianza) return <span className="text-muted-foreground">—</span>;
    const color =
        confianza === 'alta'
            ? 'text-green-600 border-green-600/30'
            : confianza === 'media'
              ? 'text-yellow-600 border-yellow-600/30'
              : 'text-red-600 border-red-600/30';
    return (
        <Badge variant="outline" className={color}>
            {confianza.charAt(0).toUpperCase() + confianza.slice(1)}
        </Badge>
    );
}

function getIdentificador(record: OacRecord): string {
    const tipo = record.tipo_orden;
    if (tipo === 'SAC' && record.numero_sac) return `SAC ${record.numero_sac}`;
    if (tipo === 'Derivada' && record.numero_reclamo && record.numero_ot)
        return `${record.numero_reclamo} / OT ${record.numero_ot}`;
    if (tipo === 'Incidencia' && record.numero_oac) return record.numero_oac;
    if (tipo === 'Reclamo' && record.numero_reclamo) return `Reclamo ${record.numero_reclamo}`;
    if (tipo === 'OT' && record.numero_ot) return `OT ${record.numero_ot}`;
    // Fallback sin tipo_orden
    if (record.numero_sac) return `SAC ${record.numero_sac}`;
    if (record.numero_reclamo) return `Reclamo ${record.numero_reclamo}`;
    if (record.numero_ot) return `OT ${record.numero_ot}`;
    if (record.numero_oac) return record.numero_oac;
    return '—';
}

function getTipo(record: OacRecord): string {
    if (record.tipo_orden) return record.tipo_orden;
    if (record.numero_sac) return 'SAC';
    if (record.numero_reclamo && record.numero_ot) return 'Derivada';
    if (record.numero_reclamo) return 'Reclamo';
    if (record.numero_ot) return 'OT';
    return '—';
}

function TipoBadge({ tipo }: { tipo: string }) {
    const styles: Record<string, string> = {
        SAC: 'border-blue-600/30 text-blue-600',
        OT: 'border-purple-600/30 text-purple-600',
        Reclamo: 'border-orange-600/30 text-orange-600',
        Incidencia: 'border-cyan-600/30 text-cyan-600',
        Derivada: 'border-pink-600/30 text-pink-600',
    };
    return (
        <Badge variant="outline" className={styles[tipo] || 'text-muted-foreground'}>
            {tipo}
        </Badge>
    );
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

const columns: ColumnDef<OacRecord>[] = [
    {
        accessorKey: 'id',
        header: () => <div className="w-12 text-center">#</div>,
        cell: ({ row }) => (
            <div className="text-muted-foreground w-12 text-center">{row.original.id}</div>
        ),
        enableSorting: true,
    },
    {
        id: 'identificador',
        header: 'Identificador',
        accessorFn: (row) => getIdentificador(row),
        cell: ({ row }) => {
            const navigate = useNavigate();
            return (
                <Button
                    variant="link"
                    className="text-foreground w-fit px-0 text-left font-medium"
                    onClick={() =>
                        navigate({ to: '/history/$id', params: { id: String(row.original.id) } })
                    }>
                    {getIdentificador(row.original)}
                </Button>
            );
        },
        enableHiding: false,
    },
    {
        id: 'tipo',
        header: 'Tipo',
        accessorFn: (row) => getTipo(row),
        cell: ({ row }) => <TipoBadge tipo={getTipo(row.original)} />,
        filterFn: (row, _columnId, filterValue) => {
            if (!filterValue) return true;
            return getTipo(row.original) === filterValue;
        },
    },
    {
        accessorKey: 'numero_oac',
        header: 'OAC',
        cell: ({ row }) => (
            <span className="font-mono text-xs">{row.original.numero_oac || '—'}</span>
        ),
    },
    {
        accessorKey: 'fecha',
        header: 'Fecha OAC',
        cell: ({ row }) => <span>{row.original.fecha || '—'}</span>,
    },
    {
        accessorKey: 'empresa_contratista',
        header: 'Contratista',
        cell: ({ row }) => <span>{row.original.empresa_contratista || '—'}</span>,
    },
    {
        accessorKey: 'localidad',
        header: 'Localidad',
        cell: ({ row }) => <span>{row.original.localidad || '—'}</span>,
    },
    {
        accessorKey: 'estado_carga',
        header: 'Estado',
        cell: ({ row }) => <EstadoBadge estado={row.original.estado_carga} />,
    },
    {
        accessorKey: 'confianza_global',
        header: 'Confianza',
        cell: ({ row }) => <ConfianzaBadge confianza={row.original.confianza_global} />,
    },
    {
        accessorKey: 'created_at',
        header: 'Procesado',
        cell: ({ row }) => (
            <span className="text-muted-foreground text-xs">
                {formatDate(row.original.created_at)}
            </span>
        ),
    },
];

export function OacDataTable({ data }: { data: OacRecord[] }) {
    const [sorting, setSorting] = React.useState<SortingState>([{ id: 'created_at', desc: true }]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = React.useState('');
    const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 });

    const table = useReactTable({
        data,
        columns,
        state: { sorting, columnFilters, globalFilter, pagination },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <div className="relative max-w-sm flex-1">
                    <HugeiconsIcon
                        icon={SearchIcon}
                        strokeWidth={2}
                        className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                    />
                    <Input
                        placeholder="Buscar por SAC, OT, Reclamo, OAC..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <Select
                    value={(table.getColumn('tipo')?.getFilterValue() as string) ?? 'all'}
                    onValueChange={(value) =>
                        table.getColumn('tipo')?.setFilterValue(value === 'all' ? undefined : value)
                    }>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem value="all">Todos los tipos</SelectItem>
                            <SelectItem value="SAC">SAC</SelectItem>
                            <SelectItem value="OT">OT</SelectItem>
                            <SelectItem value="Reclamo">Reclamo</SelectItem>
                            <SelectItem value="Incidencia">Incidencia</SelectItem>
                            <SelectItem value="Derivada">Derivada</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
                <Select
                    value={(table.getColumn('estado_carga')?.getFilterValue() as string) ?? 'all'}
                    onValueChange={(value) =>
                        table
                            .getColumn('estado_carga')
                            ?.setFilterValue(value === 'all' ? undefined : value)
                    }>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="pendiente">Pendiente</SelectItem>
                            <SelectItem value="enviado">Enviado</SelectItem>
                            <SelectItem value="error_carga">Error</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="overflow-hidden rounded-lg border">
                <Table>
                    <TableHeader className="bg-muted">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} colSpan={header.colSpan}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef.header,
                                                  header.getContext()
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="text-muted-foreground h-24 text-center">
                                    No se encontraron registros.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-between px-2">
                <div className="text-muted-foreground text-sm">
                    {table.getFilteredRowModel().rows.length} registro(s) encontrado(s)
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="rows-per-page" className="text-sm font-medium">
                            Filas por página
                        </Label>
                        <Select
                            value={`${pagination.pageSize}`}
                            onValueChange={(value) => table.setPageSize(Number(value))}>
                            <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent side="top">
                                <SelectGroup>
                                    {[10, 20, 50, 100].map((size) => (
                                        <SelectItem key={size} value={`${size}`}>
                                            {size}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="text-sm font-medium">
                        Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}>
                            <HugeiconsIcon icon={ArrowLeftDoubleIcon} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}>
                            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}>
                            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                            disabled={!table.getCanNextPage()}>
                            <HugeiconsIcon icon={ArrowRightDoubleIcon} strokeWidth={2} />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

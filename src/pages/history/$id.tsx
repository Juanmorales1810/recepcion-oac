import { useState, useEffect, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { invoke } from '@tauri-apps/api/core';
import type { OacRecord } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Loading03Icon,
    ArrowLeft01Icon,
    CheckmarkCircle01Icon,
    AlertCircleIcon,
    Location01Icon,
    UserIcon,
    Calendar01Icon,
    Wrench01Icon,
    NoteIcon,
    FileXIcon,
} from '@hugeicons/core-free-icons';

export const Route = createFileRoute('/history/$id')({
    component: OacDetailPage,
});

function EditableField({
    label,
    value,
    editing,
    field,
    onChange,
}: {
    label: string;
    value: string | number | null | undefined;
    editing: boolean;
    field: string;
    onChange: (field: string, value: string) => void;
}) {
    if (editing) {
        return (
            <div className="flex flex-col gap-0.5">
                <Label className="text-muted-foreground text-xs">{label}</Label>
                <Input
                    value={String(value ?? '')}
                    onChange={(e) => onChange(field, e.target.value)}
                    className="h-8 text-sm"
                />
            </div>
        );
    }
    const display = value != null && value !== '' ? String(value) : '—';
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="text-sm">{display}</span>
        </div>
    );
}

function SectionCard({
    title,
    icon,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    {icon}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

function EstadoBadge({ estado }: { estado: string }) {
    switch (estado) {
        case 'enviado':
            return (
                <Badge className="border-green-600/30 bg-green-500/10 text-green-600">
                    <HugeiconsIcon
                        icon={CheckmarkCircle01Icon}
                        strokeWidth={2}
                        className="size-3"
                    />
                    Enviado
                </Badge>
            );
        case 'pendiente':
            return (
                <Badge className="border-yellow-600/30 bg-yellow-500/10 text-yellow-600">
                    <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-3" />
                    Pendiente
                </Badge>
            );
        case 'error_carga':
            return (
                <Badge className="border-red-600/30 bg-red-500/10 text-red-600">
                    <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-3" />
                    Error de carga
                </Badge>
            );
        default:
            return <Badge variant="outline">{estado}</Badge>;
    }
}

function ConfianzaBadge({ confianza }: { confianza: string | null }) {
    if (!confianza) return <Badge variant="outline">Sin datos</Badge>;
    const styles =
        confianza === 'alta'
            ? 'bg-green-500/10 text-green-600 border-green-600/30'
            : confianza === 'media'
              ? 'bg-yellow-500/10 text-yellow-600 border-yellow-600/30'
              : 'bg-red-500/10 text-red-600 border-red-600/30';
    return (
        <Badge className={styles}>{confianza.charAt(0).toUpperCase() + confianza.slice(1)}</Badge>
    );
}

function formatDateTime(dateStr: string | null): string {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
}

function OacDetailPage() {
    const { id } = Route.useParams();
    const navigate = useNavigate();
    const [record, setRecord] = useState<OacRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit mode
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState<Record<string, string | null>>({});
    const [saving, setSaving] = useState(false);

    // Preview
    const [previewOpen, setPreviewOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loadingPdf, setLoadingPdf] = useState(false);

    // Stamp
    const [stampLoading, setStampLoading] = useState(false);

    // Rename
    const [renameOpen, setRenameOpen] = useState(false);
    const [newFilename, setNewFilename] = useState('');
    const [renaming, setRenaming] = useState(false);

    // Action feedback
    const [actionError, setActionError] = useState<string | null>(null);

    const loadRecord = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await invoke<OacRecord>('get_oac_record', { id: Number(id) });
            setRecord(data);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadRecord();
    }, [loadRecord]);

    const updateField = (field: string, value: string) => {
        setEditForm((prev) => ({ ...prev, [field]: value || null }));
    };

    const startEditing = () => {
        if (!record) return;
        const ops: string[] = Array.isArray(record.operarios) ? record.operarios : [];
        setEditForm({
            tipo_orden: record.tipo_orden ?? '',
            empresa: record.empresa ?? '',
            numero_sac: record.numero_sac ?? '',
            numero_ot: record.numero_ot ?? '',
            numero_reclamo: record.numero_reclamo ?? '',
            numero_oac: record.numero_oac ?? '',
            fecha: record.fecha ?? '',
            usuario_nombre: record.usuario_nombre ?? '',
            suministro_nro: record.suministro_nro ?? '',
            direccion: record.direccion ?? '',
            barrio_villa: record.barrio_villa ?? '',
            departamento: record.departamento ?? '',
            localidad: record.localidad ?? '',
            latitud: record.latitud != null ? String(record.latitud) : '',
            longitud: record.longitud != null ? String(record.longitud) : '',
            motivo_reclamo: record.motivo_reclamo ?? '',
            descripcion_falla: record.descripcion_falla ?? '',
            ubicacion_falla: record.ubicacion_falla ?? '',
            codigo_falla: record.codigo_falla ?? '',
            codigo_trabajo: record.codigo_trabajo ?? '',
            tipo_instalacion: record.tipo_instalacion ?? '',
            elementos_afectados: record.elementos_afectados ?? '',
            descripcion_manuscrita: record.descripcion_manuscrita ?? '',
            trabajos_realizados: record.trabajos_realizados ?? '',
            trabajos_pendientes: record.trabajos_pendientes ?? '',
            materiales_utilizados: record.materiales_utilizados ?? '',
            apertura_puesto_medicion: record.apertura_puesto_medicion ?? '',
            empresa_contratista: record.empresa_contratista ?? '',
            operarios: ops.join(', '),
            hora_inicio: record.hora_inicio ?? '',
            hora_fin: record.hora_fin ?? '',
            estado_cierre: record.estado_cierre ?? '',
            observaciones_cierre: record.observaciones_cierre ?? '',
        });
        setEditing(true);
        setActionError(null);
    };

    const cancelEditing = () => {
        setEditing(false);
        setEditForm({});
    };

    const saveEdits = async () => {
        if (!record) return;
        setSaving(true);
        setActionError(null);
        try {
            const updates: Record<string, unknown> = {};
            for (const [key, val] of Object.entries(editForm)) {
                if (key === 'operarios') {
                    updates.operarios = (val ?? '')
                        .split(',')
                        .map((s: string) => s.trim())
                        .filter(Boolean);
                } else if (key === 'latitud' || key === 'longitud') {
                    updates[key] = val ? parseFloat(val) || null : null;
                } else {
                    updates[key] = val || null;
                }
            }
            await invoke('update_oac_record', { id: record.id, updates });
            await loadRecord();
            setEditing(false);
        } catch (e) {
            setActionError(String(e));
        } finally {
            setSaving(false);
        }
    };

    const handlePreview = async () => {
        if (!record?.archivo_destino) return;
        setPreviewOpen(true);
        setLoadingPdf(true);
        setActionError(null);
        try {
            const base64 = await invoke<string>('preview_pdf', {
                filePath: record.archivo_destino,
            });
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/pdf' });
            setPdfUrl(URL.createObjectURL(blob));
        } catch (e) {
            setActionError(String(e));
            setPreviewOpen(false);
        } finally {
            setLoadingPdf(false);
        }
    };

    const handleStamp = async () => {
        if (!record?.archivo_destino || !record?.fecha) return;
        setStampLoading(true);
        setActionError(null);
        try {
            const color = await invoke<string>('stamp_single_pdf', {
                id: record.id,
                filePath: record.archivo_destino,
                fecha: record.fecha,
            });
            setRecord((prev) => (prev ? { ...prev, sellado: color } : prev));
        } catch (e) {
            setActionError(String(e));
        } finally {
            setStampLoading(false);
        }
    };

    const openRename = () => {
        if (!record?.archivo_destino) return;
        const parts = record.archivo_destino.replace(/\\/g, '/').split('/');
        const current = parts[parts.length - 1] ?? '';
        setNewFilename(current.replace(/\.pdf$/i, ''));
        setRenameOpen(true);
        setActionError(null);
    };

    const handleRename = async () => {
        if (!record?.archivo_destino || !newFilename.trim()) return;
        setRenaming(true);
        setActionError(null);
        try {
            const newPath = await invoke<string>('rename_oac_file', {
                id: record.id,
                currentPath: record.archivo_destino,
                newName: newFilename.trim(),
            });
            setRecord((prev) => (prev ? { ...prev, archivo_destino: newPath } : prev));
            setRenameOpen(false);
        } catch (e) {
            setActionError(String(e));
        } finally {
            setRenaming(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center p-6">
                <div className="text-muted-foreground flex items-center gap-2">
                    <HugeiconsIcon
                        icon={Loading03Icon}
                        strokeWidth={2}
                        className="size-5 animate-spin"
                    />
                    Cargando...
                </div>
            </div>
        );
    }

    if (error || !record) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
                <p className="text-destructive text-sm">{error || 'Registro no encontrado'}</p>
                <Button variant="outline" size="sm" onClick={() => navigate({ to: '/history' })}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                    Volver
                </Button>
            </div>
        );
    }

    const tipo = record.tipo_orden;
    const identificador =
        tipo === 'SAC' && record.numero_sac
            ? `SAC ${record.numero_sac}`
            : tipo === 'Derivada' && record.numero_reclamo && record.numero_ot
              ? `${record.numero_reclamo} / OT ${record.numero_ot}`
              : tipo === 'Incidencia' && record.numero_oac
                ? record.numero_oac
                : tipo === 'Reclamo' && record.numero_reclamo
                  ? `Reclamo ${record.numero_reclamo}`
                  : tipo === 'OT' && record.numero_ot
                    ? `OT ${record.numero_ot}`
                    : record.numero_sac
                      ? `SAC ${record.numero_sac}`
                      : record.numero_reclamo
                        ? `Reclamo ${record.numero_reclamo}`
                        : record.numero_ot
                          ? `OT ${record.numero_ot}`
                          : record.numero_oac || `#${record.id}`;

    const operarios: string[] = Array.isArray(record.operarios) ? record.operarios : [];
    const camposDudosos: string[] = Array.isArray(record.campos_dudosos)
        ? record.campos_dudosos
        : [];
    const correcciones: string[] = Array.isArray(record.correcciones_realizadas)
        ? record.correcciones_realizadas
        : [];
    const notasArr: string[] = Array.isArray(record.notas) ? record.notas : [];

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => navigate({ to: '/history' })}>
                            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                        </Button>
                        <h1 className="text-2xl font-semibold">{identificador}</h1>
                    </div>
                    <p className="text-muted-foreground ml-11 text-sm">
                        Procesado {formatDateTime(record.created_at)} · Archivo:{' '}
                        {record.archivo_origen}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <EstadoBadge estado={record.estado_carga} />
                    <ConfianzaBadge confianza={record.confianza_global} />
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
                {record.archivo_destino && (
                    <Button variant="outline" size="sm" onClick={handlePreview}>
                        Previsualizar PDF
                    </Button>
                )}
                {!record.sellado && record.archivo_destino && record.fecha && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStamp}
                        disabled={stampLoading}>
                        {stampLoading ? (
                            <>
                                <HugeiconsIcon
                                    icon={Loading03Icon}
                                    strokeWidth={2}
                                    className="size-4 animate-spin"
                                />
                                Sellando...
                            </>
                        ) : (
                            'Sellar PDF'
                        )}
                    </Button>
                )}
                {record.sellado && (
                    <Badge variant="outline" className="text-xs">
                        Sellado: {record.sellado.toUpperCase()}
                    </Badge>
                )}
                {!editing ? (
                    <Button variant="outline" size="sm" onClick={startEditing}>
                        Editar datos
                    </Button>
                ) : (
                    <>
                        <Button size="sm" onClick={saveEdits} disabled={saving}>
                            {saving ? (
                                <>
                                    <HugeiconsIcon
                                        icon={Loading03Icon}
                                        strokeWidth={2}
                                        className="size-4 animate-spin"
                                    />
                                    Guardando...
                                </>
                            ) : (
                                'Guardar cambios'
                            )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={saving}>
                            Cancelar
                        </Button>
                    </>
                )}
                {record.archivo_destino && (
                    <Button variant="outline" size="sm" onClick={openRename}>
                        Renombrar archivo
                    </Button>
                )}
            </div>

            {actionError && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                    <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4" />
                    {actionError}
                </div>
            )}

            <Separator />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Encabezado */}
                <SectionCard
                    title="Encabezado"
                    icon={<HugeiconsIcon icon={FileXIcon} strokeWidth={2} className="size-4" />}>
                    <div className="grid grid-cols-2 gap-4">
                        <EditableField
                            label="Tipo de Orden"
                            value={editing ? editForm.tipo_orden : record.tipo_orden}
                            editing={editing}
                            field="tipo_orden"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Empresa"
                            value={editing ? editForm.empresa : record.empresa}
                            editing={editing}
                            field="empresa"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Fecha"
                            value={editing ? editForm.fecha : record.fecha}
                            editing={editing}
                            field="fecha"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Nº SAC"
                            value={editing ? editForm.numero_sac : record.numero_sac}
                            editing={editing}
                            field="numero_sac"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Nº OT"
                            value={editing ? editForm.numero_ot : record.numero_ot}
                            editing={editing}
                            field="numero_ot"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Nº Reclamo"
                            value={editing ? editForm.numero_reclamo : record.numero_reclamo}
                            editing={editing}
                            field="numero_reclamo"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Nº OAC"
                            value={editing ? editForm.numero_oac : record.numero_oac}
                            editing={editing}
                            field="numero_oac"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Usuario"
                            value={editing ? editForm.usuario_nombre : record.usuario_nombre}
                            editing={editing}
                            field="usuario_nombre"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Suministro"
                            value={editing ? editForm.suministro_nro : record.suministro_nro}
                            editing={editing}
                            field="suministro_nro"
                            onChange={updateField}
                        />
                    </div>
                </SectionCard>

                {/* Ubicación */}
                <SectionCard
                    title="Ubicación"
                    icon={
                        <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-4" />
                    }>
                    <div className="grid grid-cols-2 gap-4">
                        <EditableField
                            label="Dirección"
                            value={editing ? editForm.direccion : record.direccion}
                            editing={editing}
                            field="direccion"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Barrio / Villa"
                            value={editing ? editForm.barrio_villa : record.barrio_villa}
                            editing={editing}
                            field="barrio_villa"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Departamento"
                            value={editing ? editForm.departamento : record.departamento}
                            editing={editing}
                            field="departamento"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Localidad"
                            value={editing ? editForm.localidad : record.localidad}
                            editing={editing}
                            field="localidad"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Latitud"
                            value={editing ? editForm.latitud : record.latitud}
                            editing={editing}
                            field="latitud"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Longitud"
                            value={editing ? editForm.longitud : record.longitud}
                            editing={editing}
                            field="longitud"
                            onChange={updateField}
                        />
                    </div>
                </SectionCard>

                {/* Detalle Técnico */}
                <SectionCard
                    title="Detalle Técnico"
                    icon={<HugeiconsIcon icon={Wrench01Icon} strokeWidth={2} className="size-4" />}>
                    <div className="grid grid-cols-2 gap-4">
                        <EditableField
                            label="Motivo Reclamo"
                            value={editing ? editForm.motivo_reclamo : record.motivo_reclamo}
                            editing={editing}
                            field="motivo_reclamo"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Descripción Falla"
                            value={editing ? editForm.descripcion_falla : record.descripcion_falla}
                            editing={editing}
                            field="descripcion_falla"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Ubicación Falla"
                            value={editing ? editForm.ubicacion_falla : record.ubicacion_falla}
                            editing={editing}
                            field="ubicacion_falla"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Código Trabajo"
                            value={editing ? editForm.codigo_trabajo : record.codigo_trabajo}
                            editing={editing}
                            field="codigo_trabajo"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Tipo Instalación"
                            value={editing ? editForm.tipo_instalacion : record.tipo_instalacion}
                            editing={editing}
                            field="tipo_instalacion"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Elementos Afectados"
                            value={
                                editing ? editForm.elementos_afectados : record.elementos_afectados
                            }
                            editing={editing}
                            field="elementos_afectados"
                            onChange={updateField}
                        />
                    </div>
                </SectionCard>

                {/* Informe de Campo */}
                <SectionCard
                    title="Informe de Campo"
                    icon={<HugeiconsIcon icon={NoteIcon} strokeWidth={2} className="size-4" />}>
                    <div className="flex flex-col gap-4">
                        <EditableField
                            label="Descripción Manuscrita"
                            value={
                                editing
                                    ? editForm.descripcion_manuscrita
                                    : record.descripcion_manuscrita
                            }
                            editing={editing}
                            field="descripcion_manuscrita"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Trabajos Realizados"
                            value={
                                editing ? editForm.trabajos_realizados : record.trabajos_realizados
                            }
                            editing={editing}
                            field="trabajos_realizados"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Trabajos Pendientes"
                            value={
                                editing ? editForm.trabajos_pendientes : record.trabajos_pendientes
                            }
                            editing={editing}
                            field="trabajos_pendientes"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Materiales Utilizados"
                            value={
                                editing
                                    ? editForm.materiales_utilizados
                                    : record.materiales_utilizados
                            }
                            editing={editing}
                            field="materiales_utilizados"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Apertura Puesto Medición"
                            value={
                                editing
                                    ? editForm.apertura_puesto_medicion
                                    : record.apertura_puesto_medicion
                            }
                            editing={editing}
                            field="apertura_puesto_medicion"
                            onChange={updateField}
                        />
                    </div>
                </SectionCard>

                {/* Cierre */}
                <SectionCard
                    title="Cierre"
                    icon={
                        <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} className="size-4" />
                    }>
                    <div className="grid grid-cols-2 gap-4">
                        <EditableField
                            label="Contratista"
                            value={
                                editing ? editForm.empresa_contratista : record.empresa_contratista
                            }
                            editing={editing}
                            field="empresa_contratista"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Estado Cierre"
                            value={editing ? editForm.estado_cierre : record.estado_cierre}
                            editing={editing}
                            field="estado_cierre"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Hora Inicio"
                            value={editing ? editForm.hora_inicio : record.hora_inicio}
                            editing={editing}
                            field="hora_inicio"
                            onChange={updateField}
                        />
                        <EditableField
                            label="Hora Fin"
                            value={editing ? editForm.hora_fin : record.hora_fin}
                            editing={editing}
                            field="hora_fin"
                            onChange={updateField}
                        />
                        <div className="col-span-2">
                            <EditableField
                                label="Operarios"
                                value={
                                    editing
                                        ? editForm.operarios
                                        : operarios.length > 0
                                          ? operarios.join(', ')
                                          : null
                                }
                                editing={editing}
                                field="operarios"
                                onChange={updateField}
                            />
                        </div>
                        <div className="col-span-2">
                            <EditableField
                                label="Observaciones"
                                value={
                                    editing
                                        ? editForm.observaciones_cierre
                                        : record.observaciones_cierre
                                }
                                editing={editing}
                                field="observaciones_cierre"
                                onChange={updateField}
                            />
                        </div>
                    </div>
                </SectionCard>

                {/* Metadata IA */}
                <SectionCard
                    title="Notas de IA"
                    icon={<HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-4" />}>
                    <div className="flex flex-col gap-3">
                        {camposDudosos.length > 0 && (
                            <div>
                                <span className="text-muted-foreground text-xs">
                                    Campos Dudosos
                                </span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {camposDudosos.map((c, i) => (
                                        <Badge key={i} variant="outline" className="text-xs">
                                            {c}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                        {correcciones.length > 0 && (
                            <div>
                                <span className="text-muted-foreground text-xs">
                                    Correcciones Realizadas
                                </span>
                                <ul className="mt-1 list-inside list-disc text-sm">
                                    {correcciones.map((c, i) => (
                                        <li key={i}>{c}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {notasArr.length > 0 && (
                            <div>
                                <span className="text-muted-foreground text-xs">Notas</span>
                                <ul className="mt-1 list-inside list-disc text-sm">
                                    {notasArr.map((n, i) => (
                                        <li key={i}>{n}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {camposDudosos.length === 0 &&
                            correcciones.length === 0 &&
                            notasArr.length === 0 && (
                                <p className="text-muted-foreground text-sm">
                                    Sin notas adicionales.
                                </p>
                            )}
                    </div>
                </SectionCard>
            </div>

            {/* Archivo destino */}
            {record.archivo_destino && (
                <div className="text-muted-foreground text-xs">
                    Archivo destino: <span className="font-mono">{record.archivo_destino}</span>
                </div>
            )}

            {/* Preview PDF Dialog */}
            <Dialog
                open={previewOpen}
                onOpenChange={(open) => {
                    setPreviewOpen(open);
                    if (!open && pdfUrl) {
                        URL.revokeObjectURL(pdfUrl);
                        setPdfUrl(null);
                    }
                }}>
                <DialogContent className="flex h-[85vh] flex-col sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Vista previa: {record.archivo_origen}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden">
                        {loadingPdf ? (
                            <div className="flex h-full items-center justify-center">
                                <HugeiconsIcon
                                    icon={Loading03Icon}
                                    strokeWidth={2}
                                    className="size-6 animate-spin"
                                />
                            </div>
                        ) : pdfUrl ? (
                            <iframe
                                src={pdfUrl}
                                className="h-full w-full rounded border"
                                title="Vista previa PDF"
                            />
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Rename Dialog */}
            <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Renombrar archivo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1">
                            <Label>Nuevo nombre</Label>
                            <div className="flex items-center gap-1">
                                <Input
                                    value={newFilename}
                                    onChange={(e) => setNewFilename(e.target.value)}
                                    placeholder="nombre-del-archivo"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRename();
                                    }}
                                />
                                <span className="text-muted-foreground text-sm">.pdf</span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="ghost" disabled={renaming}>
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button onClick={handleRename} disabled={renaming || !newFilename.trim()}>
                            {renaming ? (
                                <>
                                    <HugeiconsIcon
                                        icon={Loading03Icon}
                                        strokeWidth={2}
                                        className="size-4 animate-spin"
                                    />
                                    Renombrando...
                                </>
                            ) : (
                                'Renombrar'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

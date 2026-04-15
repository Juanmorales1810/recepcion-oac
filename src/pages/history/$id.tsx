import { useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { invoke } from '@tauri-apps/api/core';
import type { OacRecord } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
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

    useEffect(() => {
        (async () => {
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
        })();
    }, [id]);

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

            <Separator />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Encabezado */}
                <SectionCard
                    title="Encabezado"
                    icon={<HugeiconsIcon icon={FileXIcon} strokeWidth={2} className="size-4" />}>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Tipo de Orden" value={record.tipo_orden} />
                        <Field label="Empresa" value={record.empresa} />
                        <Field label="Fecha" value={record.fecha} />
                        <Field label="Nº SAC" value={record.numero_sac} />
                        <Field label="Nº OT" value={record.numero_ot} />
                        <Field label="Nº Reclamo" value={record.numero_reclamo} />
                        <Field label="Nº OAC" value={record.numero_oac} />
                        <Field label="Usuario" value={record.usuario_nombre} />
                        <Field label="Suministro" value={record.suministro_nro} />
                    </div>
                </SectionCard>

                {/* Ubicación */}
                <SectionCard
                    title="Ubicación"
                    icon={
                        <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-4" />
                    }>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Dirección" value={record.direccion} />
                        <Field label="Barrio / Villa" value={record.barrio_villa} />
                        <Field label="Departamento" value={record.departamento} />
                        <Field label="Localidad" value={record.localidad} />
                        <Field label="Latitud" value={record.latitud} />
                        <Field label="Longitud" value={record.longitud} />
                    </div>
                </SectionCard>

                {/* Detalle Técnico */}
                <SectionCard
                    title="Detalle Técnico"
                    icon={<HugeiconsIcon icon={Wrench01Icon} strokeWidth={2} className="size-4" />}>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Motivo Reclamo" value={record.motivo_reclamo} />
                        <Field label="Descripción Falla" value={record.descripcion_falla} />
                        <Field label="Ubicación Falla" value={record.ubicacion_falla} />
                        <Field label="Código Trabajo" value={record.codigo_trabajo} />
                        <Field label="Tipo Instalación" value={record.tipo_instalacion} />
                        <Field label="Elementos Afectados" value={record.elementos_afectados} />
                    </div>
                </SectionCard>

                {/* Informe de Campo */}
                <SectionCard
                    title="Informe de Campo"
                    icon={<HugeiconsIcon icon={NoteIcon} strokeWidth={2} className="size-4" />}>
                    <div className="flex flex-col gap-4">
                        <Field
                            label="Descripción Manuscrita"
                            value={record.descripcion_manuscrita}
                        />
                        <Field label="Trabajos Realizados" value={record.trabajos_realizados} />
                        <Field label="Trabajos Pendientes" value={record.trabajos_pendientes} />
                        <Field label="Materiales Utilizados" value={record.materiales_utilizados} />
                        <Field
                            label="Apertura Puesto Medición"
                            value={record.apertura_puesto_medicion}
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
                        <Field label="Contratista" value={record.empresa_contratista} />
                        <Field label="Estado Cierre" value={record.estado_cierre} />
                        <Field label="Hora Inicio" value={record.hora_inicio} />
                        <Field label="Hora Fin" value={record.hora_fin} />
                        <div className="col-span-2">
                            <Field
                                label="Operarios"
                                value={operarios.length > 0 ? operarios.join(', ') : null}
                            />
                        </div>
                        <div className="col-span-2">
                            <Field label="Observaciones" value={record.observaciones_cierre} />
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
        </div>
    );
}

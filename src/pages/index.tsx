import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoaderPinwheelIcon } from '@hugeicons/core-free-icons';
import { createFileRoute } from '@tanstack/react-router';
import { ScrollArea } from '@/components/ui/scroll-area';
import { invoke, Channel } from '@tauri-apps/api/core';
import { Progress } from '@/components/ui/progress';
import { open } from '@tauri-apps/plugin-dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/')({
    component: HomePage,
});

type OacData = {
    metadata: {
        confianza_global: string | null;
        campos_dudosos: string[];
        correcciones_realizadas: string[];
        notas: string[];
    };
    encabezado: {
        tipo_orden: string | null;
        empresa: string | null;
        numero_sac: string | null;
        numero_ot: string | null;
        numero_reclamo: string | null;
        numero_oac: string | null;
        fecha: string | null;
        usuario_nombre: string | null;
        suministro_nro: string | null;
    };
    ubicacion: {
        direccion: string | null;
        barrio_villa: string | null;
        departamento: string | null;
        localidad: string | null;
        coordenadas: {
            latitud: number | null;
            longitud: number | null;
        };
    };
    detalle_tecnico: {
        motivo_reclamo: string | null;
        descripcion_falla: string | null;
        ubicacion_falla: string | null;
        codigo_trabajo: string | null;
        tipo_instalacion: string | null;
        elementos_afectados: string | null;
    };
    informe_campo: {
        descripcion_manuscrita: string | null;
        trabajos_realizados: string | null;
        trabajos_pendientes: string | null;
        materiales_utilizados: string | null;
        apertura_puesto_medicion: string | null;
    };
    cierre: {
        empresa_contratista: string | null;
        operarios: string[];
        hora_inicio: string | null;
        hora_fin: string | null;
        estado_cierre: string | null;
        observaciones_cierre: string | null;
    };
};

type ProcessEvent =
    | { event: 'Started'; data: { total: number } }
    | { event: 'Processing'; data: { filename: string; index: number } }
    | { event: 'Extracted'; data: { filename: string; oac: OacData } }
    | { event: 'Saved'; data: { filename: string; estado_carga: string } }
    | { event: 'Stamped'; data: { filename: string; color: string } }
    | {
          event: 'Moved';
          data: {
              filename: string;
              new_path: string;
              claim_number: string;
              date_folder: string;
          };
      }
    | { event: 'Error'; data: { filename: string; error: string } }
    | { event: 'Complete'; data: { processed: number; errors: number } };

type LogEntry = {
    type: 'info' | 'success' | 'error' | 'warning';
    message: string;
    timestamp: string;
};

type ExtractedResult = {
    filename: string;
    oac: OacData;
    estado_carga: string | null;
};

function HomePage() {
    const [sourceFolder, setSourceFolder] = useState('');
    const [outputFolder, setOutputFolder] = useState('');
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [currentFile, setCurrentFile] = useState('');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [completed, setCompleted] = useState(false);
    const [results, setResults] = useState<ExtractedResult[]>([]);
    const [expandedResult, setExpandedResult] = useState<number | null>(null);

    const addLog = useCallback((type: LogEntry['type'], message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs((prev) => [...prev, { type, message, timestamp }]);
    }, []);

    const selectSourceFolder = async () => {
        const folder = await open({
            directory: true,
            title: 'Seleccionar carpeta de PDFs',
        });
        if (folder) setSourceFolder(folder);
    };

    const selectOutputFolder = async () => {
        const folder = await open({
            directory: true,
            title: 'Seleccionar carpeta de salida',
        });
        if (folder) setOutputFolder(folder);
    };

    const handleProcess = async () => {
        if (!sourceFolder || !outputFolder) return;

        setProcessing(true);
        setCompleted(false);
        setLogs([]);
        setResults([]);
        setProgress(0);
        setTotal(0);
        setCurrentFile('');
        setExpandedResult(null);

        const channel = new Channel<ProcessEvent>();
        channel.onmessage = (msg: ProcessEvent) => {
            console.log('[Channel] event:', msg.event, msg);
            switch (msg.event) {
                case 'Started':
                    setTotal(msg.data.total);
                    addLog('info', `Iniciando procesamiento de ${msg.data.total} archivos PDF...`);
                    break;
                case 'Processing':
                    setCurrentFile(msg.data.filename);
                    setProgress(msg.data.index + 1);
                    addLog('info', `Procesando: ${msg.data.filename}`);
                    break;
                case 'Extracted': {
                    const { oac } = msg.data;
                    const tipoLabel = oac.encabezado.tipo_orden || '?';
                    const id =
                        oac.encabezado.numero_sac ||
                        oac.encabezado.numero_reclamo ||
                        oac.encabezado.numero_ot ||
                        oac.encabezado.numero_oac ||
                        '?';
                    const conf = oac.metadata?.confianza_global || '?';
                    addLog(
                        'success',
                        `OCR: ${msg.data.filename} → ${tipoLabel}: ${id}, Fecha: ${oac.encabezado.fecha ?? '?'}, Confianza: ${conf}`
                    );
                    setResults((prev) => [
                        ...prev,
                        { filename: msg.data.filename, oac: msg.data.oac, estado_carga: null },
                    ]);
                    break;
                }
                case 'Moved':
                    addLog(
                        'success',
                        `✓ ${msg.data.filename} → ${msg.data.date_folder}/${msg.data.claim_number}.pdf`
                    );
                    break;
                case 'Stamped':
                    addLog(
                        'success',
                        `🔖 ${msg.data.filename} → Sellado: ${msg.data.color.toUpperCase()}`
                    );
                    break;
                case 'Saved':
                    addLog(
                        'success',
                        `DB: ${msg.data.filename} → estado: ${msg.data.estado_carga}`
                    );
                    setResults((prev) =>
                        prev.map((r) =>
                            r.filename === msg.data.filename
                                ? { ...r, estado_carga: msg.data.estado_carga }
                                : r
                        )
                    );
                    break;
                case 'Error':
                    addLog('error', `✗ ${msg.data.filename}: ${msg.data.error}`);
                    break;
                case 'Complete':
                    setCompleted(true);
                    setProcessing(false);
                    setProgress(msg.data.processed + msg.data.errors);
                    addLog(
                        'info',
                        `Completado: ${msg.data.processed} procesados, ${msg.data.errors} errores.`
                    );
                    break;
                default:
                    console.warn('[Channel] Evento desconocido:', msg);
            }
        };

        try {
            console.log('[DEBUG] Invocando process_pdfs, channel id:', channel.id);
            await invoke('process_pdfs', {
                sourceFolder,
                outputFolder,
                onEvent: channel,
            });
            console.log('[DEBUG] process_pdfs finalizado');
        } catch (err) {
            console.error('[DEBUG] process_pdfs error:', err);
            addLog('error', `Error: ${err}`);
        } finally {
            setProcessing((prev) => {
                if (prev) {
                    addLog('info', 'Procesamiento finalizado.');
                    setCompleted(true);
                }
                return false;
            });
        }
    };

    const canProcess = sourceFolder && outputFolder && !processing;

    return (
        <main className="p-6">
            <div className="mx-auto max-w-4xl space-y-6">
                <div>
                    <h1 className="font-heading text-3xl font-bold">Recepción OAC</h1>
                    <p className="text-muted-foreground">
                        Procesamiento OCR de PDFs escaneados con Google Gemini AI
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Configuración</CardTitle>
                        <CardDescription>
                            Selecciona las carpetas de origen y salida. Las API Keys se leen del
                            archivo <code>.env</code>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Carpeta de PDFs (origen)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={sourceFolder}
                                        placeholder="Seleccionar carpeta..."
                                        readOnly
                                        className="flex-1"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={selectSourceFolder}
                                        disabled={processing}>
                                        Explorar
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Carpeta de salida</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={outputFolder}
                                        placeholder="Seleccionar carpeta..."
                                        readOnly
                                        className="flex-1"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={selectOutputFolder}
                                        disabled={processing}>
                                        Explorar
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full"
                            size="lg"
                            onClick={handleProcess}
                            disabled={!canProcess}>
                            {processing ? (
                                <>
                                    Procesando{' '}
                                    <HugeiconsIcon
                                        icon={LoaderPinwheelIcon}
                                        className="mr-2 animate-spin"
                                    />
                                </>
                            ) : (
                                'Iniciar Procesamiento'
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {(processing || completed || logs.length > 0) && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Progreso
                                {processing && <Badge variant="secondary">En proceso</Badge>}
                                {completed && <Badge variant="default">Completado</Badge>}
                            </CardTitle>
                            {total > 0 && (
                                <CardDescription>
                                    {currentFile && processing
                                        ? `Procesando: ${currentFile}`
                                        : `${progress} de ${total} archivos`}
                                </CardDescription>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {total > 0 && (
                                <Progress value={total > 0 ? (progress / total) * 100 : 0} />
                            )}

                            <ScrollArea className="h-48 rounded-md border p-4">
                                <div className="space-y-1 font-mono text-xs">
                                    {logs.map((log, i) => (
                                        <div
                                            key={i}
                                            className={`flex gap-2 ${
                                                log.type === 'error'
                                                    ? 'text-destructive'
                                                    : log.type === 'success'
                                                      ? 'text-primary'
                                                      : log.type === 'warning'
                                                        ? 'text-yellow-600'
                                                        : 'text-muted-foreground'
                                            }`}>
                                            <span className="text-muted-foreground shrink-0">
                                                [{log.timestamp}]
                                            </span>
                                            <span>{log.message}</span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}

                {results.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Resultados Extraídos ({results.length})</CardTitle>
                            <CardDescription>
                                Datos estructurados obtenidos de cada PDF
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {results.map((r, i) => (
                                <OacResultCard
                                    key={i}
                                    result={r}
                                    expanded={expandedResult === i}
                                    onToggle={() =>
                                        setExpandedResult(expandedResult === i ? null : i)
                                    }
                                />
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}

function OacResultCard({
    result,
    expanded,
    onToggle,
}: {
    result: ExtractedResult;
    expanded: boolean;
    onToggle: () => void;
}) {
    const { oac } = result;
    const claimId =
        oac.encabezado.numero_sac ||
        oac.encabezado.numero_reclamo ||
        oac.encabezado.numero_ot ||
        oac.encabezado.numero_oac ||
        '—';
    const confidence = oac.metadata.confianza_global || '?';

    const confidenceBadge = {
        alta: 'default' as const,
        media: 'secondary' as const,
        baja: 'destructive' as const,
    };

    const estadoCargaBadge = {
        pendiente: 'secondary' as const,
        enviado: 'default' as const,
        error_carga: 'destructive' as const,
    };

    return (
        <div className="rounded-md border">
            <button
                type="button"
                onClick={onToggle}
                className="hover:bg-muted/50 flex w-full items-center justify-between p-3 text-left text-sm">
                <div className="flex items-center gap-3">
                    <span className="font-medium">{result.filename}</span>
                    <Badge variant="outline">
                        {oac.encabezado.tipo_orden || (oac.encabezado.numero_sac ? 'SAC' : 'OT')}:{' '}
                        {claimId}
                    </Badge>
                    <span className="text-muted-foreground">
                        {oac.encabezado.fecha ?? 'Sin fecha'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {result.estado_carga && (
                        <Badge
                            variant={
                                estadoCargaBadge[
                                    result.estado_carga as keyof typeof estadoCargaBadge
                                ] ?? 'secondary'
                            }>
                            {result.estado_carga}
                        </Badge>
                    )}
                    <Badge
                        variant={
                            confidenceBadge[confidence as keyof typeof confidenceBadge] ??
                            'secondary'
                        }>
                        {confidence}
                    </Badge>
                </div>
            </button>

            {expanded && (
                <div className="border-t px-4 py-3">
                    <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                        <FieldGroup title="Encabezado">
                            <Field label="Tipo" value={oac.encabezado.tipo_orden} />
                            <Field label="Empresa" value={oac.encabezado.empresa} />
                            <Field label="SAC" value={oac.encabezado.numero_sac} />
                            <Field label="OT" value={oac.encabezado.numero_ot} />
                            <Field label="Reclamo" value={oac.encabezado.numero_reclamo} />
                            <Field label="OAC" value={oac.encabezado.numero_oac} />
                            <Field label="Fecha" value={oac.encabezado.fecha} />
                            <Field label="Usuario" value={oac.encabezado.usuario_nombre} />
                            <Field label="Suministro" value={oac.encabezado.suministro_nro} />
                        </FieldGroup>

                        <FieldGroup title="Ubicación">
                            <Field label="Dirección" value={oac.ubicacion.direccion} />
                            <Field label="Barrio" value={oac.ubicacion.barrio_villa} />
                            <Field label="Departamento" value={oac.ubicacion.departamento} />
                            <Field label="Localidad" value={oac.ubicacion.localidad} />
                            <Field
                                label="Coordenadas"
                                value={
                                    oac.ubicacion.coordenadas.latitud != null &&
                                    oac.ubicacion.coordenadas.longitud != null
                                        ? `${oac.ubicacion.coordenadas.latitud}, ${oac.ubicacion.coordenadas.longitud}`
                                        : null
                                }
                            />
                        </FieldGroup>

                        <FieldGroup title="Detalle Técnico">
                            <Field label="Motivo" value={oac.detalle_tecnico.motivo_reclamo} />
                            <Field label="Falla" value={oac.detalle_tecnico.descripcion_falla} />
                            <Field
                                label="Ubicación falla"
                                value={oac.detalle_tecnico.ubicacion_falla}
                            />
                            <Field
                                label="Cód. trabajo"
                                value={oac.detalle_tecnico.codigo_trabajo}
                            />
                            <Field
                                label="Instalación"
                                value={oac.detalle_tecnico.tipo_instalacion}
                            />
                            <Field
                                label="Elementos"
                                value={oac.detalle_tecnico.elementos_afectados}
                            />
                        </FieldGroup>

                        <FieldGroup title="Informe de Campo">
                            <Field
                                label="Descripción"
                                value={oac.informe_campo.descripcion_manuscrita}
                            />
                            <Field label="Trabajos" value={oac.informe_campo.trabajos_realizados} />
                            <Field
                                label="Pendientes"
                                value={oac.informe_campo.trabajos_pendientes}
                            />
                            <Field
                                label="Materiales"
                                value={oac.informe_campo.materiales_utilizados}
                            />
                        </FieldGroup>

                        <FieldGroup title="Cierre">
                            <Field label="Contratista" value={oac.cierre.empresa_contratista} />
                            <Field
                                label="Operarios"
                                value={
                                    oac.cierre.operarios.length > 0
                                        ? oac.cierre.operarios.join(', ')
                                        : null
                                }
                            />
                            <Field label="Hora inicio" value={oac.cierre.hora_inicio} />
                            <Field label="Hora fin" value={oac.cierre.hora_fin} />
                            <Field label="Estado" value={oac.cierre.estado_cierre} />
                            <Field label="Observaciones" value={oac.cierre.observaciones_cierre} />
                        </FieldGroup>

                        {(oac.metadata.notas.length > 0 ||
                            oac.metadata.campos_dudosos.length > 0) && (
                            <FieldGroup title="Notas IA">
                                {oac.metadata.campos_dudosos.length > 0 && (
                                    <Field
                                        label="Dudosos"
                                        value={oac.metadata.campos_dudosos.join(', ')}
                                    />
                                )}
                                {oac.metadata.correcciones_realizadas.length > 0 && (
                                    <Field
                                        label="Correcciones"
                                        value={oac.metadata.correcciones_realizadas.join(', ')}
                                    />
                                )}
                                {oac.metadata.notas.map((n, i) => (
                                    <Field key={i} label={`Nota ${i + 1}`} value={n} />
                                ))}
                            </FieldGroup>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <h4 className="font-heading text-foreground text-xs font-semibold">{title}</h4>
            <div className="space-y-1">{children}</div>
        </div>
    );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="flex gap-2">
            <span className="text-muted-foreground shrink-0">{label}:</span>
            <span className={value ? 'text-foreground' : 'text-muted-foreground/50'}>
                {value || '—'}
            </span>
        </div>
    );
}

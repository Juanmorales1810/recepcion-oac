import { useState, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { invoke, Channel } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export const Route = createFileRoute('/')({
    component: HomePage,
});

type ProcessEvent =
    | { event: 'Started'; data: { total: number } }
    | {
          event: 'Processing';
          data: { filename: string; index: number };
      }
    | {
          event: 'OcrResult';
          data: {
              filename: string;
              claim_number: string | null;
              date: string | null;
              text_preview: string;
          };
      }
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

function HomePage() {
    const [apiKey, setApiKey] = useState('');
    const [sourceFolder, setSourceFolder] = useState('');
    const [outputFolder, setOutputFolder] = useState('');
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [currentFile, setCurrentFile] = useState('');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [completed, setCompleted] = useState(false);

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
        if (!apiKey || !sourceFolder || !outputFolder) return;

        setProcessing(true);
        setCompleted(false);
        setLogs([]);
        setProgress(0);
        setTotal(0);
        setCurrentFile('');

        const channel = new Channel<ProcessEvent>();
        channel.onmessage = (msg) => {
            switch (msg.event) {
                case 'Started':
                    setTotal(msg.data.total);
                    addLog('info', `Iniciando procesamiento de ${msg.data.total} archivos PDF...`);
                    break;
                case 'Processing':
                    setCurrentFile(msg.data.filename);
                    setProgress(msg.data.index);
                    addLog('info', `Procesando: ${msg.data.filename}`);
                    break;
                case 'OcrResult':
                    if (msg.data.claim_number && msg.data.date) {
                        addLog(
                            'success',
                            `OCR: ${msg.data.filename} → Reclamo: ${msg.data.claim_number}, Fecha: ${msg.data.date}`
                        );
                    } else {
                        addLog(
                            'warning',
                            `OCR: ${msg.data.filename} → ${!msg.data.claim_number ? 'Sin nro. reclamo' : ''} ${!msg.data.date ? 'Sin fecha' : ''}`
                        );
                    }
                    break;
                case 'Moved':
                    addLog(
                        'success',
                        `✓ ${msg.data.filename} → ${msg.data.date_folder}/${msg.data.claim_number}.pdf`
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
            }
        };

        try {
            await invoke('process_pdfs', {
                sourceFolder,
                outputFolder,
                apiKey,
                onEvent: channel,
            });
        } catch (err) {
            addLog('error', `Error: ${err}`);
            setProcessing(false);
        }
    };

    const canProcess = apiKey && sourceFolder && outputFolder && !processing;

    return (
        <main className="min-h-screen p-6">
            <div className="mx-auto max-w-3xl space-y-6">
                <div>
                    <h1 className="font-heading text-3xl font-bold">Recepción OAC</h1>
                    <p className="text-muted-foreground">
                        Procesamiento OCR de PDFs escaneados con Google Vision AI
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Configuración</CardTitle>
                        <CardDescription>
                            Configura la API Key de Google Cloud Vision y las carpetas de trabajo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="api-key">Google Cloud Vision API Key</Label>
                            <Input
                                id="api-key"
                                type="password"
                                placeholder="AIza..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                disabled={processing}
                            />
                        </div>

                        <Separator />

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
                            {processing ? 'Procesando...' : 'Iniciar Procesamiento'}
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

                            <ScrollArea className="h-64 rounded-md border p-4">
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
            </div>
        </main>
    );
}

import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Loading03Icon,
    FolderOpenIcon,
    CheckmarkCircle01Icon,
    AlertCircleIcon,
} from '@hugeicons/core-free-icons';

export const Route = createFileRoute('/settings/')({
    component: SettingsPage,
});

type AppSettings = {
    enable_stamping: boolean;
    rename_only: boolean;
    default_source_folder: string | null;
    default_output_folder: string | null;
};

function SettingsPage() {
    const [settings, setSettings] = useState<AppSettings>({
        enable_stamping: true,
        rename_only: false,
        default_source_folder: null,
        default_output_folder: null,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await invoke<AppSettings>('get_app_settings');
                setSettings(data);
            } catch (e) {
                setError(String(e));
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        setError(null);
        try {
            await invoke('save_app_settings', { settings });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            setError(String(e));
        } finally {
            setSaving(false);
        }
    };

    const selectSourceFolder = async () => {
        const folder = await open({
            directory: true,
            title: 'Seleccionar carpeta de entrada predefinida',
        });
        if (folder) {
            setSettings((prev) => ({ ...prev, default_source_folder: folder }));
        }
    };

    const selectOutputFolder = async () => {
        const folder = await open({
            directory: true,
            title: 'Seleccionar carpeta de salida predefinida',
        });
        if (folder) {
            setSettings((prev) => ({ ...prev, default_output_folder: folder }));
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
                    Cargando configuración...
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
            <div>
                <h1 className="text-2xl font-semibold">Configuración</h1>
                <p className="text-muted-foreground text-sm">
                    Ajustes generales del procesamiento de OAC
                </p>
            </div>

            <Separator />

            <div className="mx-auto w-full max-w-2xl space-y-6">
                {/* Pasos del procesamiento */}
                <Card>
                    <CardHeader>
                        <CardTitle>Procesamiento</CardTitle>
                        <CardDescription>
                            Configura qué pasos se ejecutan al procesar los PDFs
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="enable_stamping"
                                checked={settings.enable_stamping}
                                onCheckedChange={(checked) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        enable_stamping: checked === true,
                                    }))
                                }
                            />
                            <div className="space-y-0.5">
                                <Label htmlFor="enable_stamping" className="cursor-pointer">
                                    Habilitar sellado
                                </Label>
                                <p className="text-muted-foreground text-xs">
                                    Agrega un sello de color al PDF según la fecha del documento
                                </p>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="rename_only"
                                checked={settings.rename_only}
                                onCheckedChange={(checked) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        rename_only: checked === true,
                                    }))
                                }
                            />
                            <div className="space-y-0.5">
                                <Label htmlFor="rename_only" className="cursor-pointer">
                                    Solo renombrar
                                </Label>
                                <p className="text-muted-foreground text-xs">
                                    Solo renombra y mueve los archivos sin sellar ni subir a
                                    Supabase
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Carpetas predefinidas */}
                <Card>
                    <CardHeader>
                        <CardTitle>Carpetas predefinidas</CardTitle>
                        <CardDescription>
                            Define carpetas por defecto para agilizar el procesamiento
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Carpeta de entrada</Label>
                            <div className="flex gap-2">
                                <Input
                                    readOnly
                                    value={settings.default_source_folder ?? ''}
                                    placeholder="Sin carpeta predefinida"
                                    className="flex-1"
                                />
                                <Button variant="outline" size="icon" onClick={selectSourceFolder}>
                                    <HugeiconsIcon icon={FolderOpenIcon} strokeWidth={2} />
                                </Button>
                                {settings.default_source_folder && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            setSettings((prev) => ({
                                                ...prev,
                                                default_source_folder: null,
                                            }))
                                        }>
                                        Limpiar
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Carpeta de salida</Label>
                            <div className="flex gap-2">
                                <Input
                                    readOnly
                                    value={settings.default_output_folder ?? ''}
                                    placeholder="Sin carpeta predefinida"
                                    className="flex-1"
                                />
                                <Button variant="outline" size="icon" onClick={selectOutputFolder}>
                                    <HugeiconsIcon icon={FolderOpenIcon} strokeWidth={2} />
                                </Button>
                                {settings.default_output_folder && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            setSettings((prev) => ({
                                                ...prev,
                                                default_output_folder: null,
                                            }))
                                        }>
                                        Limpiar
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Acciones */}
                <div className="flex items-center gap-3">
                    <Button onClick={handleSave} disabled={saving}>
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
                            'Guardar configuración'
                        )}
                    </Button>
                    {saved && (
                        <span className="flex items-center gap-1 text-sm text-green-600">
                            <HugeiconsIcon
                                icon={CheckmarkCircle01Icon}
                                strokeWidth={2}
                                className="size-4"
                            />
                            Guardado
                        </span>
                    )}
                    {error && (
                        <span className="flex items-center gap-1 text-sm text-red-600">
                            <HugeiconsIcon
                                icon={AlertCircleIcon}
                                strokeWidth={2}
                                className="size-4"
                            />
                            {error}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

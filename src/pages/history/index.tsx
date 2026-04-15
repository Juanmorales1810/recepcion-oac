import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { invoke } from '@tauri-apps/api/core';
import { OacDataTable } from '@/components/oac-data-table';
import type { OacRecord } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon, Refresh01Icon } from '@hugeicons/core-free-icons';

export const Route = createFileRoute('/history/')({
    component: HistoryPage,
});

function HistoryPage() {
    const [records, setRecords] = useState<OacRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadRecords = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await invoke<OacRecord[]>('get_oac_records');
            setRecords(data);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
    }, []);

    return (
        <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Historial de OAC</h1>
                    <p className="text-muted-foreground text-sm">
                        Registros procesados y guardados en Supabase
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadRecords} disabled={loading}>
                    <HugeiconsIcon icon={Refresh01Icon} strokeWidth={2} />
                    Actualizar
                </Button>
            </div>

            {loading ? (
                <div className="flex flex-1 items-center justify-center">
                    <div className="text-muted-foreground flex items-center gap-2">
                        <HugeiconsIcon
                            icon={Loading03Icon}
                            strokeWidth={2}
                            className="size-5 animate-spin"
                        />
                        Cargando registros...
                    </div>
                </div>
            ) : error ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4">
                    <p className="text-destructive text-sm">{error}</p>
                    <Button variant="outline" size="sm" onClick={loadRecords}>
                        Reintentar
                    </Button>
                </div>
            ) : (
                <OacDataTable data={records} />
            )}
        </div>
    );
}

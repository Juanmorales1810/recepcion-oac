import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
    component: HomePage,
});

function HomePage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
            <h1 className="text-4xl font-bold">Recepción OAC</h1>
            <p className="text-muted-foreground">Bienvenido al sistema de recepción.</p>
        </main>
    );
}

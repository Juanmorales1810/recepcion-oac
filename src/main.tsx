import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import '@/styles/index.css';
import { ThemeProvider } from './components/theme-provider';
import { invoke } from '@tauri-apps/api/core';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <RouterProvider router={router} />
        </ThemeProvider>
    </React.StrictMode>
);

// Cerrar splash y mostrar ventana principal después del primer render de React.
// Se usa requestAnimationFrame para esperar a que el frame se pinte en pantalla.
requestAnimationFrame(() => {
    requestAnimationFrame(() => {
        invoke('close_splashscreen');
    });
});

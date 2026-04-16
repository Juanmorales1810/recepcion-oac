import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { lazy } from 'react';

const TanStackRouterDevtools = import.meta.env.DEV
    ? lazy(() =>
          import('@tanstack/router-devtools').then((mod) => ({
              default: mod.TanStackRouterDevtools,
          }))
      )
    : () => null;

export const Route = createRootRoute({
    component: RootLayout,
});

function RootLayout() {
    return (
        <TooltipProvider>
            <SidebarProvider
                style={
                    {
                        '--sidebar-width': 'calc(var(--spacing) * 72)',
                        '--header-height': 'calc(var(--spacing) * 12)',
                    } as React.CSSProperties
                }>
                <AppSidebar variant="inset" />
                <SidebarInset>
                    <SiteHeader />
                    <Outlet />
                    <TanStackRouterDevtools />
                </SidebarInset>
            </SidebarProvider>
        </TooltipProvider>
    );
}

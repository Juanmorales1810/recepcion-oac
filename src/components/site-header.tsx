import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ModeToggle } from './mode-toggle';

export function SiteHeader() {
    return (
        <header className="bg-background sticky top-2 flex h-(--header-height) shrink-0 items-center gap-2 rounded-t-2xl border-b shadow-md transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                />
                <h1 className="text-base font-medium">Recepción OAC</h1>
            </div>
            <div className="ml-auto flex items-center gap-2 px-4">
                <ModeToggle />
            </div>
        </header>
    );
}

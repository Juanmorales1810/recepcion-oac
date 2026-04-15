import * as React from 'react';

import { NavMain } from '@/components/nav-main';
import { NavSecondary } from '@/components/nav-secondary';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    Settings05Icon,
    HelpCircleIcon,
    TableIcon,
    Calendar05Icon,
    ElectricTower02Icon,
    AiFileIcon,
} from '@hugeicons/core-free-icons';

const data = {
    navMain: [
        {
            title: 'Recepción',
            url: '/',
            icon: <HugeiconsIcon icon={AiFileIcon} strokeWidth={2} />,
        },
        {
            title: 'Historial',
            url: '/history',
            icon: <HugeiconsIcon icon={TableIcon} strokeWidth={2} />,
        },
        {
            title: 'Calendario',
            url: '/calendar',
            icon: <HugeiconsIcon icon={Calendar05Icon} strokeWidth={2} />,
        },
    ],
    navSecondary: [
        {
            title: 'Configuración',
            url: '#',
            icon: <HugeiconsIcon icon={Settings05Icon} strokeWidth={2} />,
        },
        {
            title: 'Ayuda',

            url: '#',
            icon: <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} />,
        },
    ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className="data-[slot=sidebar-menu-button]:p-1.5!">
                            <a href="/">
                                <HugeiconsIcon
                                    icon={ElectricTower02Icon}
                                    strokeWidth={2}
                                    className="size-5!"
                                />
                                <span className="text-base font-semibold">Disei RSL</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
            </SidebarContent>
            <SidebarFooter>
                <NavSecondary items={data.navSecondary} className="mt-auto" />
            </SidebarFooter>
        </Sidebar>
    );
}

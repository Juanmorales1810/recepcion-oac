import CalendarApp from '@/components/calendar-app';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/calendar/')({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <div className="@container/main flex flex-1 items-center justify-center p-4 lg:p-6">
            <CalendarApp />
        </div>
    );
}

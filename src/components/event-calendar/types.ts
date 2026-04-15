export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

export interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    color?: EventColor;
    location?: string;
}

export type EventColor = 'sky' | 'amber' | 'violet' | 'rose' | 'emerald' | 'orange';

/**
 * A map of ISO date string (YYYY-MM-DD) -> boolean | null.
 * For previous-month days: true = received within first 5 business days, false/null = not received.
 * For current-month days: the presence of the key is enough (value is ignored for green/red logic).
 */
export type OacReceptionMap = Record<string, boolean | null>;

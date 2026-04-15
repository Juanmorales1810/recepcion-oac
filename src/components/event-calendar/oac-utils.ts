import {
    addDays,
    isBefore,
    isSameMonth,
    isWeekend,
    startOfDay,
    startOfMonth,
    subDays,
} from 'date-fns';

/**
 * OAC stamp types:
 * - "green": Day is within 2 business days from today (inclusive)
 * - "red": Day is a business day in the current month but outside the green window
 * - "black": Day is from previous month and current month is past the first 5 business days
 *            without OAC being received
 * - null: No stamp (weekends, future days, etc.)
 */
export type OacStamp = 'green' | 'red' | 'black' | null;

/**
 * A map of ISO date string (YYYY-MM-DD) -> boolean
 * true  = OAC was received for that day (within first 5 business days of current month)
 * false = OAC was NOT received for that day
 * absent key = no OAC tracking for that day
 */
export type OacReceptionMap = Record<string, boolean | null>;

/**
 * Returns the first N business days (Mon-Fri) of a given month.
 */
export function getFirstBusinessDaysOfMonth(date: Date, n: number): Date[] {
    const result: Date[] = [];
    let current = startOfMonth(date);

    while (result.length < n) {
        if (!isWeekend(current)) {
            result.push(new Date(current));
        }
        current = addDays(current, 1);
    }

    return result;
}

/**
 * Gets the date that is N business days before the given date (not counting today).
 * Only counts Mon-Fri as business days.
 */
function getBusinessDaysBack(from: Date, n: number): Date {
    let current = startOfDay(new Date(from));
    let count = 0;

    while (count < n) {
        current = subDays(current, 1);
        if (!isWeekend(current)) {
            count++;
        }
    }

    return current;
}

/**
 * Determines the OAC stamp color for a specific calendar day.
 *
 * Rules:
 * 1. Future days or weekends -> null (no stamp)
 * 2. GREEN: The day is today or within the last 2 business days (only business days).
 *    Example for Wednesday: Wed (today), Tue, Mon = green.
 *    Example for Monday: Mon (today), Fri (prev week), Thu (prev week) = green.
 *    Weekends are skipped (no stamp), not counted.
 * 3. RED: The day is a business day in the viewed month, before the green window,
 *    and on or after the 1st of the current month.
 * 4. BLACK: The day belongs to the previous month and was not received
 *    in the first 5 business days of the current month.
 * 5. null: anything else (weekends, future, etc.)
 *
 * @param day - The calendar day being evaluated
 * @param today - Reference for "today" (defaults to new Date())
 * @param isReceivedInPrevMonth - For previous-month days: true if the OAC was received
 *        within the first 5 business days of the current month. undefined = no tracking.
 */
export function getOacStamp(
    day: Date,
    isReceivedInPrevMonth?: boolean | null,
    today: Date = new Date()
): OacStamp {
    const todayStart = startOfDay(new Date(today));
    const dayStart = startOfDay(new Date(day));

    // Future days -> no stamp
    if (dayStart > todayStart) return null;

    // Weekends -> no stamp
    if (isWeekend(dayStart)) return null;

    // Check if day is in the previous month relative to today
    const prevMonthDate = new Date(todayStart.getFullYear(), todayStart.getMonth() - 1, 1);
    const isInPreviousMonth =
        dayStart.getMonth() === prevMonthDate.getMonth() &&
        dayStart.getFullYear() === prevMonthDate.getFullYear();

    // BLACK: previous month day
    if (isInPreviousMonth) {
        // Check if we are past the 5th business day of current month
        const first5 = getFirstBusinessDaysOfMonth(todayStart, 5);
        const fifthBusinessDay = first5[first5.length - 1];
        const pastDeadline = todayStart >= fifthBusinessDay;

        if (pastDeadline) {
            // If not received (false or null) -> black
            // If received (true) -> no stamp (it was handled)
            // If undefined (no tracking) -> black by default
            if (isReceivedInPrevMonth === true) return null;
            return 'black';
        }
        // Still within the 5 business day window -> no stamp yet
        return null;
    }

    // Only stamp days in the same month as today
    if (!isSameMonth(dayStart, todayStart)) return null;

    // Calculate the green window: today + 2 business days back
    const twoBusinessDaysBack = getBusinessDaysBack(todayStart, 2);

    // GREEN: the day is today or between today and 2 business days ago (inclusive, business days only)
    // twoBusinessDaysBack is the earliest green day
    if (dayStart >= twoBusinessDaysBack && dayStart <= todayStart) {
        return 'green';
    }

    // RED: business day in current month, before the green window
    if (isBefore(dayStart, twoBusinessDaysBack)) {
        return 'red';
    }

    return null;
}

/**
 * CSS classes for each stamp color (background circle on the day number).
 */
export function getOacStampClasses(stamp: OacStamp): string {
    switch (stamp) {
        case 'green':
            return 'bg-emerald-200 text-emerald-600 dark:bg-emerald-500 dark:text-emerald-50 group-data-today:shadow-md group-data-today:shadow-emerald-200/30';
        case 'red':
            return 'bg-red-300 text-red-600 dark:bg-red-500 dark:text-red-50';
        case 'black':
            return 'bg-zinc-900 text-white dark:bg-zinc-300 dark:text-zinc-900';
        default:
            return '';
    }
}

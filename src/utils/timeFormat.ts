/**
 * Time formatting utility that enforces 12-hour AM/PM format throughout the entire application.
 */

export function formatTimeAmPm(timestamp: number | Date | string | undefined | null): string {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number'
    ? new Date(timestamp)
    : typeof timestamp === 'string'
    ? new Date(isNaN(Number(timestamp)) ? timestamp : Number(timestamp))
    : timestamp;

  if (isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateTimeAmPm(timestamp: number | Date | string | undefined | null): string {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number'
    ? new Date(timestamp)
    : typeof timestamp === 'string'
    ? new Date(isNaN(Number(timestamp)) ? timestamp : Number(timestamp))
    : timestamp;

  if (isNaN(date.getTime())) return '';

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const timeStr = formatTimeAmPm(date);
  return `${dateStr}, ${timeStr}`;
}

export function formatDayOrAmPm(timestamp: number): { dayLabel: string; timeLabel: string } {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  let dayLabel = '';
  if (targetDay === today) {
    dayLabel = 'Today';
  } else if (targetDay === yesterday) {
    dayLabel = 'Yesterday';
  } else {
    dayLabel = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  const timeLabel = formatTimeAmPm(date);
  return { dayLabel, timeLabel };
}

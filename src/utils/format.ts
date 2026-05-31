export function formatPickup(date: Date | null): string {
  if (!date) return '?';
  return date.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function formatPrice(value: number | null): string {
  return value === null ? '?' : `${value} PLN`;
}

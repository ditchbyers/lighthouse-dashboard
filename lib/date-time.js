function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDateParts(date) {
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

export function formatDateTime(value) {
  if (!value) return 'n/a';

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return String(value);
  }

  return formatDateParts(date);
}

export function formatRunFolderDateTime(value) {
  if (!value) return 'n/a';

  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})(?:\.(\d+))?Z?$/);
  if (match) {
    const [, year, month, day, hour, minute, second, millis = '0'] = match;
    const date = new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(millis.slice(0, 3).padEnd(3, '0'))
    ));

    if (!Number.isNaN(date.valueOf())) {
      return formatDateParts(date);
    }
  }

  return formatDateTime(raw);
}
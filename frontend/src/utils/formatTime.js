import dayjs from 'dayjs';

export function formatEmailTime(dateStr) {
  const date = dayjs(dateStr);
  const now = dayjs();
  const today = now.startOf('day');
  const yesterday = today.subtract(1, 'day');
  
  const emailDay = date.startOf('day');
  
  if (emailDay.isSame(today)) {
    return `今天 ${date.format('HH:mm')}`;
  }
  
  if (emailDay.isSame(yesterday)) {
    return `昨天 ${date.format('HH:mm')}`;
  }
  
  if (date.year() === now.year()) {
    return date.format('MM-DD');
  }
  
  return date.format('YYYY-MM-DD');
}

export function formatEmailTimeFull(dateStr) {
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss');
}
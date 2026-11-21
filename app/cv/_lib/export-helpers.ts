export function formatCvPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  current?: boolean,
  language: 'id' | 'en' = 'en',
): string {
  if (!startDate && !endDate && !current) return '';

  const formatMonthOrYear = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length >= 2) {
      const monthNamesId = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'Mei',
        'Jun',
        'Jul',
        'Agu',
        'Sep',
        'Okt',
        'Nov',
        'Des',
      ];
      const monthNamesEn = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const monthNames = language === 'id' ? monthNamesId : monthNamesEn;
      const monthIdx = parseInt(parts[1], 10) - 1;
      const monthName = monthNames[monthIdx] || parts[1];
      const shortYear = parts[0].slice(-2); // e.g. 25
      return `${monthName} ${shortYear}`;
    }
    return iso;
  };

  const startFormatted = formatMonthOrYear(startDate);
  const endFormatted = current
    ? language === 'id'
      ? 'Sekarang'
      : 'Present'
    : formatMonthOrYear(endDate);

  if (startFormatted && endFormatted) {
    return `${startFormatted} – ${endFormatted}`;
  }
  return startFormatted || endFormatted;
}

export function triggerCvPrint(fullName?: string): void {
  if (typeof window === 'undefined') return;

  const originalTitle = document.title;
  const safeName = (fullName || 'Resume').trim().replace(/[^a-zA-Z0-9\s_-]/g, '');
  const today = new Date().toISOString().slice(0, 10);
  const printTitle = `Resume_${safeName.replace(/\s+/g, '_')}_${today}`;

  try {
    document.title = printTitle;
    window.print();
  } finally {
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  }
}

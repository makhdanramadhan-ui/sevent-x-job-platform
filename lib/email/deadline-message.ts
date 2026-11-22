export type DeadlineJobInfo = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workMode: string | null;
  deadline: string;
  reminderDay: 1 | 3;
  sourceUrl?: string | null;
  sourceName?: string | null;
};

export type DeadlineLinks = {
  applyUrl: string;
  profileUrl: string;
  cvUrl: string;
  unsubscribeUrl: string;
};

export type DeadlineEmail = {
  subject: string;
  html: string;
  text: string;
};

const WORK_MODE_LABELS: Record<string, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
  unknown: 'Mode kerja belum diketahui',
};

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

function safeHttpUrl(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
  } catch {
    return fallback;
  }
  return fallback;
}

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function formatDeadlineDateId(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return 'Tidak dicantumkan';
  const match = isoOrDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = match[1];
    const monthIndex = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const monthName = MONTH_NAMES_ID[monthIndex] ?? match[2];
    return `${day} ${monthName} ${year}`;
  }
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return isoOrDate;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export function calculateDaysUntilDeadline(
  deadline: string | null | undefined,
  referenceDate: string | Date = new Date(),
): number | null {
  if (!deadline || typeof deadline !== 'string') return null;
  const match = deadline.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const targetDate = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  if (Number.isNaN(targetDate.getTime())) return null;

  let refDate: Date;
  if (typeof referenceDate === 'string') {
    const refMatch = referenceDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!refMatch) return null;
    refDate = new Date(`${refMatch[1]}-${refMatch[2]}-${refMatch[3]}T00:00:00Z`);
  } else {
    const y = referenceDate.getUTCFullYear();
    const m = String(referenceDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(referenceDate.getUTCDate()).padStart(2, '0');
    refDate = new Date(`${y}-${m}-${d}T00:00:00Z`);
  }

  const diffMs = targetDate.getTime() - refDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function getEligibleReminderDay(
  deadline: string | null | undefined,
  referenceDate?: string | Date,
): 1 | 3 | null {
  const days = calculateDaysUntilDeadline(deadline, referenceDate);
  if (days === 1 || days === 3) {
    return days;
  }
  return null;
}

export function isDeadlineAlertsEnabled(preferences: unknown): boolean {
  if (!preferences || typeof preferences !== 'object') return true;
  const prefs = preferences as Record<string, unknown>;
  if (prefs.email_deadline_alerts === false) return false;
  if (prefs.email_match_alerts === false) return false;
  return true;
}

export function buildDeadlineEmail(job: DeadlineJobInfo, links: DeadlineLinks): DeadlineEmail {
  const subject = `⏳ [Pengingat Tenggat] Pendaftaran Lowongan Akan Ditutup: ${job.title} di ${job.company}`;
  const formattedDeadline = formatDeadlineDateId(job.deadline);
  const location = job.location?.trim() || 'Lokasi belum tersedia';
  const workMode = WORK_MODE_LABELS[job.workMode ?? ''] ?? 'Mode kerja belum diketahui';

  const applyUrl = safeHttpUrl(job.sourceUrl || links.applyUrl, links.applyUrl);
  const profileUrl = safeHttpUrl(links.profileUrl, links.profileUrl);
  const cvUrl = safeHttpUrl(links.cvUrl, links.cvUrl);
  const unsubscribeUrl = safeHttpUrl(links.unsubscribeUrl, links.profileUrl);

  const isH1 = job.reminderDay === 1;
  const badgeLabel = isH1 ? '⚠️ H-1: Pendaftaran Ditutup Besok!' : '⏳ H-3: Pendaftaran Ditutup dalam 3 Hari';
  const badgeBg = isH1 ? '#fee2e2' : '#fef3c7';
  const badgeColor = isH1 ? '#991b1b' : '#92400e';
  const badgeBorder = isH1 ? '#ef4444' : '#f59e0b';
  const reminderLabel = isH1 ? 'Ditutup Besok' : 'Sisa 3 Hari';

  const sourceInfo = job.sourceName ? ` · Sumber: ${escapeHtml(job.sourceName)}` : '';
  const sourceText = job.sourceName ? ` · Sumber: ${job.sourceName}` : '';

  const html = `
    <div style="max-width:600px;margin:0 auto;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;line-height:1.55;">
      <div style="margin-bottom:20px;text-align:center;">
        <span style="font-size:20px;font-weight:700;color:#2456d6;letter-spacing:-0.5px;">RakitKarier</span>
      </div>

      <div style="background:#ffffff;border:1px solid #dde4ee;border-radius:12px;padding:24px;margin-bottom:20px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:700;margin-bottom:14px;background:${badgeBg};color:${badgeColor};">
          ${badgeLabel}
        </div>

        <h1 style="margin:0 0 8px;font-size:20px;color:#172033;line-height:1.4;">${escapeHtml(job.title)}</h1>
        <p style="margin:0 0 16px;color:#506079;font-size:14px;">
          ${escapeHtml(job.company)} · ${escapeHtml(location)} · ${escapeHtml(workMode)}${sourceInfo}
        </p>

        <div style="background:#f8fafc;border-left:4px solid ${badgeBorder};padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 20px;">
          <p style="margin:0 0 4px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Tenggat Pendaftaran</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(formattedDeadline)} <span style="font-size:14px;font-weight:600;color:#b91c1c;">(${reminderLabel})</span></p>
        </div>

        <p style="margin:0 0 20px;font-size:14px;color:#334155;">
          Lowongan yang kamu simpan ini akan segera menutup pendaftarannya. Segera kirimkan lamaranmu sebelum batas waktu berakhir.
        </p>

        <div style="text-align:center;margin:24px 0 16px;">
          <a href="${escapeHtml(applyUrl)}" style="display:inline-block;background:#2456d6;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">Lamar Sekarang &rarr;</a>
        </div>
      </div>

      <div style="background:#ffffff;border:1px solid #dde4ee;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="margin:0 0 8px;font-size:16px;color:#172033;">Persiapkan Lamaranmu</h2>
        <p style="margin:0 0 12px;font-size:14px;color:#506079;">Pastikan dokumen dan profilmu sudah optimal sebelum melamar:</p>
        <ul style="margin:0;padding-left:20px;font-size:14px;color:#334155;">
          <li style="margin-bottom:6px;"><a href="${escapeHtml(cvUrl)}" style="color:#2456d6;text-decoration:none;font-weight:600;">Buat atau Perbarui CV di RakitKarier &rarr;</a></li>
          <li><a href="${escapeHtml(profileUrl)}" style="color:#2456d6;text-decoration:none;font-weight:600;">Periksa Profil &amp; Keterampilan Kamu &rarr;</a></li>
        </ul>
      </div>

      <div style="text-align:center;font-size:12px;color:#718096;line-height:1.6;">
        <p style="margin:0 0 6px;">Kamu menerima email ini karena menyimpan lowongan tersebut di RakitKarier.</p>
        <p style="margin:0;">
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#718096;text-decoration:underline;">Berhenti Berlangganan</a> · 
          <a href="${escapeHtml(profileUrl)}" style="color:#718096;text-decoration:underline;">Pengaturan Notifikasi</a>
        </p>
      </div>
    </div>`;

  const text = [
    `⏳ [Pengingat Tenggat] Pendaftaran Lowongan Akan Ditutup: ${job.title} di ${job.company}`,
    '',
    badgeLabel,
    '',
    'Halo!',
    'Lowongan yang kamu simpan di RakitKarier akan segera menutup pendaftarannya:',
    `- Posisi: ${job.title}`,
    `- Perusahaan: ${job.company}`,
    `- Lokasi: ${location} · ${workMode}${sourceText}`,
    `- Tenggat Waktu: ${formattedDeadline} (${reminderLabel})`,
    '',
    `Lamar Sekarang: ${applyUrl}`,
    '',
    'Persiapkan Lamaranmu di RakitKarier:',
    `- Buat atau perbarui CV: ${cvUrl}`,
    `- Periksa profil & keterampilan: ${profileUrl}`,
    '',
    '---',
    'Kamu menerima email ini karena menyimpan lowongan ini di RakitKarier.',
    `Berhenti berlangganan: ${unsubscribeUrl}`,
    `Pengaturan preferensi: ${profileUrl}`,
  ].join('\n');

  return { subject, html, text };
}

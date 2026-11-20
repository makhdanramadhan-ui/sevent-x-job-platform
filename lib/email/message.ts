import { MATCH_EMAIL_THRESHOLD, type DigestJob } from './digest';

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

export type DigestEmail = {
  subject: string;
  html: string;
  text: string;
};

export type DigestLinks = {
  recommendationsUrl: string;
  unsubscribeUrl: string;
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

export function buildDigestEmail(jobs: DigestJob[], links: DigestLinks): DigestEmail {
  const thresholdText = `di atas ${MATCH_EMAIL_THRESHOLD}%`;
  const recommendationsUrl = safeHttpUrl(links.recommendationsUrl, links.recommendationsUrl);
  const unsubscribeUrl = safeHttpUrl(links.unsubscribeUrl, recommendationsUrl);

  const htmlJobs = jobs
    .map((job) => {
      const detailUrl = safeHttpUrl(job.sourceUrl, recommendationsUrl);
      const location = job.location?.trim() || 'Lokasi belum tersedia';
      const workMode = WORK_MODE_LABELS[job.workMode ?? ''] ?? 'Mode kerja belum diketahui';
      const reasons = job.reasons.length
        ? job.reasons.map((reason) => escapeHtml(reason)).join(' · ')
        : 'Belum ada alasan spesifik yang tercatat';

      return `
        <article style="border:1px solid #dde4ee;border-radius:12px;padding:16px;margin:14px 0;background:#ffffff;">
          <h2 style="margin:0 0 6px;font-size:18px;color:#172033;">${escapeHtml(job.title)}</h2>
          <p style="margin:0 0 10px;color:#506079;font-size:14px;">${escapeHtml(job.company)} · ${escapeHtml(location)} · ${escapeHtml(workMode)}</p>
          <p style="margin:0 0 10px;color:#506079;font-size:14px;">Sumber: ${escapeHtml(job.sourceName)}</p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Skor kecocokan: ${job.score}%</strong></p>
          <p style="margin:0 0 8px;font-size:14px;">Lowongan ini cocok karena akurasi kecocokan dengan profilmu ${job.score}% (${thresholdText})</p>
          <p style="margin:0 0 14px;font-size:14px;"><strong>Cocok:</strong> ${reasons}</p>
          <a href="${escapeHtml(detailUrl)}" style="display:inline-block;background:#2456d6;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;">Detail &amp; Sumber Asli</a>
        </article>`;
    })
    .join('');

  const html = `
    <div style="max-width:600px;margin:0 auto;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;line-height:1.55;">
      <h1 style="margin:0 0 8px;font-size:22px;">Ada ${jobs.length} lowongan cocok untukmu</h1>
      <p style="margin:0 0 18px;font-size:15px;color:#506079;">Halo! Berikut lowongan dengan kecocokan ${MATCH_EMAIL_THRESHOLD}% atau lebih berdasarkan profil RakitKarier-mu.</p>
      ${htmlJobs}
      <p style="margin:20px 0 8px;font-size:14px;"><a href="${escapeHtml(recommendationsUrl)}" style="color:#2456d6;">Lihat semua rekomendasi</a></p>
      <p style="margin:0;font-size:12px;color:#718096;">Kamu menerima email ini karena mengaktifkan notifikasi kecocokan lowongan. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#718096;">Berhenti berlangganan</a></p>
    </div>`;

  const textJobs = jobs
    .map((job) => {
      const detailUrl = safeHttpUrl(job.sourceUrl, recommendationsUrl);
      const location = job.location?.trim() || 'Lokasi belum tersedia';
      const workMode = WORK_MODE_LABELS[job.workMode ?? ''] ?? 'Mode kerja belum diketahui';
      const reasons = job.reasons.length ? job.reasons.join(' · ') : 'Belum ada alasan spesifik yang tercatat';
      return [
        `${job.title}`,
        `${job.company} · ${location} · ${workMode}`,
        `Sumber: ${job.sourceName}`,
        `Skor kecocokan: ${job.score}%`,
        `Lowongan ini cocok karena akurasi kecocokan dengan profilmu ${job.score}% (${thresholdText})`,
        `Cocok: ${reasons}`,
        `Detail & Sumber Asli: ${detailUrl}`,
      ].join('\n');
    })
    .join('\n\n');

  const text = [
    `Halo! Berikut ${jobs.length} lowongan dengan kecocokan ${MATCH_EMAIL_THRESHOLD}% atau lebih berdasarkan profil RakitKarier-mu.`,
    '',
    textJobs,
    '',
    `Lihat semua rekomendasi: ${recommendationsUrl}`,
    `Berhenti berlangganan: ${unsubscribeUrl}`,
  ].join('\n');

  return {
    subject: `RakitKarier: ${jobs.length} lowongan cocok untukmu (≥${MATCH_EMAIL_THRESHOLD}%)`,
    html,
    text,
  };
}

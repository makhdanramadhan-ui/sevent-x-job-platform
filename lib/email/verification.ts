import { resolveSiteUrl } from './transport';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export type VerificationEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

export function buildVerificationEmail(input: {
  email: string;
  confirmUrl: string;
  expiresNote?: string;
}): VerificationEmail {
  const siteUrl = resolveSiteUrl();
  const confirmUrlEsc = escapeHtml(input.confirmUrl);
  const emailEsc = escapeHtml(input.email);
  const expiresNote = input.expiresNote?.trim() || 'Tautan verifikasi berlaku dalam waktu terbatas.';

  const subject = 'Verifikasi email akun RakitKarier kamu';
  const html = `
    <div style="max-width:600px;margin:0 auto;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;line-height:1.55;">
      <h1 style="margin:0 0 8px;font-size:22px;">Verifikasi email kamu</h1>
      <p style="margin:0 0 18px;font-size:15px;color:#506079;">Halo! Kamu baru saja mendaftar di RakitKarier menggunakan email ${emailEsc}.</p>
      <p style="margin:0 0 18px;font-size:15px;">Klik tombol di bawah untuk mengaktifkan akunmu:</p>
      <p style="margin:0 0 20px;">
        <a href="${confirmUrlEsc}" style="display:inline-block;background:#2456d6;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600;">Verifikasi Email</a>
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#506079;">${escapeHtml(expiresNote)}</p>
      <p style="margin:0 0 18px;font-size:14px;color:#506079;">Jika tombol tidak berfungsi, salin dan buka tautan ini di browser: <a href="${confirmUrlEsc}" style="color:#2456d6;word-break:break-all;">${confirmUrlEsc}</a></p>
      <p style="margin:0 0 8px;font-size:14px;color:#506079;">Tips: cek juga folder Spam jika email tidak terlihat di kotak masuk.</p>
      <hr style="border:none;border-top:1px solid #dde4ee;margin:20px 0;" />
      <p style="margin:0;font-size:12px;color:#718096;">Email ini dikirim oleh RakitKarier (${escapeHtml(siteUrl)}).</p>
    </div>`;

  const text = [
    'Halo! Kamu baru saja mendaftar di RakitKarier.',
    '',
    `Email: ${input.email}`,
    '',
    'Buka tautan berikut untuk memverifikasi email kamu:',
    input.confirmUrl,
    '',
    expiresNote,
    '',
    'Tips: cek juga folder Spam jika email tidak terlihat di kotak masuk.',
    '',
    `RakitKarier: ${siteUrl}`,
  ].join('\n');

  return { subject, html, text };
}

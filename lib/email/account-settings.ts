import { resolveSiteUrl } from './transport';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export type AccountSettingsEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

export function buildAccountSettingsEmail(input: {
  action: 'email' | 'password' | 'delete';
  email: string;
  code: string;
  purpose: 'current' | 'new';
}): AccountSettingsEmail {
  const siteUrl = resolveSiteUrl();
  const emailEsc = escapeHtml(input.email);
  const codeEsc = escapeHtml(input.code);

  let subject: string;
  let heading: string;
  let intro: string;
  let instruction: string;

  if (input.action === 'email' && input.purpose === 'new') {
    subject = 'Kode verifikasi email baru RakitKarier';
    heading = 'Verifikasi email baru';
    intro = `Kami menerima permintaan perubahan email akun RakitKarier ke ${emailEsc}.`;
    instruction = 'Masukkan kode 8 digit berikut untuk mengonfirmasi email baru kamu:';
  } else if (input.action === 'email') {
    subject = 'Kode verifikasi perubahan email RakitKarier';
    heading = 'Konfirmasi perubahan email';
    intro = `Kami menerima permintaan perubahan email untuk akun RakitKarier dengan email ${emailEsc}.`;
    instruction = 'Masukkan kode 8 digit berikut untuk mengonfirmasi bahwa kamu meminta perubahan email ini:';
  } else if (input.action === 'delete') {
    subject = 'Kode konfirmasi hapus akun RakitKarier';
    heading = 'Konfirmasi hapus akun';
    intro = `Kami menerima permintaan penghapusan akun RakitKarier dengan email ${emailEsc}.`;
    instruction = 'Masukkan kode 8 digit berikut untuk mengonfirmasi penghapusan akun kamu:';
  } else {
    subject = 'Kode verifikasi perubahan password RakitKarier';
    heading = 'Konfirmasi perubahan password';
    intro = `Kami menerima permintaan perubahan password untuk akun RakitKarier dengan email ${emailEsc}.`;
    instruction = 'Masukkan kode 8 digit berikut untuk mengonfirmasi perubahan password kamu:';
  }

  const html = `
    <div style="max-width:600px;margin:0 auto;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;line-height:1.55;">
      <h1 style="margin:0 0 8px;font-size:22px;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 18px;font-size:15px;color:#506079;">${intro}</p>
      <p style="margin:0 0 12px;font-size:15px;">${escapeHtml(instruction)}</p>
      <div style="margin:0 0 20px;padding:20px;background:#ffffff;border:1px solid #dde4ee;border-radius:12px;text-align:center;">
        <span style="display:inline-block;font-size:36px;line-height:1;letter-spacing:8px;font-weight:700;color:#172033;">${codeEsc}</span>
      </div>
      <p style="margin:0 0 8px;font-size:14px;color:#506079;">Kode ini berlaku maks 15 menit.</p>
      <p style="margin:0 0 8px;font-size:14px;color:#506079;">Abaikan jika kamu tidak meminta tindakan ini.</p>
      <p style="margin:0 0 18px;font-size:14px;color:#506079;">Tips: cek juga folder Spam jika email tidak terlihat di kotak masuk.</p>
      <hr style="border:none;border-top:1px solid #dde4ee;margin:20px 0;" />
      <p style="margin:0;font-size:12px;color:#718096;">Email ini dikirim oleh RakitKarier (${escapeHtml(siteUrl)}).</p>
    </div>`;

  const text = [
    heading,
    '',
    intro.replace(emailEsc, input.email),
    '',
    instruction,
    input.code,
    '',
    'Kode ini berlaku maks 15 menit.',
    'Abaikan jika kamu tidak meminta tindakan ini.',
    '',
    'Tips: cek juga folder Spam jika email tidak terlihat di kotak masuk.',
    '',
    `RakitKarier: ${siteUrl}`,
  ].join('\n');

  return { subject, html, text };
}

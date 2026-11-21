import { resolveSiteUrl } from './transport';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export type ForgotPasswordEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

export function buildForgotPasswordEmail(input: { email: string; code: string }): ForgotPasswordEmail {
  const siteUrl = resolveSiteUrl();
  const emailEsc = escapeHtml(input.email);
  const codeEsc = escapeHtml(input.code);

  const subject = 'Kode reset password RakitKarier kamu';
  const html = `
    <div style="max-width:600px;margin:0 auto;padding:24px;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;line-height:1.55;">
      <h1 style="margin:0 0 8px;font-size:22px;">Reset password kamu</h1>
      <p style="margin:0 0 18px;font-size:15px;color:#506079;">Kami menerima permintaan reset password untuk akun RakitKarier dengan email ${emailEsc}.</p>
      <p style="margin:0 0 12px;font-size:15px;">Masukkan kode berikut untuk melanjutkan reset password:</p>
      <div style="margin:0 0 20px;padding:20px;background:#ffffff;border:1px solid #dde4ee;border-radius:12px;text-align:center;">
        <span style="display:inline-block;font-size:36px;line-height:1;letter-spacing:8px;font-weight:700;color:#172033;">${codeEsc}</span>
      </div>
      <p style="margin:0 0 8px;font-size:14px;color:#506079;">Kode ini berlaku maks 1 jam.</p>
      <p style="margin:0 0 8px;font-size:14px;color:#506079;">Abaikan jika tidak meminta reset password ini.</p>
      <p style="margin:0 0 18px;font-size:14px;color:#506079;">Tips: cek juga folder Spam jika email tidak terlihat di kotak masuk.</p>
      <hr style="border:none;border-top:1px solid #dde4ee;margin:20px 0;" />
      <p style="margin:0;font-size:12px;color:#718096;">Email ini dikirim oleh RakitKarier (${escapeHtml(siteUrl)}).</p>
    </div>`;

  const text = [
    'Reset password RakitKarier kamu',
    '',
    `Kami menerima permintaan reset password untuk akun RakitKarier dengan email ${input.email}.`,
    '',
    `Kode reset password: ${input.code}`,
    '',
    'Kode ini berlaku maks 1 jam.',
    'Abaikan jika tidak meminta reset password ini.',
    '',
    'Tips: cek juga folder Spam jika email tidak terlihat di kotak masuk.',
    '',
    `RakitKarier: ${siteUrl}`,
  ].join('\n');

  return { subject, html, text };
}

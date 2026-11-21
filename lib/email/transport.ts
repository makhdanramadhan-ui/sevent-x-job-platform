import nodemailer, { type SendMailOptions } from 'nodemailer';

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
};

export function readSmtpConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim() ?? '';
  const portText = env.SMTP_PORT?.trim() ?? '';
  const user = env.SMTP_USER?.trim() ?? '';
  const pass = env.SMTP_PASS?.trim() ?? '';
  const from = env.MAIL_FROM?.trim() ?? '';
  const port = Number(portText);

  if (
    !host ||
    !portText ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !user ||
    !pass ||
    !from
  ) {
    return null;
  }

  return { host, port, user, pass, from, secure: port === 465 };
}

export function resolveSiteUrl(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim() || env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercelUrl = env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  }

  return 'https://rakitkarier.vercel.app';
}

export type SendEmailResult = {
  messageId: string;
  accepted: string[];
  rejected: string[];
};

export async function sendMatchEmail(config: SmtpConfig, message: SendMailOptions): Promise<SendEmailResult> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });

  try {
    const info = await transport.sendMail({ from: config.from, ...message });
    const accepted = Array.isArray(info.accepted) ? info.accepted.map(String) : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected.map(String) : [];
    return { messageId: info.messageId ?? '', accepted, rejected };
  } finally {
    transport.close();
  }
}

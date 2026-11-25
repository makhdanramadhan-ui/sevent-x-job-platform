import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';

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

  const productionUrl = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionUrl) {
    return `https://${productionUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  }

  return 'https://rakitkarier.vercel.app';
}

export type SendEmailResult = {
  messageId: string;
  accepted: string[];
  rejected: string[];
};

type CachedTransport = {
  key: string;
  transport: Transporter;
};

let cachedTransport: CachedTransport | null = null;

function getTransport(config: SmtpConfig): Transporter {
  const key = [config.host, config.port, config.user, config.from, config.secure ? '1' : '0'].join('|');
  if (cachedTransport?.key === key) return cachedTransport.transport;
  if (cachedTransport) {
    try {
      cachedTransport.transport.close();
    } catch {
      // ignore close errors on stale transport
    }
  }
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: { user: config.user, pass: config.pass },
  });
  cachedTransport = { key, transport };
  return transport;
}

function resetTransport(config: SmtpConfig): void {
  const key = [config.host, config.port, config.user, config.from, config.secure ? '1' : '0'].join('|');
  if (cachedTransport?.key !== key) return;
  try {
    cachedTransport.transport.close();
  } catch {
    // ignore
  }
  cachedTransport = null;
}

function smtpStatusCode(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const rec = err as Record<string, unknown>;
  const candidates = [rec.responseCode, rec.code];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
    if (typeof c === 'string' && /^\d{3}$/.test(c)) return Number(c);
  }
  return null;
}

function isTransientSmtpError(err: unknown): boolean {
  const status = smtpStatusCode(err);
  if (status !== null && status >= 400 && status < 500) return true;
  if (status !== null && status >= 500) return false;
  if (!err || typeof err !== 'object') return false;
  const rec = err as Record<string, unknown>;
  const code = typeof rec.code === 'string' ? rec.code.toUpperCase() : '';
  if (
    code === 'ETIMEDOUT' ||
    code === 'ECONNECTION' ||
    code === 'ECONNRESET' ||
    code === 'ESOCKET' ||
    code === 'EAI_AGAIN' ||
    code === 'EDNS' ||
    code === 'ECONNREFUSED'
  ) {
    return true;
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    msg.includes('timeout') ||
    msg.includes('temporar') ||
    msg.includes('try again') ||
    msg.includes('greeting never received') ||
    msg.includes('connection closed')
  );
}

function errorSummary(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== 'object') {
    return { message: String(err) };
  }
  const rec = err as Record<string, unknown>;
  return {
    name: err instanceof Error ? err.name : undefined,
    message: err instanceof Error ? err.message : String(rec.message ?? err),
    code: rec.code,
    responseCode: rec.responseCode,
    command: rec.command,
    response: typeof rec.response === 'string' ? rec.response.slice(0, 300) : undefined,
  };
}

export async function sendMatchEmail(config: SmtpConfig, message: SendMailOptions): Promise<SendEmailResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const transport = getTransport(config);
      const info = await transport.sendMail({ from: config.from, ...message });
      const accepted = Array.isArray(info.accepted) ? info.accepted.map(String) : [];
      const rejected = Array.isArray(info.rejected) ? info.rejected.map(String) : [];
      return { messageId: info.messageId ?? '', accepted, rejected };
    } catch (err) {
      lastError = err;
      const transient = isTransientSmtpError(err);
      console.error('[email] send attempt failed', {
        attempt,
        transient,
        ...errorSummary(err),
      });
      resetTransport(config);
      if (!transient || attempt === 2) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const sendDeadlineEmail = sendMatchEmail;

export function __resetEmailTransportForTests(): void {
  if (cachedTransport) {
    try {
      cachedTransport.transport.close();
    } catch {
      // ignore
    }
  }
  cachedTransport = null;
}

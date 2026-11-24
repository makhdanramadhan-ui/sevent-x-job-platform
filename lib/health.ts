export type DatabaseCheckResult =
  | { status: 'ok'; latency_ms: number }
  | { status: 'error' | 'unconfigured'; latency_ms?: number };

export type EmailCheckResult = {
  status: 'configured' | 'unconfigured';
};

export type HealthReport = {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    database: DatabaseCheckResult;
    email: EmailCheckResult;
  };
};

export type HealthCheckDeps = {
  isSupabaseConfigured: () => boolean;
  pingDatabase: () => Promise<void>;
  isSmtpConfigured: () => boolean;
  now?: () => Date;
};

export async function checkSystemHealth(deps: HealthCheckDeps): Promise<HealthReport> {
  const timestamp = (deps.now ? deps.now() : new Date()).toISOString();
  const emailStatus: EmailCheckResult = {
    status: deps.isSmtpConfigured() ? 'configured' : 'unconfigured',
  };

  if (!deps.isSupabaseConfigured()) {
    return {
      status: 'unhealthy',
      timestamp,
      checks: {
        database: { status: 'unconfigured' },
        email: emailStatus,
      },
    };
  }

  const start = performance.now();
  try {
    await deps.pingDatabase();
    const latencyMs = Math.max(0, Math.round(performance.now() - start));
    return {
      status: 'healthy',
      timestamp,
      checks: {
        database: { status: 'ok', latency_ms: latencyMs },
        email: emailStatus,
      },
    };
  } catch {
    const latencyMs = Math.max(0, Math.round(performance.now() - start));
    return {
      status: 'unhealthy',
      timestamp,
      checks: {
        database: { status: 'error', latency_ms: latencyMs },
        email: emailStatus,
      },
    };
  }
}

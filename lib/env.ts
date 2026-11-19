export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

export type SupabaseAdminEnv = SupabaseEnv & {
  serviceRoleKey: string;
};

export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  } catch {
    return null;
  }
  return { url, anonKey };
}

export function readSupabaseAdminEnv(): SupabaseAdminEnv | null {
  const env = readSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!env || !serviceRoleKey) return null;
  return { ...env, serviceRoleKey };
}

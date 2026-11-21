export type PasswordRule = {
  id: 'min_length' | 'has_uppercase';
  label: string;
  test: (password: string) => boolean;
};

export type PasswordValidationResult = {
  ok: boolean;
  failures: string[];
};

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'min_length',
    label: 'Minimal 8 karakter',
    test: (password) => password.length >= 8,
  },
  {
    id: 'has_uppercase',
    label: 'Minimal 1 huruf kapital (A-Z)',
    test: (password) => /[A-Z]/.test(password),
  },
] as const;

export function validatePassword(password: string): PasswordValidationResult {
  const failures = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.label);
  return { ok: failures.length === 0, failures };
}

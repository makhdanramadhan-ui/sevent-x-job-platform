import type { ReactNode } from 'react';

export function ButtonText({ children }: { children: ReactNode }) {
  return <span className="btn-label">{children}</span>;
}

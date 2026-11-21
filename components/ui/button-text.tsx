import type { ReactNode } from 'react';

export function ButtonText({ children }: { children: ReactNode }) {
  return (
    <span className="btn-roll">
      <span className="btn-roll__text">{children}</span>
      <span className="btn-roll__clone" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

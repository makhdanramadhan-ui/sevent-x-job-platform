'use client';

import { Button } from '@/components/ui/forms';

export type PaginationItem = number | 'ellipsis';

export function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage]);
  if (currentPage - 1 >= 1) pages.add(currentPage - 1);
  if (currentPage + 1 <= totalPages) pages.add(currentPage + 1);

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  } else if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const items: PaginationItem[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const page = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev !== undefined && page - prev > 1) {
      if (page - prev === 2) {
        items.push(prev + 1);
      } else {
        items.push('ellipsis');
      }
    }
    items.push(page);
  }

  return items;
}

export function PaginationBar({
  currentPage,
  totalPages,
  onPageChange,
  ariaLabel = 'Navigasi halaman',
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  ariaLabel?: string;
}) {
  if (totalPages <= 1) return null;

  const items = getPaginationItems(currentPage, totalPages);

  return (
    <nav
      aria-label={ariaLabel}
      className="surface-card"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        padding: '14px 18px',
      }}
    >
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Sebelumnya
      </Button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 6,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {items.map((item, idx) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${idx}`}
              aria-hidden="true"
              style={{
                padding: '0 4px',
                fontSize: '0.875rem',
                color: 'var(--p-muted)',
                userSelect: 'none',
              }}
            >
              ...
            </span>
          ) : (
            <Button
              key={item}
              variant={item === currentPage ? 'primary' : 'outline'}
              size="sm"
              aria-label={`Halaman ${item}`}
              aria-current={item === currentPage ? 'page' : undefined}
              onClick={() => {
                if (item !== currentPage) onPageChange(item);
              }}
              style={{
                minWidth: 36,
                paddingLeft: 10,
                paddingRight: 10,
                justifyContent: 'center',
              }}
            >
              {item}
            </Button>
          ),
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Berikutnya
      </Button>
    </nav>
  );
}

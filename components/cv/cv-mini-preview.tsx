'use client';

import Link from 'next/link';
import { Badge, Button, formatDateTimeId } from '@/components/ui';
import type { CvDocumentSummary } from '@/lib/contracts';
import { getPresetDefinition } from '@/app/cv/_lib/presets';

export function CvMiniPreview({
  cv,
  onDelete,
}: {
  cv: CvDocumentSummary;
  onDelete?: (id: string) => void;
}) {
  const preset = getPresetDefinition(cv.template_version);

  return (
    <div className="surface-card-interactive" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', margin: '0 0 4px', fontWeight: 700 }}>
            <Link href={`/cv/${cv.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              {cv.title}
            </Link>
          </h3>
          <span className="font-mono" style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
            Diperbarui: {formatDateTimeId(cv.updated_at)}
          </span>
        </div>
        <Badge variant={cv.template_version?.includes('custom') ? 'neutral' : 'open'}>
          {preset.shortLabel}
        </Badge>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginTop: 6,
          borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
          paddingTop: 10,
        }}
      >
        {onDelete ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(cv.id)}
            title="Hapus dokumen ini"
          >
            Hapus
          </Button>
        ) : null}
        <Link href={`/cv/${cv.id}`} className="btn btn-outline btn-sm">
          Buka Editor &amp; Unduh &rarr;
        </Link>
      </div>
    </div>
  );
}

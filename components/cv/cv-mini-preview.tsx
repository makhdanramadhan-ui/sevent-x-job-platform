'use client';

import Link from 'next/link';
import { formatDateTimeId } from '@/components/ui/api-client';
import { ButtonText } from '@/components/ui/button-text';
import { Badge, Button } from '@/components/ui/forms';
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
    <article className="cv-doc-card">
      <div>
        <div className="cv-doc-card__head">
          <h3 className="cv-doc-card__title">
            <Link href={`/cv/${cv.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              {cv.title}
            </Link>
          </h3>
          <Badge variant={cv.template_version?.includes('custom') ? 'neutral' : 'open'}>
            {preset.shortLabel}
          </Badge>
        </div>
        <span className="cv-doc-card__meta">
          Diperbarui: {formatDateTimeId(cv.updated_at)}
        </span>
      </div>

      <div className="cv-doc-card__foot">
        {onDelete ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(cv.id)}
            title="Hapus dokumen ini"
          >
            Hapus
          </Button>
        ) : (
          <span />
        )}
        <Link href={`/cv/${cv.id}`} className="btn btn-outline btn-sm">
          <ButtonText>Buka Editor &amp; Unduh</ButtonText>
        </Link>
      </div>
    </article>
  );
}

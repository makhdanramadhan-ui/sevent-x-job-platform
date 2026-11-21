'use client';

import { useState } from 'react';
import { Badge, Button } from '@/components/ui/forms';
import {
  CV_PRESETS,
  type CvPresetId,
  detectActivePreset,
  getPresetDefinition,
  getSectionsForPreset,
} from '../_lib/presets';
import { type CvContent, type CvSectionId, SECTION_LABELS } from '../_lib/types';

export function CvSectionReorder({
  content,
  onChange,
  templateVersion,
  onPresetChange,
}: {
  content: CvContent;
  onChange: (updated: CvContent) => void;
  templateVersion?: string | null;
  onPresetChange?: (nextPreset: CvPresetId) => void;
}) {
  const { language = 'en', section_order, hidden_sections } = content;
  const labels = SECTION_LABELS[language] || SECTION_LABELS.en;

  const currentPresetId = detectActivePreset(templateVersion, section_order);
  const activePresetDef = getPresetDefinition(currentPresetId);

  // State untuk Drag & Drop murni HTML5
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function applyPreset(presetId: CvPresetId) {
    if (presetId === 'v1-[#custom]') {
      if (onPresetChange) onPresetChange('v1-[#custom]');
      return;
    }
    const newOrder = getSectionsForPreset(presetId);
    onChange({
      ...content,
      section_order: newOrder,
    });
    if (onPresetChange) {
      onPresetChange(presetId);
    }
  }

  function moveSection(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= section_order.length) return;

    const newOrder = [...section_order];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    onChange({
      ...content,
      section_order: newOrder,
    });
    if (onPresetChange) {
      onPresetChange('v1-[#custom]');
    }
  }

  function toggleVisibility(secId: CvSectionId) {
    const isHidden = hidden_sections.includes(secId);
    let newHidden: CvSectionId[];

    if (isHidden) {
      newHidden = hidden_sections.filter((id) => id !== secId);
    } else {
      newHidden = [...hidden_sections, secId];
    }

    onChange({
      ...content,
      hidden_sections: newHidden,
    });
    if (onPresetChange) {
      onPresetChange('v1-[#custom]');
    }
  }

  function handleDragStart(index: number, e: React.DragEvent) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(index));
    } catch {
      // Fallback untuk browser lawas
    }
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDrop(targetIndex: number, e: React.DragEvent) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...section_order];
    const [moved] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, moved);

    onChange({
      ...content,
      section_order: newOrder,
    });

    if (onPresetChange) {
      onPresetChange('v1-[#custom]');
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div className="ledger-card">
      <div className="cv-section-header" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h3 className="cv-section-heading" style={{ marginBottom: 4 }}>
            Tata Letak &amp; Urutan Bagian CV (ATS Flow)
          </h3>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
            Pilih preset instan atau <strong>tarik dan lepas (Drag &amp; Drop)</strong> kotak bagian
            untuk mengatur urutan CV Anda.
          </p>
        </div>
        <Badge variant={currentPresetId === 'v1-[#custom]' ? 'neutral' : 'open'}>
          Preset: {activePresetDef.shortLabel}
        </Badge>
      </div>

      {/* Preset Selector Grid */}
      <div
        className="cv-preset-grid"
        role="group"
        aria-label="Pilihan Preset Jenis CV"
      >
        {CV_PRESETS.map((preset) => {
          const isSelected = currentPresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={`cv-preset-card${isSelected ? ' cv-preset-card--active' : ''}`}
            >
              <div className="cv-preset-card__top">
                <strong className="cv-preset-card__name">{preset.name}</strong>
                {isSelected ? <Badge variant="accent">Aktif</Badge> : null}
              </div>
              <p className="cv-preset-card__desc">{preset.description}</p>
              <span className="cv-preset-card__for">
                Cocok untuk: {preset.recommendedFor}
              </span>
            </button>
          );
        })}
      </div>

      {/* Drag & Drop Reorderable Section List */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--ink-secondary)' }}>
          Urutan Bagian ({section_order.length} Bagian — seret kotak untuk memindahkan):
        </span>
      </div>

      <ul
        className="cv-reorder-list"
        aria-label="Daftar urutan bagian CV yang dapat digeser"
      >
        {section_order.map((secId, index) => {
          const isHidden = hidden_sections.includes(secId);
          const label = labels[secId] || secId;
          const isBeingDragged = draggedIndex === index;
          const isOver = dragOverIndex === index && !isBeingDragged;

          const itemClass = [
            'cv-reorder-item',
            isHidden ? 'cv-reorder-item--hidden' : '',
            isBeingDragged ? 'cv-reorder-item--dragging' : '',
            isOver ? 'cv-reorder-item--over' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <li
              key={secId}
              draggable
              onDragStart={(e) => handleDragStart(index, e)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(index, e)}
              onDragEnd={handleDragEnd}
              className={itemClass}
            >
              <div className="cv-reorder-meta">
                <span
                  className="cv-reorder-handle"
                  title="Seret untuk mengubah urutan"
                  aria-hidden="true"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="5" r="1.6" />
                    <circle cx="15" cy="5" r="1.6" />
                    <circle cx="9" cy="12" r="1.6" />
                    <circle cx="15" cy="12" r="1.6" />
                    <circle cx="9" cy="19" r="1.6" />
                    <circle cx="15" cy="19" r="1.6" />
                  </svg>
                </span>
                <span className="cv-reorder-index">#{index + 1}</span>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{label}</span>
                {isHidden ? (
                  <Badge variant="neutral">Disembunyikan</Badge>
                ) : (
                  <Badge variant="open">Tampil</Badge>
                )}
              </div>

              <div className="cv-reorder-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveSection(index, 'up');
                  }}
                  aria-label={`Pindahkan ${label} ke atas`}
                  title="Pindahkan ke atas"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={index === section_order.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveSection(index, 'down');
                  }}
                  aria-label={`Pindahkan ${label} ke bawah`}
                  title="Pindahkan ke bawah"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVisibility(secId);
                  }}
                  aria-label={isHidden ? `Tampilkan ${label}` : `Sembunyikan ${label}`}
                >
                  {isHidden ? 'Tampilkan' : 'Sembunyikan'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

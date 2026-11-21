'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui';
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

  // Handler Drag & Drop
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
    <div className="surface-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.15rem', margin: '0 0 4px 0', fontWeight: 700 }}>
            Tata Letak &amp; Urutan Bagian CV (ATS Flow)
          </h3>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
            Pilih preset instan atau <strong>tarik dan lepas (Drag &amp; Drop)</strong> kotak bagian untuk mengatur urutan CV Anda.
          </p>
        </div>
        <Badge variant={currentPresetId === 'v1-[#custom]' ? 'neutral' : 'open'}>
          Preset: {activePresetDef.shortLabel}
        </Badge>
      </div>

      {/* Preset Selector Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 10,
          margin: '14px 0 16px 0',
        }}
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
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md, 10px)',
                border: isSelected
                  ? '2px solid var(--p-primary, #b8381e)'
                  : '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                background: isSelected ? 'var(--p-primary-soft, #fdf2f0)' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <strong
                  style={{
                    fontSize: '0.88rem',
                    color: isSelected ? 'var(--p-primary, #b8381e)' : 'inherit',
                  }}
                >
                  {preset.name}
                </strong>
                {isSelected ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--p-primary, #b8381e)' }}>
                    ● Aktif
                  </span>
                ) : null}
              </div>
              <p
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '0.78rem',
                  color: 'var(--ink-secondary)',
                  lineHeight: 1.35,
                }}
              >
                {preset.description}
              </p>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--ink-muted)',
                  fontStyle: 'italic',
                  display: 'block',
                }}
              >
                Cocok untuk: {preset.recommendedFor}
              </span>
            </button>
          );
        })}
      </div>

      {/* Drag & Drop Reorderable Section List */}
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink-secondary)' }}>
          Urutan Bagian ({section_order.length} Bagian — Drag kotak untuk memindahkan):
        </span>
      </div>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
        aria-label="Daftar urutan bagian CV yang dapat digeser"
      >
        {section_order.map((secId, index) => {
          const isHidden = hidden_sections.includes(secId);
          const label = labels[secId] || secId;
          const isBeingDragged = draggedIndex === index;
          const isOver = dragOverIndex === index && !isBeingDragged;

          return (
            <li
              key={secId}
              draggable
              onDragStart={(e) => handleDragStart(index, e)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(index, e)}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                background: isBeingDragged
                  ? '#f3f4f6'
                  : isOver
                    ? '#eff6ff'
                    : isHidden
                      ? 'var(--p-surface, #f4f4f4)'
                      : '#ffffff',
                border: isOver
                  ? '2px dashed var(--p-primary, #b8381e)'
                  : isBeingDragged
                    ? '1.5px dashed #9ca3af'
                    : '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
                borderRadius: 'var(--radius-sm, 8px)',
                opacity: isBeingDragged ? 0.45 : isHidden ? 0.6 : 1,
                gap: 12,
                cursor: 'grab',
                userSelect: 'none',
                transition: 'background 0.15s ease, border 0.15s ease',
              }}
            >
              {/* Drag Handle & Label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  title="Geser / Drag untuk mengubah urutan"
                  style={{
                    fontSize: '1.1rem',
                    color: 'var(--ink-muted)',
                    cursor: 'grab',
                    padding: '2px 4px',
                    lineHeight: 1,
                    letterSpacing: -1,
                  }}
                >
                  ⠿
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}
                >
                  #{index + 1}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{label}</span>
                {isHidden ? (
                  <Badge variant="neutral">Disembunyikan</Badge>
                ) : (
                  <Badge variant="open">Tampil</Badge>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVisibility(secId);
                  }}
                  aria-label={isHidden ? `Tampilkan ${label}` : `Sembunyikan ${label}`}
                  title={isHidden ? 'Tampilkan bagian' : 'Sembunyikan bagian'}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                    borderRadius: 'var(--radius-sm, 6px)',
                    padding: '5px 7px',
                    cursor: 'pointer',
                    color: isHidden ? 'var(--ink-muted)' : 'var(--ink-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    lineHeight: 1,
                  }}
                >
                  {isHidden ? (
                    /* Mata tercoret — bagian disembunyikan */
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    /* Mata terbuka — bagian tampil */
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

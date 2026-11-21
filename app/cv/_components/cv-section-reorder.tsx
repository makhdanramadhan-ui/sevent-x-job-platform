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
import {
  type CvContent,
  type CvCustomSection,
  type CvSectionId,
  DEFAULT_SECTION_ORDER,
  getCustomSectionKey,
  getSectionDisplayTitle,
  isCustomSectionId,
} from '../_lib/types';

export function CvSectionReorder({
  content,
  onChange,
  templateVersion,
  onPresetChange,
  onSelectSection,
}: {
  content: CvContent;
  onChange: (updated: CvContent) => void;
  templateVersion?: string | null;
  onPresetChange?: (nextPreset: CvPresetId) => void;
  onSelectSection?: (section: CvSectionId) => void;
}) {
  const { section_order, hidden_sections } = content;

  const currentPresetId = detectActivePreset(templateVersion, section_order);
  const activePresetDef = getPresetDefinition(currentPresetId);

  // State untuk Drag & Drop murni HTML5
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // State untuk Tambah, Ubah Nama, dan Hapus Bagian
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [editingSecId, setEditingSecId] = useState<CvSectionId | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteSecId, setConfirmDeleteSecId] = useState<CvSectionId | null>(null);

  const removedBuiltins = DEFAULT_SECTION_ORDER.filter(
    (id) => id !== 'profile' && !section_order.includes(id),
  );

  function applyPreset(presetId: CvPresetId) {
    if (presetId === 'v1-[#custom]') {
      if (onPresetChange) onPresetChange('v1-[#custom]');
      return;
    }
    const existingCustomIds = section_order.filter(isCustomSectionId);
    const newOrder: CvSectionId[] = [...getSectionsForPreset(presetId), ...existingCustomIds];
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

  function startRename(secId: CvSectionId) {
    setConfirmDeleteSecId(null);
    setEditingSecId(secId);
    setEditingTitle(getSectionDisplayTitle(content, secId));
  }

  function cancelRename() {
    setEditingSecId(null);
    setEditingTitle('');
  }

  function commitRename(secId: CvSectionId) {
    const trimmed = editingTitle.trim().slice(0, 80);

    if (isCustomSectionId(secId)) {
      if (trimmed) {
        const key = getCustomSectionKey(secId);
        const nextCustomSections = (content.custom_sections ?? []).map((item) =>
          item.id === key ? { ...item, title: trimmed } : item,
        );
        onChange({
          ...content,
          custom_sections: nextCustomSections,
        });
      }
    } else {
      const nextTitles = { ...(content.section_titles ?? {}) };
      if (trimmed) {
        nextTitles[secId] = trimmed;
      } else {
        delete nextTitles[secId];
      }
      onChange({
        ...content,
        section_titles: nextTitles,
      });
    }

    setEditingSecId(null);
    setEditingTitle('');
  }

  function handleAddCustomSection() {
    const trimmed = newSectionTitle.trim().slice(0, 80);
    if (!trimmed) return;

    const customKey = `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newSecId: CvSectionId = `custom:${customKey}`;
    const newItem: CvCustomSection = {
      id: customKey,
      title: trimmed,
      content: '',
    };

    onChange({
      ...content,
      custom_sections: [...(content.custom_sections ?? []), newItem],
      section_order: [...section_order, newSecId],
    });
    if (onPresetChange) {
      onPresetChange('v1-[#custom]');
    }
    if (onSelectSection) {
      onSelectSection(newSecId);
    }

    setNewSectionTitle('');
    setAddPanelOpen(false);
  }

  function handleRestoreBuiltin(secId: CvSectionId) {
    if (section_order.includes(secId)) return;
    onChange({
      ...content,
      section_order: [...section_order, secId],
      hidden_sections: hidden_sections.filter((id) => id !== secId),
    });
    if (onPresetChange) {
      onPresetChange('v1-[#custom]');
    }
    if (onSelectSection) {
      onSelectSection(secId);
    }
  }

  function removeSection(secId: CvSectionId) {
    if (secId === 'profile' || section_order.length <= 1) return;

    const nextOrder = section_order.filter((id) => id !== secId);
    const nextHidden = hidden_sections.filter((id) => id !== secId);
    const nextTitles = { ...(content.section_titles ?? {}) };
    delete nextTitles[secId];

    let nextCustomSections = content.custom_sections ?? [];
    if (isCustomSectionId(secId)) {
      const key = getCustomSectionKey(secId);
      nextCustomSections = nextCustomSections.filter((item) => item.id !== key);
    }

    onChange({
      ...content,
      section_order: nextOrder,
      hidden_sections: nextHidden,
      custom_sections: nextCustomSections,
      section_titles: nextTitles,
    });
    if (onPresetChange) {
      onPresetChange('v1-[#custom]');
    }

    setConfirmDeleteSecId(null);
    if (editingSecId === secId) {
      setEditingSecId(null);
      setEditingTitle('');
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
            Pilih preset instan, ubah nama, tambah, hapus, atau{' '}
            <strong>tarik dan lepas (Drag &amp; Drop)</strong> kotak bagian untuk mengatur urutan CV
            Anda.
          </p>
        </div>
        <Badge variant={currentPresetId === 'v1-[#custom]' ? 'neutral' : 'open'}>
          Preset: {activePresetDef.shortLabel}
        </Badge>
      </div>

      {/* Preset Selector Grid */}
      <div className="cv-preset-grid" role="group" aria-label="Pilihan Preset Jenis CV">
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
              <span className="cv-preset-card__for">Cocok untuk: {preset.recommendedFor}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar Urutan Bagian + Tambah Bagian */}
      <div className="cv-reorder-toolbar">
        <span className="cv-reorder-toolbar__title">
          Urutan Bagian ({section_order.length} Bagian — seret kotak untuk memindahkan):
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setAddPanelOpen((prev) => !prev);
            setConfirmDeleteSecId(null);
          }}
        >
          {addPanelOpen ? 'Tutup' : '+ Tambah Bagian'}
        </Button>
      </div>

      {addPanelOpen ? (
        <div className="cv-add-section-panel">
          <label htmlFor="cv-new-section-title" className="cv-add-section-label">
            Nama Bagian Baru
          </label>
          <form
            className="cv-add-section-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleAddCustomSection();
            }}
          >
            <input
              id="cv-new-section-title"
              type="text"
              className="input-control"
              maxLength={80}
              placeholder="Contoh: Bahasa, Publikasi, atau Pengalaman Relawan"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
            />
            <Button type="submit" variant="primary" size="sm" disabled={!newSectionTitle.trim()}>
              Tambahkan
            </Button>
          </form>

          {removedBuiltins.length > 0 ? (
            <div className="cv-restore-group">
              <span className="cv-restore-label">Atau tambahkan kembali bagian bawaan:</span>
              <div className="cv-restore-chips">
                {removedBuiltins.map((secId) => (
                  <Button
                    key={secId}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestoreBuiltin(secId)}
                  >
                    + {getSectionDisplayTitle(content, secId)}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <ul className="cv-reorder-list" aria-label="Daftar urutan bagian CV yang dapat digeser">
        {section_order.map((secId, index) => {
          const isHidden = hidden_sections.includes(secId);
          const label = getSectionDisplayTitle(content, secId);
          const isBeingDragged = draggedIndex === index;
          const isOver = dragOverIndex === index && !isBeingDragged;
          const isEditing = editingSecId === secId;
          const isConfirmingDelete = confirmDeleteSecId === secId;
          const canDelete = secId !== 'profile' && section_order.length > 1;

          const itemClass = [
            'cv-reorder-item',
            isHidden ? 'cv-reorder-item--hidden' : '',
            isBeingDragged ? 'cv-reorder-item--dragging' : '',
            isOver ? 'cv-reorder-item--over' : '',
            isEditing ? 'cv-reorder-item--editing' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <li
              key={secId}
              draggable={!isEditing && !isConfirmingDelete}
              onDragStart={(e) => {
                if (isEditing || isConfirmingDelete) return;
                handleDragStart(index, e);
              }}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(index, e)}
              onDragEnd={handleDragEnd}
              className={itemClass}
            >
              {isEditing ? (
                <div className="cv-reorder-edit-row">
                  <div className="cv-reorder-meta" style={{ flex: '1 1 200px' }}>
                    <span className="cv-reorder-handle" aria-hidden="true">
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
                    <input
                      type="text"
                      className="input-control cv-reorder-rename-input"
                      maxLength={80}
                      autoFocus
                      value={editingTitle}
                      aria-label={`Ubah nama bagian ${label}`}
                      placeholder={
                        isCustomSectionId(secId)
                          ? 'Nama bagian tambahan'
                          : 'Kosongkan untuk nama bawaan'
                      }
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitRename(secId);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelRename();
                        }
                      }}
                    />
                  </div>
                  <div className="cv-reorder-edit-actions">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        commitRename(secId);
                      }}
                    >
                      Simpan
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelRename();
                      }}
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="cv-reorder-head">
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
                      <span className="cv-reorder-label" title={label}>
                        {label}
                      </span>
                    </div>

                    <div className="cv-reorder-status">
                      {isHidden ? (
                        <Badge variant="neutral">Tersembunyi</Badge>
                      ) : (
                        <Badge variant="open">Tampil</Badge>
                      )}
                    </div>
                  </div>

                  <div className="cv-reorder-actions">
                    {isConfirmingDelete ? (
                      <div className="cv-reorder-confirm">
                        <span className="cv-reorder-confirm__text">Hapus bagian ini?</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="cv-reorder-confirm-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteSecId(null);
                          }}
                        >
                          Batal
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="cv-reorder-confirm-btn cv-reorder-confirm-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSection(secId);
                          }}
                        >
                          Hapus
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="cv-reorder-moves">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cv-reorder-move-btn"
                            disabled={index === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSection(index, 'up');
                            }}
                            aria-label={`Pindahkan ${label} ke atas`}
                            title="Pindahkan ke atas"
                          >
                            <svg
                              width="14"
                              height="14"
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
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cv-reorder-move-btn"
                            disabled={index === section_order.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSection(index, 'down');
                            }}
                            aria-label={`Pindahkan ${label} ke bawah`}
                            title="Pindahkan ke bawah"
                          >
                            <svg
                              width="14"
                              height="14"
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
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cv-reorder-move-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(secId);
                            }}
                            aria-label={`Ubah nama ${label}`}
                            title="Ubah nama bagian"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.1"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cv-reorder-move-btn cv-reorder-delete-btn"
                            disabled={!canDelete}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSecId(null);
                              setConfirmDeleteSecId(secId);
                            }}
                            aria-label={
                              canDelete
                                ? `Hapus bagian ${label}`
                                : `${label} tidak dapat dihapus`
                            }
                            title={
                              canDelete
                                ? 'Hapus bagian'
                                : 'Identitas & Kontak tidak dapat dihapus (gunakan Sembunyikan)'
                            }
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.1"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </Button>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="cv-reorder-toggle-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleVisibility(secId);
                          }}
                          aria-label={isHidden ? `Tampilkan ${label}` : `Sembunyikan ${label}`}
                        >
                          {isHidden ? 'Tampilkan' : 'Sembunyikan'}
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

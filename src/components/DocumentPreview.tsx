import React, { useState } from 'react';
import { StandardDocument, DocumentSettings, DocumentSection } from '../types/document';
import { Edit2, Check, ListFilter, Users, EyeOff, ChevronDown, Plus, Trash2, Sparkles, AlertCircle } from 'lucide-react';
import {
  formatDecree30LocationDateLine,
  normalizeDecree30Location,
  normalizeDecree30Date,
  formatClauseTitle,
  decodeHtmlEntities,
} from '../utils/decree30Formatter';
import { applyCorrectionToDocument } from '../utils/spellingEngine';

interface Props {
  doc: StandardDocument;
  settings: DocumentSettings;
  onUpdateDoc: (updated: StandardDocument) => void;
  showGuides?: boolean;
  onOpenDiffModal?: () => void;
  isBasicMode?: boolean;
}

export const DocumentPreview: React.FC<Props> = ({
  doc,
  settings,
  onUpdateDoc,
  showGuides = true,
  onOpenDiffModal,
  isBasicMode = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSignersDropdownOpen, setIsSignersDropdownOpen] = useState(false);
  const [isSpellAuditing, setIsSpellAuditing] = useState(false);
  const [spellAuditErrors, setSpellAuditErrors] = useState<Array<{
    id: string;
    original: string;
    suggestion: string;
    reason: string;
    type?: string;
  }>>([]);
  const [activeErrorId, setActiveErrorId] = useState<string | null>(null);
  const [showAuditBanner, setShowAuditBanner] = useState(false);
  const [auditFeedbackMsg, setAuditFeedbackMsg] = useState<string | null>(null);

  const [editableDoc, setEditableDoc] = useState<StandardDocument>({
    ...doc,
    issuingBody: decodeHtmlEntities(doc.issuingBody),
    governingBody: decodeHtmlEntities(doc.governingBody),
    date: normalizeDecree30Date(doc.date),
    location: normalizeDecree30Location(doc.location),
    legalBases: doc.legalBases || [],
    recipientsBottom: doc.recipientsBottom || [],
    sections: doc.sections || [],
  });

  // Sync state if doc changes externally, only when NOT actively editing
  React.useEffect(() => {
    if (isEditing) return;
    const initialSigners = (doc.signers && doc.signers.length > 0)
      ? doc.signers
      : (doc.signerRole
          ? [{ authority: doc.signerAuthority || '', role: doc.signerRole, name: doc.signerName || '' }]
          : (doc.isYouthUnionDoc
              ? [
                  { authority: 'TM. LIÊN ĐỘI', role: 'TỔNG PHỤ TRÁCH', name: doc.signerName || 'Họ và tên 1' },
                  { authority: 'XÁC NHẬN CỦA BGH', role: 'HIỆU TRƯỞNG', name: 'Họ và tên 2' },
                ]
              : [
                  { authority: '', role: 'PHÓ HIỆU TRƯỞNG', name: 'Họ và tên 1' },
                  { authority: doc.signerAuthority || 'TM. BAN GIÁM HIỆU', role: doc.signerRole || 'HIỆU TRƯỞNG', name: doc.signerName || 'Họ và tên 2' },
                ]));

    setEditableDoc({
      ...doc,
      issuingBody: decodeHtmlEntities(doc.issuingBody),
      governingBody: decodeHtmlEntities(doc.governingBody),
      date: normalizeDecree30Date(doc.date),
      location: normalizeDecree30Location(doc.location),
      legalBases: doc.legalBases || [],
      recipientsBottom: doc.recipientsBottom || [],
      sections: doc.sections || [],
      signers: initialSigners,
    });
  }, [doc, isEditing]);

  // Real-time synchronization helper: updates state
  const updateDocState = (updated: StandardDocument) => {
    const cleanUpdated: StandardDocument = {
      ...updated,
      issuingBody: decodeHtmlEntities(updated.issuingBody),
      governingBody: decodeHtmlEntities(updated.governingBody),
    };
    setEditableDoc(cleanUpdated);
    onUpdateDoc(cleanUpdated);
  };

  const handleSave = () => {
    // Tự động chuẩn hóa địa danh và ngày tháng theo Nghị định 30 sau khi người dùng bấm Lưu
    const savedDoc: StandardDocument = {
      ...editableDoc,
      issuingBody: decodeHtmlEntities(editableDoc.issuingBody),
      governingBody: decodeHtmlEntities(editableDoc.governingBody),
      location: normalizeDecree30Location(editableDoc.location),
      date: normalizeDecree30Date(editableDoc.date),
    };
    updateDocState(savedDoc);
    setIsEditing(false);
  };

  const isOfficialLetter = editableDoc.documentType?.toUpperCase().includes('CÔNG VĂN') || !editableDoc.documentType;

  // Handle setting signer count (1 to 5)
  const handleSetSignerCount = (count: number) => {
    let newSigners: { authority?: string; role: string; name: string }[] | undefined = undefined;
    if (count > 1) {
      const existing = editableDoc.signers || [];
      const defaultSigners = editableDoc.isYouthUnionDoc
        ? [
            { authority: 'TM. LIÊN ĐỘI', role: 'TỔNG PHỤ TRÁCH', name: editableDoc.signerName || 'Họ và tên 1' },
            { authority: 'XÁC NHẬN CỦA BGH', role: 'HIỆU TRƯỞNG', name: 'Họ và tên 2' },
            { authority: 'TM. BCH ĐOÀN XÃ', role: 'BÍ THƯ', name: 'Họ và tên 3' },
            { authority: 'TM. HỘI ĐỒNG ĐỘI', role: 'CHỦ TỊCH', name: 'Họ và tên 4' },
            { authority: '', role: 'ĐẠI DIỆN ĐOÀN THỂ', name: 'Họ và tên 5' },
          ]
        : [
            { authority: '', role: 'PHÓ HIỆU TRƯỞNG', name: 'Họ và tên 1' },
            { authority: editableDoc.signerAuthority || 'TM. BAN GIÁM HIỆU', role: editableDoc.signerRole || 'HIỆU TRƯỞNG', name: editableDoc.signerName || 'Họ và tên 2' },
            { authority: 'TM. BCH CÔNG ĐOÀN', role: 'CHỦ TỊCH', name: 'Họ và tên 3' },
            { authority: 'TM. HỘI ĐỒNG ĐỘI', role: 'TỔNG PHỤ TRÁCH', name: 'Họ và tên 4' },
            { authority: '', role: 'ĐẠI DIỆN ĐOÀN THỂ', name: 'Họ và tên 5' },
          ];
      newSigners = [];
      for (let i = 0; i < count; i++) {
        newSigners.push({
          authority: existing[i]?.authority || defaultSigners[i]?.authority || '',
          role: existing[i]?.role || defaultSigners[i]?.role || `CHỨC VỤ ${i + 1}`,
          name: existing[i]?.name || defaultSigners[i]?.name || `Họ và tên ${i + 1}`,
        });
      }
    } else {
      const firstSigner = (editableDoc.signers && editableDoc.signers[0]) || {
        authority: editableDoc.signerAuthority || '',
        role: editableDoc.signerRole || 'HIỆU TRƯỞNG',
        name: editableDoc.signerName || '',
      };
      newSigners = [firstSigner];
    }

    const updated: StandardDocument = {
      ...editableDoc,
      signers: newSigners,
      signerAuthority: newSigners?.[0]?.authority,
      signerRole: newSigners?.[0]?.role || editableDoc.signerRole,
      signerName: newSigners?.[0]?.name || editableDoc.signerName,
    };
    updateDocState(updated);
    setIsSignersDropdownOpen(false);
  };

  const handleRunSpellAudit = async () => {
    setIsSpellAuditing(true);
    setAuditFeedbackMsg(null);
    try {
      const res = await fetch('/api/spellcheck-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: editableDoc }),
      });
      if (!res.ok) throw new Error('Không thể kết nối đến máy chủ');
      const data = await res.json();
      if (data.success && Array.isArray(data.errors)) {
        setSpellAuditErrors(data.errors);
        setShowAuditBanner(true);
        if (data.errors.length === 0) {
          setAuditFeedbackMsg('Tuyệt vời! Không phát hiện lỗi chính tả hoặc đánh máy nào.');
          setTimeout(() => setAuditFeedbackMsg(null), 4000);
        }
      } else {
        setAuditFeedbackMsg('Có lỗi xảy ra khi rà soát văn bản.');
      }
    } catch (err: any) {
      setAuditFeedbackMsg('Lỗi khi rà soát: ' + (err.message || 'Vui lòng thử lại sau'));
    } finally {
      setIsSpellAuditing(false);
    }
  };

  const handleApplySingleFix = (err: { id: string; original: string; suggestion: string; reason: string }) => {
    const updated: StandardDocument = JSON.parse(JSON.stringify(editableDoc));
    applyCorrectionToDocument(updated, err.original, err.suggestion, err.reason);
    updateDocState(updated);
    setSpellAuditErrors((prev) => prev.filter((e) => e.id !== err.id));
    if (activeErrorId === err.id) setActiveErrorId(null);
  };

  const handleDismissError = (errId: string) => {
    setSpellAuditErrors((prev) => prev.filter((e) => e.id !== errId));
    if (activeErrorId === errId) setActiveErrorId(null);
  };

  const handleApplyAllFixes = () => {
    if (spellAuditErrors.length === 0) return;
    const count = spellAuditErrors.length;
    const updated: StandardDocument = JSON.parse(JSON.stringify(editableDoc));
    for (const err of spellAuditErrors) {
      applyCorrectionToDocument(updated, err.original, err.suggestion, err.reason);
    }
    updateDocState(updated);
    setSpellAuditErrors([]);
    setActiveErrorId(null);
    setShowAuditBanner(false);
    setAuditFeedbackMsg(`Đã sửa thành công ${count} vị trí lỗi chính tả và đánh máy.`);
    setTimeout(() => setAuditFeedbackMsg(null), 4000);
  };

  const renderHighlighted = (text: string | undefined | null) => {
    if (!text || typeof text !== 'string' || spellAuditErrors.length === 0) return text;

    const activeErrors = spellAuditErrors.filter((e) => e.original && e.original.trim());
    if (activeErrors.length === 0) return text;

    const errorMap = new Map<string, typeof spellAuditErrors[0]>();
    for (const err of activeErrors) {
      errorMap.set(err.original.trim().toLowerCase(), err);
    }

    const patterns = Array.from(errorMap.keys())
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (patterns.length === 0) return text;

    const regex = new RegExp(`(?<=^|[^\\p{L}\\p{M}\\p{N}])(${patterns.join('|')})(?=[^\\p{L}\\p{M}\\p{N}]|$)`, 'giu');

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    regex.lastIndex = 0;
    let matchKey = 0;

    while ((match = regex.exec(text)) !== null) {
      const matchStart = match.index;
      const matchedString = match[0];
      const matchEnd = matchStart + matchedString.length;

      if (matchStart > lastIndex) {
        parts.push(text.slice(lastIndex, matchStart));
      }

      const err = errorMap.get(matchedString.toLowerCase());
      if (err) {
        const isCurrentActive = activeErrorId === err.id;
        parts.push(
          <span key={`audit_err_${matchKey++}`} className="relative inline-block mx-0.5">
            <span
              onClick={(e) => {
                e.stopPropagation();
                setActiveErrorId(isCurrentActive ? null : err.id);
              }}
              className="bg-amber-100 hover:bg-amber-200 text-amber-950 border-b-2 border-dashed border-amber-600 rounded-xs px-1 py-0.5 cursor-pointer font-medium transition-all inline-flex items-center gap-0.5 shadow-2xs"
              title={`Lỗi: "${err.original}" -> "${err.suggestion}" (${err.reason}) - Bấm để xem và sửa`}
            >
              <span>{matchedString}</span>
              <span className="inline-flex items-center justify-center w-3 h-3 text-[9px] bg-amber-600 text-white rounded-full font-bold leading-none">
                !
              </span>
            </span>

            {isCurrentActive && (
              <span
                onClick={(e) => e.stopPropagation()}
                className="absolute z-50 left-0 top-full mt-1.5 w-72 bg-white border border-neutral-300 rounded-lg shadow-2xl p-3 text-xs text-left normal-case font-normal select-text block cursor-default text-neutral-800"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                <span className="flex items-center justify-between font-bold text-neutral-800 pb-1.5 border-b border-neutral-200">
                  <span className="flex items-center gap-1.5 text-amber-800 font-sans">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Gợi ý sửa lỗi chính tả (AI)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveErrorId(null)}
                    className="text-neutral-400 hover:text-neutral-700 text-xs px-1 py-0.5 cursor-pointer rounded"
                  >
                    ✕
                  </button>
                </span>

                <span className="py-2.5 space-y-1.5 block font-sans">
                  <span className="flex items-baseline gap-2">
                    <span className="text-neutral-500 text-[11px] w-14 shrink-0">Từ gốc:</span>
                    <span className="line-through text-rose-600 font-semibold">{err.original}</span>
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-neutral-500 text-[11px] w-14 shrink-0">Gợi ý sửa:</span>
                    <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                      {err.suggestion}
                    </span>
                  </span>
                  <span className="text-[11px] text-neutral-500 italic block pt-0.5">
                    {err.reason}
                  </span>
                </span>

                <span className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 font-sans">
                  <button
                    type="button"
                    onClick={() => handleDismissError(err.id)}
                    className="px-2.5 py-1 text-neutral-600 hover:bg-neutral-100 rounded text-xs cursor-pointer font-sans"
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplySingleFix(err)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded text-xs flex items-center gap-1 shadow-2xs cursor-pointer font-sans"
                  >
                    <Check className="w-3 h-3" />
                    Áp dụng
                  </button>
                </span>
              </span>
            )}
          </span>
        );
      } else {
        parts.push(matchedString);
      }

      lastIndex = matchEnd;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  const renderContentLineWithBoldSections = (line: string) => {
    // Check if line starts with a letter heading (A. ...), Roman heading (I. ...), or Section heading (Phần ..., Chương ...)
    const headingMatch = line.match(/^([IVXLCDM]+\.|\b(?:Phần|Chương|Mục)\s+[IVXLCDM\d]+[.:]?|[A-Z]\.)\s*(.*)/i);
    if (headingMatch && line.length < 120 && !/^(?:căn\s*cứ|theo|kính\s*gửi)/i.test(line)) {
      return <span className="font-bold">{renderHighlighted(line)}</span>;
    }

    // Check if line starts with hierarchical number like "1.1 ", "1.2 ", "1.1.1 " or "Điều 1. "
    const hierMatch = line.match(/^((?:\d+(?:\.\d+)+|\bĐiều\s+\d+)[\.:]?\s*)(.*)/i);
    if (hierMatch) {
      const numPart = hierMatch[1];
      const rest = hierMatch[2];
      const colonIdx = rest.indexOf(':');
      if (colonIdx !== -1 && colonIdx < 60) {
        const titlePart = rest.slice(0, colonIdx + 1);
        const bodyPart = rest.slice(colonIdx + 1);
        return (
          <>
            <span className="font-bold">{numPart}{titlePart}</span>
            <span>{renderHighlighted(bodyPart ? ` ${bodyPart.trim()}` : '')}</span>
          </>
        );
      } else if (rest.length < 90 && !/[.!?]$/.test(rest.trim())) {
        return <span className="font-bold">{renderHighlighted(line)}</span>;
      } else {
        return (
          <>
            <span className="font-bold">{numPart}</span>
            <span>{renderHighlighted(rest)}</span>
          </>
        );
      }
    }

    // Check if line starts with single digit number with colon title e.g. "1. Mục đích: "
    const singleNumMatch = line.match(/^(\d+[\.:]\s*)([^:\n]{1,50}:\s*)(.*)/);
    if (singleNumMatch) {
      return (
        <>
          <span className="font-bold">{singleNumMatch[1]}{singleNumMatch[2]}</span>
          <span>{renderHighlighted(singleNumMatch[3])}</span>
        </>
      );
    }

    return <span>{renderHighlighted(line)}</span>;
  };

  const renderSubItemWithBoldLabel = (item: string) => {
    // E.g. "- Đối tượng: Học sinh..." or "a) Về học tập: ..." or "- Thời gian: ..."
    const colonMatch = item.match(/^([\-\–\—\•\*\+]?\s*(?:[a-zA-Z]\)|[IVXLCDM]+\)|\d+\))?\s*[^:\n]{2,40}:\s*)(.*)/);
    if (colonMatch && !/(?:https?|ftp):/i.test(colonMatch[1])) {
      return (
        <>
          <span className="font-bold">{colonMatch[1]}</span>
          <span>{renderHighlighted(colonMatch[2])}</span>
        </>
      );
    }
    return renderHighlighted(item);
  };

  return (
    <div className="flex flex-col items-center w-full" onClick={() => setActiveErrorId(null)}>
      {/* Top bar controls for document */}
      <div className="w-full max-w-[850px] flex flex-wrap items-center justify-between gap-2 py-2 px-3 mb-2 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-600 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {onOpenDiffModal && !isBasicMode && (
            <button
              onClick={onOpenDiffModal}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <ListFilter className="w-3.5 h-3.5 text-neutral-600" />
              <span>Chi tiết lỗi & kết quả chỉnh sửa</span>
              {editableDoc.diffCorrections && editableDoc.diffCorrections.length > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded-full text-[10px] font-bold">
                  {editableDoc.diffCorrections.length}
                </span>
              )}
            </button>
          )}

          {/* NÚT RÀ SOÁT LỖI CHÍNH TẢ BẰNG AI (THEO YÊU CẦU CỦA THẦY) */}
          <button
            onClick={handleRunSpellAudit}
            disabled={isSpellAuditing}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              isSpellAuditing
                ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-wait'
                : spellAuditErrors.length > 0
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-300'
            }`}
            title="Sử dụng AI rà soát toàn bộ văn bản để tìm và highlight các lỗi chính tả, đánh máy, gợi ý sửa trực tiếp mà không làm thay đổi nội dung gốc"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isSpellAuditing ? 'animate-spin text-amber-500' : 'text-amber-600'}`} />
            <span>{isSpellAuditing ? 'Đang rà soát bằng AI...' : 'Rà soát lỗi chính tả'}</span>
            {spellAuditErrors.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                {spellAuditErrors.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
            {/* Quick toggle for Youth Union Document mode */}
            <button
              onClick={() => {
                const nextVal = !editableDoc.isYouthUnionDoc;
                let nextGov = editableDoc.governingBody;
                let nextIssuing = editableDoc.issuingBody || 'TRƯỜNG';
                let nextNum = editableDoc.documentNumber;

                if (nextVal) {
                  nextGov = 'ĐỘI TNTP HỒ CHÍ MINH';
                  if (!nextIssuing.toUpperCase().startsWith('LIÊN ĐỘI')) {
                    nextIssuing = `LIÊN ĐỘI ${nextIssuing}`;
                  }
                  if (!nextNum || !nextNum.includes('-LĐ')) {
                    nextNum = 'Số .... /KH-LĐ';
                  }
                } else {
                  if (nextGov === 'ĐỘI TNTP HỒ CHÍ MINH' || nextGov === 'ĐỘI THIẾU NIÊN TIỀN PHONG HỒ CHÍ MINH') {
                    nextGov = '';
                  }
                  nextIssuing = nextIssuing.replace(/^LIÊN ĐỘI\s+/i, '');
                }

                const updated: StandardDocument = {
                  ...editableDoc,
                  isYouthUnionDoc: nextVal,
                  governingBody: nextGov,
                  issuingBody: nextIssuing,
                  documentNumber: nextNum,
                };
                setEditableDoc(updated);
                onUpdateDoc(updated);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                editableDoc.isYouthUnionDoc
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }`}
              title="Bật/Tắt thể thức văn bản Đội TNTP Hồ Chí Minh (không dùng Quốc hiệu - Tiêu ngữ, 3 dấu sao ***)"
            >
              <span>★</span>
              <span>{editableDoc.isYouthUnionDoc ? 'Văn bản Đội (Bật)' : 'Chuyển sang mẫu Đội'}</span>
            </button>

            {/* Toggle: Không sử dụng tiêu đề */}
            <button
              onClick={() => {
                const nextHide = !editableDoc.hideHeaderFooter;
                const updated: StandardDocument = {
                  ...editableDoc,
                  hideHeaderFooter: nextHide,
                };
                setEditableDoc(updated);
                onUpdateDoc(updated);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                editableDoc.hideHeaderFooter
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }`}
              title="Bỏ phần Quốc hiệu, tiêu ngữ, cơ quan, số, địa danh ở trên và nơi nhận, chữ ký ở dưới"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>{editableDoc.hideHeaderFooter ? 'Không dùng tiêu đề (Bật)' : 'Không sử dụng tiêu đề'}</span>
            </button>

            {/* Selector: Số lượng người ký */}
            <div className="relative">
              <button
                onClick={() => setIsSignersDropdownOpen(!isSignersDropdownOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  editableDoc.signers && editableDoc.signers.length > 1
                    ? 'bg-blue-100 text-blue-900 border border-blue-300'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
                title="Chọn số lượng người ký (Mặc định: 2 người ký xếp ngang hàng)"
              >
                <Users className="w-3.5 h-3.5" />
                <span>
                  {editableDoc.signers && editableDoc.signers.length > 1
                    ? (editableDoc.signers.length === 2 ? '2 người ký (mặc định)' : `${editableDoc.signers.length} người ký`)
                    : '1 người ký'}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {isSignersDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-neutral-200 rounded-lg shadow-xl z-50 py-1 text-xs">
                  {[2, 1, 3, 4, 5].map((cnt) => {
                    const isSelected =
                      (cnt === 2 && (!editableDoc.signers || editableDoc.signers.length === 2)) ||
                      (cnt === 1 && editableDoc.signers && editableDoc.signers.length === 1) ||
                      (editableDoc.signers && editableDoc.signers.length === cnt);
                    return (
                      <button
                        key={cnt}
                        onClick={() => handleSetSignerCount(cnt)}
                        className={`w-full text-left px-3 py-2 hover:bg-neutral-100 flex items-center justify-between cursor-pointer ${
                          isSelected ? 'font-bold text-blue-700 bg-blue-50/70' : 'text-neutral-700'
                        }`}
                      >
                        <span>
                          {cnt === 2
                            ? '2 người ký (mặc định)'
                            : cnt === 1
                            ? '1 người ký'
                            : `${cnt} người ký (xếp ngang hàng)`}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (isEditing) {
                  handleSave();
                } else {
                  setIsEditing(true);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                isEditing
                  ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
              }`}
            >
              {isEditing ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Lưu chỉnh sửa
                </>
              ) : (
                <>
                  <Edit2 className="w-3.5 h-3.5" />
                  Chỉnh sửa nhanh
                </>
              )}
            </button>
          </div>
        </div>

      {/* Toast / Feedback Message */}
      {auditFeedbackMsg && (
        <div className="w-full max-w-[850px] mb-3 px-3.5 py-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs font-medium flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{auditFeedbackMsg}</span>
          </div>
          <button
            onClick={() => setAuditFeedbackMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-1.5 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* AI Spellcheck Audit Banner (Theo yêu cầu 10: Highlight & gợi ý sửa trực tiếp trên giao diện mà không làm thay đổi nội dung gốc) */}
      {showAuditBanner && spellAuditErrors.length > 0 && (
        <div className="w-full max-w-[850px] mb-3 p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-lg shadow-sm text-xs text-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-amber-500 text-white rounded-md font-bold text-[10px] flex items-center gap-1 shadow-2xs">
                <Sparkles className="w-3 h-3" />
                AI RÀ SOÁT
              </span>
              <span className="font-bold text-amber-950 text-sm">
                Đã phát hiện {spellAuditErrors.length} lỗi chính tả / đánh máy (văn bản gốc chưa bị thay đổi):
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleApplyAllFixes}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                title="Sửa tất cả các lỗi chính tả và đánh máy này vào văn bản"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Áp dụng tất cả ({spellAuditErrors.length})</span>
              </button>
              <button
                onClick={() => setShowAuditBanner(false)}
                className="px-2.5 py-1.5 text-neutral-600 hover:bg-amber-200/50 rounded-md cursor-pointer transition-colors"
                title="Đóng bảng rà soát (các từ highlight trên văn bản vẫn hiển thị để bạn click sửa)"
              >
                Ẩn bảng
              </button>
            </div>
          </div>

          <p className="text-[11px] text-amber-900 mt-2 mb-2 font-medium">
            💡 Bạn có thể bấm vào từng từ highlight màu vàng trực tiếp trên trang văn bản A4 bên dưới, hoặc chọn "Áp dụng" từng lỗi tại danh sách này:
          </p>

          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pt-1 pr-1">
            {spellAuditErrors.map((err) => (
              <div
                key={err.id}
                className="inline-flex items-center gap-1.5 bg-white border border-amber-200/90 rounded-md px-2.5 py-1 shadow-2xs text-xs"
              >
                <span className="line-through text-rose-600 font-semibold">{err.original}</span>
                <span className="text-neutral-400 font-bold">→</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  {err.suggestion}
                </span>
                <span className="text-[10px] text-neutral-500 max-w-[130px] truncate" title={err.reason}>
                  ({err.reason})
                </span>
                <button
                  type="button"
                  onClick={() => handleApplySingleFix(err)}
                  className="ml-1 px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer font-bold text-[11px] flex items-center gap-0.5"
                  title="Áp dụng sửa từ này"
                >
                  <Check className="w-2.5 h-2.5" /> Sửa
                </button>
                <button
                  type="button"
                  onClick={() => handleDismissError(err.id)}
                  className="text-neutral-400 hover:text-neutral-600 px-1 py-0.5 rounded cursor-pointer text-xs"
                  title="Bỏ qua"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Simulated A4 Paper */}
      <div
        className="w-full max-w-[850px] min-h-[1130px] bg-white shadow-xl border border-neutral-300 rounded-sm relative text-black"
        style={{
          fontFamily: '"Times New Roman", Times, serif',
          paddingTop: `${settings.marginTopMm * 3.78}px`,
          paddingBottom: `${settings.marginBottomMm * 3.78}px`,
          paddingLeft: `${settings.marginLeftMm * 3.78}px`,
          paddingRight: `${settings.marginRightMm * 3.78}px`,
        }}
      >
        {/* Visual Margin Guides if enabled */}
        {showGuides && (
          <div
            className="absolute inset-0 pointer-events-none border border-dashed border-red-200"
            style={{
              top: `${settings.marginTopMm * 3.78}px`,
              bottom: `${settings.marginBottomMm * 3.78}px`,
              left: `${settings.marginLeftMm * 3.78}px`,
              right: `${settings.marginRightMm * 3.78}px`,
            }}
          >
            <span className="absolute -top-4 left-0 text-[10px] text-red-500 font-sans tracking-wide">
              Lề trên {settings.marginTopMm}mm
            </span>
            <span className="absolute top-1/2 -left-6 -translate-y-1/2 -rotate-90 text-[10px] text-red-500 font-sans tracking-wide whitespace-nowrap">
              Lề trái {settings.marginLeftMm}mm (đóng gáy)
            </span>
            <span className="absolute top-1/2 -right-6 -translate-y-1/2 rotate-90 text-[10px] text-red-500 font-sans tracking-wide whitespace-nowrap">
              Lề phải {settings.marginRightMm}mm
            </span>
            <span className="absolute -bottom-4 left-0 text-[10px] text-red-500 font-sans tracking-wide">
              Lề dưới {settings.marginBottomMm}mm
            </span>
          </div>
        )}

        {/* SỐ TRANG THEO NGHỊ ĐỊNH 30 (Canh giữa lề trên, chữ số Ả Rập, cỡ 13-14pt, không đánh số trang thứ nhất) */}
        <div className="w-full flex justify-center items-center mb-3 text-neutral-400 select-none print:hidden">
          <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-500 shadow-2xs">
            <span className="font-semibold text-neutral-700">Đánh số trang (NĐ 30):</span>
            <span>Canh giữa lề trên • Trang 1 không đánh số • Trang 2+ đánh số 2, 3... (tự động trong file Word)</span>
          </div>
        </div>

        {/* HEADER SECTION (2 distinct rows: Row 1 = Cơ quan & Quốc hiệu luôn bắt đầu ở dòng trên cùng; Row 2 = Số ký hiệu & Địa danh ngày tháng ngang hàng nhau ở dòng dưới) */}
        {!editableDoc.hideHeaderFooter && (
          <div className="mb-6">
            {/* Hàng 1: Cơ quan ban hành (Trái) & Quốc hiệu - Tiêu ngữ (Phải) - Luôn bắt đầu ở dòng trên cùng */}
            <div className="grid grid-cols-12 gap-x-2 items-start">
              {/* CỘT TRÁI: Cơ quan chủ quản, Cơ quan ban hành, Đường kẻ /*** */}
              <div className="col-span-6 flex flex-col items-center text-center justify-start pt-0">
                {isEditing ? (
                  <div className="w-full space-y-1 mb-1">
                    <input
                      type="text"
                      value={editableDoc.governingBody || ''}
                      onChange={(e) => updateDocState({ ...editableDoc, governingBody: e.target.value })}
                      placeholder={!isBasicMode && editableDoc.isYouthUnionDoc ? "ĐỘI TNTP HỒ CHÍ MINH" : "Cơ quan chủ quản (nếu có)"}
                      className="w-full text-center text-[12pt] border border-neutral-300 rounded px-1 py-0.5 uppercase"
                    />
                    <input
                      type="text"
                      value={editableDoc.issuingBody}
                      onChange={(e) => updateDocState({ ...editableDoc, issuingBody: e.target.value })}
                      placeholder={!isBasicMode && editableDoc.isYouthUnionDoc ? "LIÊN ĐỘI TRƯỜNG ..." : "Cơ quan ban hành"}
                      className="w-full text-center text-[12pt] font-bold border border-neutral-300 rounded px-1 py-0.5 uppercase"
                    />
                  </div>
                ) : (
                  <>
                    {!isBasicMode && editableDoc.isYouthUnionDoc ? (
                      <>
                        <div className="text-[12pt] leading-snug uppercase tracking-tight text-neutral-900">
                          {editableDoc.governingBody || 'ĐỘI TNTP HỒ CHÍ MINH'}
                        </div>
                        <div className="text-[12pt] leading-snug font-bold uppercase tracking-tight text-black mt-0.5">
                          {editableDoc.issuingBody || 'LIÊN ĐỘI TRƯỜNG TH&THCS BẢO THUẬN'}
                        </div>
                        {/* 3 Asterisks for Youth Union document */}
                        <div className="text-[13pt] font-bold tracking-widest my-1 text-center select-none">
                          ***
                        </div>
                      </>
                    ) : (
                      <>
                        {editableDoc.governingBody && (
                          <div className="text-[12pt] leading-snug uppercase tracking-tight text-neutral-800">
                            {editableDoc.governingBody}
                          </div>
                        )}
                        <div className="text-[12pt] leading-snug font-bold uppercase tracking-tight text-black">
                          {editableDoc.issuingBody || 'TÊN CƠ QUAN'}
                        </div>
                        {/* Underline 1/3 to 1/2 */}
                        <div className="w-16 h-[1px] bg-black my-1.5" />
                      </>
                    )}
                  </>
                )}
              </div>

              {/* CỘT PHẢI: Quốc hiệu, Tiêu ngữ, Đường kẻ - Luôn ở dòng trên cùng */}
              <div className="col-span-6 flex flex-col items-center text-center justify-start pt-0">
                {!isBasicMode && editableDoc.isYouthUnionDoc ? (
                  // Văn bản Đội không dùng Quốc hiệu và Tiêu ngữ ở Row 1
                  <div className="h-full flex items-center justify-center text-transparent select-none min-h-[3.5rem]">
                    &nbsp;
                  </div>
                ) : (
                  <>
                    <div className="text-[12pt] font-bold uppercase tracking-tight text-black leading-snug">
                      CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </div>
                    <div className="text-[13pt] font-bold text-black leading-snug">
                      Độc lập - Tự do - Hạnh phúc
                    </div>
                    {/* Solid line matching length of Tiêu ngữ */}
                    <div className="w-44 h-[1px] bg-black my-1.5" />
                  </>
                )}
              </div>
            </div>

            {/* Hàng 2: Số ký hiệu & Địa danh ngày tháng - Ngang hàng nhau ở dòng dưới cùng của ô */}
            <div className="grid grid-cols-12 gap-x-2 items-start mt-1 pt-1">
              {/* TRÁI: Số ký hiệu */}
              <div className="col-span-6 flex flex-col items-center text-center justify-center">
                {isEditing ? (
                  <input
                    type="text"
                    value={editableDoc.documentNumber}
                    onChange={(e) => updateDocState({ ...editableDoc, documentNumber: e.target.value })}
                    placeholder={!isBasicMode && editableDoc.isYouthUnionDoc ? "Số .... /KH-LĐ" : "Số và ký hiệu"}
                    className="w-full text-center text-[13pt] border border-neutral-300 rounded px-1 py-0.5"
                  />
                ) : (
                  <div className="text-[13pt] leading-normal text-neutral-900 text-center font-normal">
                    {editableDoc.documentNumber || (!isBasicMode && editableDoc.isYouthUnionDoc ? 'Số .... /KH-LĐ' : 'Số: .../...')}
                  </div>
                )}
                {/* Trích yếu nội dung đối với công văn */}
                {isOfficialLetter && editableDoc.subject && (
                  <div className="text-[12pt] italic mt-1 text-center max-w-xs">
                    V/v {editableDoc.subject}
                  </div>
                )}
              </div>

              {/* PHẢI: Địa danh và ngày tháng năm (ngang hàng số ký hiệu theo Nghị định 30, kiểu chữ nghiêng, chữ cái đầu địa danh viết hoa, ngày...tháng...năm chữ thường) */}
              <div className="col-span-6 flex flex-col items-center text-center justify-center">
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editableDoc.location || ''}
                      onChange={(e) => setEditableDoc({ ...editableDoc, location: e.target.value })}
                      placeholder="Địa danh (VD: Hà Nội)"
                      className="w-28 text-center text-[13pt] italic border border-neutral-300 rounded px-1 py-0.5"
                    />
                    <span className="text-[13pt] italic">,</span>
                    <input
                      type="text"
                      value={editableDoc.date || ''}
                      onChange={(e) => setEditableDoc({ ...editableDoc, date: e.target.value })}
                      placeholder="ngày ... tháng ... năm ..."
                      className="w-48 text-center text-[13pt] italic border border-neutral-300 rounded px-1 py-0.5"
                    />
                  </div>
                ) : (
                  <div className="text-[13pt] italic leading-normal text-neutral-900 text-center">
                    {formatDecree30LocationDateLine(editableDoc.location, editableDoc.date)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TITLE & SUBJECT SECTION (for documents with type) */}
        {!isOfficialLetter && (
          <div className="text-center my-6">
            {isEditing ? (
              <div className="space-y-2 max-w-lg mx-auto">
                <input
                  type="text"
                  value={editableDoc.documentType}
                  onChange={(e) => updateDocState({ ...editableDoc, documentType: e.target.value })}
                  placeholder="Tên loại văn bản (QUYẾT ĐỊNH, KẾ HOẠCH...)"
                  className="w-full text-center text-[14pt] font-bold uppercase border border-neutral-300 rounded p-1"
                />
                <textarea
                  value={editableDoc.subject}
                  onChange={(e) => updateDocState({ ...editableDoc, subject: e.target.value })}
                  placeholder="Trích yếu nội dung"
                  rows={2}
                  className="w-full text-center text-[14pt] font-bold border border-neutral-300 rounded p-1"
                />
              </div>
            ) : (
              <>
                <h1 className="text-[14pt] font-bold uppercase leading-snug tracking-normal">
                  {editableDoc.documentType}
                </h1>
                {editableDoc.subject && (
                  <h2 className="text-[14pt] font-bold leading-normal mt-1">
                    {renderHighlighted(editableDoc.subject)}
                  </h2>
                )}
                {/* Line or 3 stars */}
                {!isBasicMode && editableDoc.isYouthUnionDoc ? (
                  <div className="text-[13pt] font-bold tracking-widest text-center mx-auto mt-1 mb-3 select-none">
                    ***
                  </div>
                ) : (
                  <div className="w-24 h-[1px] bg-black mx-auto mt-2 mb-3" />
                )}
              </>
            )}
          </div>
        )}

        {/* TOP RECIPIENT (for Official letters, submission, etc.) */}
        {editableDoc.recipientTop && (
          <div className="text-center my-4 text-[14pt]">
            <span className="font-bold">Kính gửi: </span>
            {isEditing ? (
              <input
                type="text"
                value={editableDoc.recipientTop.replace(/^kính gửi:\s*/i, '')}
                onChange={(e) => updateDocState({ ...editableDoc, recipientTop: `Kính gửi: ${e.target.value}` })}
                className="text-[14pt] border border-neutral-300 rounded px-2 py-0.5 text-center min-w-[280px]"
              />
            ) : (
              <span>{renderHighlighted(editableDoc.recipientTop.replace(/^kính gửi:\s*/i, ''))}</span>
            )}
          </div>
        )}

        {/* LEGAL BASES (Căn cứ ban hành) */}
        {editableDoc.legalBases && editableDoc.legalBases.length > 0 && (
          <div className="space-y-1 mb-5 text-[14pt] leading-[1.3] text-justify">
            {editableDoc.legalBases.map((base, idx) => (
              <p
                key={idx}
                className="italic"
                style={{ textIndent: `${settings.indentMm}mm` }}
              >
                {renderHighlighted(base)}
              </p>
            ))}
          </div>
        )}

        {/* BODY CONTENT: Sections / Articles / Paragraphs */}
        <div
          className="space-y-3 text-justify text-[14pt]"
          style={{
            fontSize: `${settings.fontSize}pt`,
            lineHeight: settings.lineSpacing,
          }}
        >
          {editableDoc.sections && editableDoc.sections.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              {isEditing ? (
                <div className="p-3 bg-neutral-50/90 rounded-lg border border-neutral-300 text-left space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-200 text-xs">
                    <span className="font-bold text-neutral-700">
                      Mục {idx + 1}: {sec.type === 'heading' ? 'Đề mục chính' : sec.type === 'table' ? 'Bảng biểu' : 'Nội dung khoản/đoạn'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newSecs = editableDoc.sections.filter((_, i) => i !== idx);
                        updateDocState({ ...editableDoc, sections: newSecs });
                      }}
                      className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 flex items-center gap-1 cursor-pointer text-xs font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa mục</span>
                    </button>
                  </div>

                  {sec.type === 'heading' ? (
                    <input
                      type="text"
                      value={sec.title || sec.content || ''}
                      placeholder="Tiêu đề đề mục (VD: I. MỤC ĐÍCH, YÊU CẦU)..."
                      onChange={(e) => {
                        const newSecs = [...editableDoc.sections];
                        newSecs[idx] = { ...sec, title: e.target.value };
                        updateDocState({ ...editableDoc, sections: newSecs });
                      }}
                      className="w-full font-bold uppercase text-[13pt] border border-neutral-300 rounded px-2 py-1 bg-white"
                    />
                  ) : sec.type === 'table' || (sec.tableData && sec.tableData.length > 0) ? (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={sec.title || ''}
                        placeholder="Tên bảng biểu..."
                        onChange={(e) => {
                          const newSecs = [...editableDoc.sections];
                          newSecs[idx] = { ...sec, title: e.target.value };
                          updateDocState({ ...editableDoc, sections: newSecs });
                        }}
                        className="w-full font-bold text-center text-[12pt] border border-neutral-300 rounded px-2 py-1 bg-white"
                      />
                      <textarea
                        value={sec.tableData ? sec.tableData.map(r => r.join(' | ')).join('\n') : sec.content}
                        rows={4}
                        placeholder="Dữ liệu các dòng bảng (phân cách bởi dấu |)..."
                        onChange={(e) => {
                          const rows = e.target.value.split('\n').filter(Boolean).map(l => l.split('|').map(c => c.trim()));
                          const newSecs = [...editableDoc.sections];
                          newSecs[idx] = { ...sec, tableData: rows, content: e.target.value };
                          updateDocState({ ...editableDoc, sections: newSecs });
                        }}
                        className="w-full font-mono text-[11pt] border border-neutral-300 rounded p-1.5 bg-white"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={sec.number || ''}
                          placeholder="Số (1., 2...)"
                          onChange={(e) => {
                            const newSecs = [...editableDoc.sections];
                            newSecs[idx] = { ...sec, number: e.target.value };
                            updateDocState({ ...editableDoc, sections: newSecs });
                          }}
                          className="w-20 font-bold text-[12pt] border border-neutral-300 rounded px-2 py-1 bg-white"
                        />
                        <input
                          type="text"
                          value={sec.title || ''}
                          placeholder="Tiêu đề mục..."
                          onChange={(e) => {
                            const newSecs = [...editableDoc.sections];
                            newSecs[idx] = { ...sec, title: e.target.value };
                            updateDocState({ ...editableDoc, sections: newSecs });
                          }}
                          className="flex-1 font-bold text-[12pt] border border-neutral-300 rounded px-2 py-1 bg-white"
                        />
                      </div>
                      <textarea
                        value={sec.content || ''}
                        placeholder="Nội dung chi tiết..."
                        rows={Math.max(2, (sec.content || '').split('\n').length)}
                        onChange={(e) => {
                          const newSecs = [...editableDoc.sections];
                          newSecs[idx] = { ...sec, content: e.target.value };
                          updateDocState({ ...editableDoc, sections: newSecs });
                        }}
                        className="w-full text-[13pt] border border-neutral-300 rounded p-1.5 bg-white leading-relaxed"
                      />
                      <div className="pt-1">
                        <span className="text-[11px] text-neutral-500 font-semibold block mb-0.5">
                          Các gạch đầu dòng con (mỗi dòng 1 ý):
                        </span>
                        <textarea
                          value={(sec.subItems || []).join('\n')}
                          placeholder="Mỗi dòng là một gạch đầu dòng (-) hoặc điểm (a, b, c)..."
                          rows={Math.max(2, (sec.subItems || []).length || 2)}
                          onChange={(e) => {
                            const newSecs = [...editableDoc.sections];
                            newSecs[idx] = { ...sec, subItems: e.target.value.split('\n').filter(Boolean) };
                            updateDocState({ ...editableDoc, sections: newSecs });
                          }}
                          className="w-full text-[12pt] border border-neutral-300 rounded p-1.5 bg-white italic"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Display Mode */
                sec.type === 'heading' ? (
                  <div
                    className="font-bold uppercase text-[14pt] mt-4 mb-2 text-left"
                    style={{ textIndent: `${settings.indentMm}mm` }}
                  >
                    {renderHighlighted(sec.title || sec.content)}
                  </div>
                ) : sec.type === 'image' || sec.imageData ? (
                  <div className="my-5 flex flex-col items-center justify-center p-3 bg-neutral-50/80 rounded-lg border border-neutral-200">
                    <img
                      src={sec.imageData?.startsWith('data:') ? sec.imageData : `data:image/png;base64,${sec.imageData}`}
                      alt={sec.imageCaption || "Hình ảnh văn bản gốc"}
                      className="max-w-full max-h-[380px] object-contain rounded shadow-sm border border-neutral-300"
                    />
                    {(sec.imageCaption || sec.title) && (
                      <p className="text-[12pt] italic text-neutral-600 mt-2 text-center">
                        {sec.imageCaption || sec.title}
                      </p>
                    )}
                  </div>
                ) : sec.type === 'table' || (sec.tableData && sec.tableData.length > 0) ? (
                  <div className="overflow-x-auto my-4">
                    {sec.title && (
                      <div className="font-bold text-center mb-2">{renderHighlighted(sec.title)}</div>
                    )}
                    {sec.tableData && sec.tableData.length > 0 ? (
                      <table className="w-full border-collapse border border-black text-[13pt]">
                        <tbody>
                          {sec.tableData.map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx === 0 ? "font-bold text-center bg-neutral-100/60" : ""}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="border border-black px-2.5 py-1.5 align-top">
                                  {renderHighlighted(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="border border-neutral-300 p-2.5 bg-neutral-50 whitespace-pre-wrap">
                        {renderHighlighted(sec.content)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {(sec.content || '').split('\n').filter(Boolean).length > 0 ? (
                      (sec.content || '').split('\n').filter(Boolean).map((line, lIdx) => (
                        <p key={lIdx} style={{ textIndent: `${settings.indentMm}mm` }}>
                          {lIdx === 0 && sec.number && (
                            <span className="font-bold">{sec.number} </span>
                          )}
                          {lIdx === 0 && sec.title && (
                            <span className="font-bold">
                              {formatClauseTitle(sec.title, Boolean(sec.content))}
                            </span>
                          )}
                          {lIdx === 0 && (sec.number || sec.title) ? (
                            <span>{renderHighlighted(line)}</span>
                          ) : (
                            renderContentLineWithBoldSections(line)
                          )}
                        </p>
                      ))
                    ) : (
                      <p style={{ textIndent: `${settings.indentMm}mm` }}>
                        {sec.number && <span className="font-bold">{sec.number} </span>}
                        {sec.title && (
                          <span className="font-bold">
                            {formatClauseTitle(sec.title, false)}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                )
              )}

              {!isEditing && sec.subItems && sec.subItems.length > 0 && (
                <div className="space-y-1 my-1">
                  {sec.subItems.map((sub, sIdx) => {
                    let clean = sub.trim();
                    clean = clean.replace(/^[\-\–\—\•\*\+]\s*(?=(\d+[\.\)]|[a-zA-Z][\.\)]|[IVXLCDM]+[\.\)]))/i, '');
                    const formatted = /^(\d+[\.\)]|[a-zA-Z][\.\)]|[IVXLCDM]+[\.\)])/i.test(clean)
                      ? clean
                      : clean.startsWith('-') || clean.startsWith('+')
                      ? clean
                      : `- ${clean}`;
                    return (
                      <p
                        key={sIdx}
                        className="text-justify"
                        style={{ textIndent: `${settings.indentMm}mm` }}
                      >
                        {renderSubItemWithBoldLabel(formatted)}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {isEditing && (
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const newSecs: DocumentSection[] = [
                    ...(editableDoc.sections || []),
                    { type: 'paragraph' as const, number: `${(editableDoc.sections || []).length + 1}.`, title: 'Nội dung mới', content: '', subItems: [] }
                  ];
                  updateDocState({ ...editableDoc, sections: newSecs });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-md text-xs font-semibold cursor-pointer border border-neutral-300"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm đoạn/mục mới</span>
              </button>
            </div>
          )}

          {/* Preserve and display any additional images from the original document */}
          {doc.images && doc.images.filter(img => !doc.sections?.some(s => s.imageData === img.data)).length > 0 && (
            <div className="my-6 pt-4 border-t border-neutral-200">
              <div className="text-[12pt] font-bold text-neutral-700 mb-3 text-center uppercase tracking-wide">
                Hình ảnh / sơ đồ từ tài liệu gốc
              </div>
              <div className="space-y-4">
                {doc.images.filter(img => !doc.sections?.some(s => s.imageData === img.data)).map((img, iIdx) => (
                  <div key={iIdx} className="flex flex-col items-center justify-center p-3 bg-neutral-50/80 rounded-lg border border-neutral-200">
                    <img
                      src={img.data}
                      alt={img.caption || `Hình ảnh ${iIdx + 1}`}
                      className="max-w-full max-h-[380px] object-contain rounded shadow-sm border border-neutral-300"
                    />
                    {img.caption && (
                      <p className="text-[12pt] italic text-neutral-600 mt-2 text-center">
                        {img.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SIGNER & RECIPIENT BLOCK (Bảng Nơi nhận & Chữ ký theo Nghị định 30 - Xếp ngang hàng) */}
        {!editableDoc.hideHeaderFooter && (
          <div className="grid grid-cols-12 gap-3 mt-8 pt-4 items-start">
            {/* Cột trái: Nơi nhận (Ô 9b NĐ 30: cỡ 12pt nghiêng đậm, các mục 11pt đứng) */}
            <div
              className={`${
                editableDoc.signers && editableDoc.signers.length >= 3
                  ? 'col-span-3'
                  : 'col-span-4'
              } text-left text-neutral-900`}
            >
              <div className="text-[12pt] font-bold italic mb-1">Nơi nhận:</div>
              {isEditing ? (
                <textarea
                  value={(editableDoc.recipientsBottom || []).join('\n')}
                  onChange={(e) =>
                    updateDocState({
                      ...editableDoc,
                      recipientsBottom: e.target.value.split('\n').filter(Boolean),
                    })
                  }
                  rows={4}
                  className="w-full text-[11pt] border border-neutral-300 rounded p-1"
                />
              ) : (
                <div className="text-[11pt] leading-tight space-y-0.5">
                  {(editableDoc.recipientsBottom || []).length > 0 ? (
                    (editableDoc.recipientsBottom || []).map((item, idx) => {
                      const line = item.startsWith('-') ? item : `- ${item}`;
                      return <div key={idx}>{line}</div>;
                    })
                  ) : (
                    <>
                      <div>- Như trên;</div>
                      <div>- Lưu: VT.</div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Cột phải: Khối chữ ký (Ô 7 NĐ 30: luôn xếp NGANG HÀNG với Nơi nhận) */}
            <div
              className={`${
                editableDoc.signers && editableDoc.signers.length >= 3
                  ? 'col-span-9'
                  : 'col-span-8'
              }`}
            >
              {editableDoc.signers && editableDoc.signers.length > 1 ? (
                /* Nhiều người ký xếp ngang hàng nhau và ngang hàng với Nơi nhận */
                <div
                  className={`grid gap-2 text-center items-stretch ${
                    editableDoc.signers.length === 2
                      ? 'grid-cols-2'
                      : editableDoc.signers.length === 3
                      ? 'grid-cols-3'
                      : editableDoc.signers.length === 4
                      ? 'grid-cols-4'
                      : 'grid-cols-5'
                  }`}
                >
                  {editableDoc.signers.map((signer, sIdx) => (
                    <div key={sIdx} className="flex flex-col items-center justify-between h-full">
                      {isEditing ? (
                        <div className="space-y-1 w-full px-1 flex-1 flex flex-col justify-between">
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={signer.authority || ''}
                              onChange={(e) => {
                                const updatedSigners = [...(editableDoc.signers || [])];
                                updatedSigners[sIdx] = { ...signer, authority: e.target.value };
                                updateDocState({ ...editableDoc, signers: updatedSigners });
                              }}
                              placeholder="Dòng 1: Quyền hạn"
                              className="w-full text-center text-[10pt] font-bold uppercase border border-neutral-300 rounded px-1 py-0.5"
                            />
                            <input
                              type="text"
                              value={signer.role}
                              onChange={(e) => {
                                const updatedSigners = [...(editableDoc.signers || [])];
                                updatedSigners[sIdx] = { ...signer, role: e.target.value };
                                updateDocState({ ...editableDoc, signers: updatedSigners });
                              }}
                              placeholder="Dòng 2: Chức vụ"
                              className="w-full text-center text-[11pt] font-bold uppercase border border-neutral-300 rounded px-1 py-0.5"
                            />
                          </div>
                          <div className="h-12 border border-dashed border-neutral-200 flex items-center justify-center text-neutral-400 text-xs italic my-1">
                            Khung chữ ký {sIdx + 1}
                          </div>
                          <input
                            type="text"
                            value={signer.name}
                            onChange={(e) => {
                              const updatedSigners = [...(editableDoc.signers || [])];
                              updatedSigners[sIdx] = { ...signer, name: e.target.value };
                              updateDocState({ ...editableDoc, signers: updatedSigners });
                            }}
                            placeholder="Họ và tên"
                            className="w-full text-center text-[12pt] font-bold border border-neutral-300 rounded px-1 py-0.5"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-between h-full w-full">
                          <div className="w-full">
                            {/* Dòng 1: Quyền hạn */}
                            {signer.authority ? (
                              <div className="text-[13pt] font-bold uppercase leading-snug">
                                {signer.authority}
                              </div>
                            ) : (editableDoc.signers || []).some((s) => Boolean(s.authority && s.authority.trim())) ? (
                              <div className="text-[13pt] font-bold uppercase leading-snug select-none text-transparent">
                                &nbsp;
                              </div>
                            ) : null}
                            {/* Dòng 2: Chức vụ */}
                            <div className="text-[13pt] font-bold uppercase leading-snug">
                              {signer.role || (editableDoc.isPlaceholder ? `CHỨC VỤ ${sIdx + 1}` : '')}
                            </div>
                            <div className="text-[9pt] italic text-neutral-400 mt-1">
                              (Ký, ghi rõ họ tên)
                            </div>
                          </div>
                          {/* Khoảng trống ký đẩy tên người ký xuống chân cột để thẳng hàng ngang */}
                          <div className="min-h-[50px] flex-1" />
                          {/* Họ và tên: luôn nằm ở chân cột, đặt ngang hàng nhau */}
                          <div className="text-[13pt] font-bold leading-normal">
                            {signer.name ? signer.name : (editableDoc.isPlaceholder ? `Họ và tên ${sIdx + 1}` : <span className="select-none text-transparent">&nbsp;</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* 1 người ký chuẩn NĐ 30 (căn giữa cột bên phải, ngang hàng với Nơi nhận) */
                <div className="flex flex-col items-center text-center">
                  {isEditing ? (
                    <div className="space-y-1.5 w-full max-w-xs">
                      <input
                        type="text"
                        value={editableDoc.signers?.[0]?.authority || editableDoc.signerAuthority || ''}
                        onChange={(e) => {
                          const s0 = editableDoc.signers?.[0];
                          const updatedS = s0 ? [{ ...s0, authority: e.target.value }] : [{ authority: e.target.value, role: editableDoc.signerRole || 'HIỆU TRƯỞNG', name: editableDoc.signerName || '' }];
                          updateDocState({ ...editableDoc, signerAuthority: e.target.value, signers: updatedS });
                        }}
                        placeholder="Dòng 1: Quyền hạn (VD: TM. BAN GIÁM HIỆU)"
                        className="w-full text-center text-[12pt] font-bold uppercase border border-neutral-300 rounded px-1 py-0.5"
                      />
                      <input
                        type="text"
                        value={editableDoc.signers?.[0]?.role || editableDoc.signerRole || ''}
                        onChange={(e) => {
                          const s0 = editableDoc.signers?.[0];
                          const updatedS = s0 ? [{ ...s0, role: e.target.value }] : [{ authority: editableDoc.signerAuthority || '', role: e.target.value, name: editableDoc.signerName || '' }];
                          updateDocState({ ...editableDoc, signerRole: e.target.value, signers: updatedS });
                        }}
                        placeholder="Dòng 2: Chức vụ (VD: HIỆU TRƯỞNG)"
                        className="w-full text-center text-[13pt] font-bold uppercase border border-neutral-300 rounded px-1 py-0.5"
                      />
                      <div className="h-14 border border-dashed border-neutral-200 flex items-center justify-center text-neutral-400 text-xs italic">
                        Khung chữ ký
                      </div>
                      <input
                        type="text"
                        value={editableDoc.signers?.[0]?.name || editableDoc.signerName || ''}
                        onChange={(e) => {
                          const s0 = editableDoc.signers?.[0];
                          const updatedS = s0 ? [{ ...s0, name: e.target.value }] : [{ authority: editableDoc.signerAuthority || '', role: editableDoc.signerRole || 'HIỆU TRƯỞNG', name: e.target.value }];
                          updateDocState({ ...editableDoc, signerName: e.target.value, signers: updatedS });
                        }}
                        placeholder="Họ và tên người ký"
                        className="w-full text-center text-[14pt] font-bold border border-neutral-300 rounded px-1 py-0.5"
                      />
                    </div>
                  ) : (
                    <>
                      {(editableDoc.signers?.[0]?.authority || editableDoc.signerAuthority) && (
                        <div className="text-[13pt] font-bold uppercase leading-snug">
                          {editableDoc.signers?.[0]?.authority || editableDoc.signerAuthority}
                        </div>
                      )}
                      <div className="text-[14pt] font-bold uppercase leading-snug">
                        {editableDoc.signers?.[0]?.role || editableDoc.signerRole || 'HIỆU TRƯỞNG'}
                      </div>
                      <div className="text-[9pt] italic text-neutral-400 mt-1 mb-12">
                        (Ký, đóng dấu / ký số)
                      </div>
                      <div className="text-[14pt] font-bold leading-normal">
                        {editableDoc.signers?.[0]?.name || editableDoc.signerName || (editableDoc.isPlaceholder ? 'Họ và tên' : '')}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import {
  Upload,
  Download,
  Sparkles,
  SlidersHorizontal,
  FileCode,
  FileUp,
  Share2,
  Zap,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Bot,
  Search,
  BookOpen,
  Send,
  Layers,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { StandardDocument, DocumentSettings, DEFAULT_SETTINGS } from './types/document';
import { SAMPLE_TEMPLATES, SampleTemplateItem } from './data/sampleDocs';
import { DocumentPreview } from './components/DocumentPreview';
import { SettingsModal } from './components/SettingsModal';
import { ShareModal } from './components/ShareModal';
import { DiffDetailsModal } from './components/DiffDetailsModal';
import { generateDocxBlob } from './utils/docxGenerator';
import { parseDocumentFast } from './utils/fastParser';
import JSZip from 'jszip';

const SHARED_APP_URL = 'https://ais-pre-idtsshpn7bihdbmlf7aiat-125380706573.asia-east1.run.app';

// Gợi ý chủ đề soạn thảo tự động bằng AI theo Nghị định 30
const AI_DRAFT_SUGGESTIONS = [
  {
    title: 'Kế hoạch tổ chức Hội thi GV dạy giỏi cấp trường',
    prompt: 'Kế hoạch tổ chức Hội thi Giáo viên dạy giỏi cấp trường năm học 2024 - 2025 nhằm nâng cao năng lực chuyên môn và đổi mới phương pháp giảng dạy',
    docType: 'KẾ HOẠCH',
    level: 'Trường học / Đơn vị sự nghiệp',
  },
  {
    title: 'Quyết định khen thưởng cá nhân xuất sắc',
    prompt: 'Quyết định khen thưởng các cán bộ, giáo viên và nhân viên có thành tích xuất sắc trong phong trào thi đua dạy tốt học tốt đợt 20/11',
    docType: 'QUYẾT ĐỊNH',
    level: 'Trường học / Đơn vị sự nghiệp',
  },
  {
    title: 'Tờ trình xin cấp kinh phí sửa chữa phòng tin học',
    prompt: 'Tờ trình đề nghị phê duyệt chủ trương và cấp kinh phí sửa chữa, nâng cấp hệ thống máy vi tính phòng học Tin học và thiết bị mạng phục vụ giảng dạy',
    docType: 'TỜ TRÌNH',
    level: 'Trường học / Đơn vị sự nghiệp',
  },
  {
    title: 'Công văn phối hợp đảm bảo an toàn giao thông',
    prompt: 'Công văn gửi Công an xã/phường và Ban An toàn giao thông địa phương về việc phối hợp tăng cường hướng dẫn, điều tiết giao thông và đảm bảo an ninh trật tự cổng trường',
    docType: 'CÔNG VĂN',
    level: 'Trường học / Đơn vị sự nghiệp',
  },
  {
    title: 'Quyết định thành lập Hội đồng coi thi',
    prompt: 'Quyết định thành lập Hội đồng coi thi và chấm thi khảo sát chất lượng giữa học kỳ năm học 2024 - 2025',
    docType: 'QUYẾT ĐỊNH',
    level: 'Trường học / Đơn vị sự nghiệp',
  },
  {
    title: 'Kế hoạch hoạt động Đội TNTP năm học',
    prompt: 'Kế hoạch công tác Đội và phong trào thiếu nhi năm học 2024 - 2025 của Liên đội trường',
    docType: 'KẾ HOẠCH',
    level: 'Trường học / Đơn vị sự nghiệp',
  },
];

export default function App() {
  const [inputMode, setInputMode] = useState<'upload' | 'paste' | 'sample' | 'ai_draft'>('upload');
  const [processingMode, setProcessingMode] = useState<'basic' | 'advanced'>('advanced');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [fileMimeType, setFileMimeType] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasProcessed, setHasProcessed] = useState<boolean>(false);
  const [originalFileName, setOriginalFileName] = useState<string>('');
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isYouthUnionDoc, setIsYouthUnionDoc] = useState<boolean>(false);

  // AI Auto-Draft states
  const [aiDraftPrompt, setAiDraftPrompt] = useState<string>('');
  const [aiDraftDocType, setAiDraftDocType] = useState<string>('Tự động nhận diện');
  const [aiDraftLevel, setAiDraftLevel] = useState<string>('Trường học / Đơn vị sự nghiệp');
  const [aiDraftOrgName, setAiDraftOrgName] = useState<string>('');

  // Sample templates states
  const [sampleCategory, setSampleCategory] = useState<string>('all');
  const [sampleSearch, setSampleSearch] = useState<string>('');

  // Active Standardized Document
  const [currentDoc, setCurrentDoc] = useState<StandardDocument | null>(null);
  const [rawDraftText, setRawDraftText] = useState<string | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'decree30' | 'raw_draft'>('decree30');
  const [copiedDraft, setCopiedDraft] = useState<boolean>(false);
  const [showMarginGuides, setShowMarginGuides] = useState<boolean>(false);
  const [settings, setSettings] = useState<DocumentSettings>(DEFAULT_SETTINGS);

  // Modals
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Switch between Basic and Advanced mode
  const handleSwitchMode = (mode: 'basic' | 'advanced') => {
    setProcessingMode(mode);
    setErrorMsg(null);
    if (mode === 'basic') {
      setIsYouthUnionDoc(false);
      // Basic mode does not support sample templates or AI drafting tabs
      if (inputMode === 'sample' || inputMode === 'ai_draft') {
        setInputMode('upload');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    // Basic mode: ONLY allow .docx and .doc
    if (processingMode === 'basic') {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.docx') && !lower.endsWith('.doc')) {
        setErrorMsg('Chế độ cơ bản chỉ hỗ trợ tệp Word (.docx, .doc). Vui lòng chuyển sang chế độ Nâng cao nếu muốn xử lý PDF hoặc Ảnh chụp.');
        return;
      }
    }

    setSelectedFile(file);
    setOriginalFileName(file.name);
    setHasProcessed(false);
    setCurrentDoc(null);
    setSelectedSampleId(null);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1] || result;
      setFileBase64(base64Data);
      setFileMimeType(file.type || 'application/octet-stream');
    };
    reader.readAsDataURL(file);
  };

  // AI Auto-Draft Execution
  const handleAutoDraft = async () => {
    if (!aiDraftPrompt.trim()) {
      setErrorMsg('Vui lòng nhập nội dung hoặc chủ đề văn bản cần soạn thảo.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setCurrentDoc(null);
    setHasProcessed(false);

    try {
      const response = await fetch('/api/auto-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiDraftPrompt.trim(),
          docType: aiDraftDocType !== 'Tự động nhận diện' ? aiDraftDocType : undefined,
          level: aiDraftLevel,
          orgName: aiDraftOrgName.trim() || undefined,
        }),
      });

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('Máy chủ đang bận xử lý hoặc kết nối mạng bị gián đoạn. Vui lòng bấm thử lại!');
      }

      if (response.ok && data.success && data.document) {
        setCurrentDoc(data.document);
        setRawDraftText(data.rawDraft || null);
        setActivePreviewTab('decree30');
        setHasProcessed(true);
        setOriginalFileName(data.document.subject || data.document.documentType || 'Van_ban_soan_thao_AI');
        if (data.document.isYouthUnionDoc !== undefined) {
          setIsYouthUnionDoc(Boolean(data.document.isYouthUnionDoc));
        }
      } else {
        throw new Error(data?.error || 'Máy chủ AI đang bận. Vui lòng thử lại sau vài giây.');
      }
    } catch (err: any) {
      console.error('Lỗi soạn thảo tự động:', err);
      setErrorMsg(err.message || 'Có lỗi xảy ra trong quá trình soạn thảo bằng AI.');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Document Standardization
  const handleProcessDocument = async () => {
    // If in AI draft mode, delegate to handleAutoDraft
    if (inputMode === 'ai_draft') {
      await handleAutoDraft();
      return;
    }

    setIsLoading(true);
    setHasProcessed(false);
    setErrorMsg(null);

    try {
      let payload: any = {
        mode: processingMode,
        isYouthUnionDoc: processingMode === 'basic' ? false : isYouthUnionDoc,
        customSettings: settings,
      };

      if (inputMode === 'upload' && selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
        let detectedInputType: 'docx' | 'pdf' | 'image' | 'text' = 'docx';
        if (fileExt === 'pdf') detectedInputType = 'pdf';
        else if (['png', 'jpg', 'jpeg', 'webp'].includes(fileExt || '')) detectedInputType = 'image';

        payload.inputType = detectedInputType;
        payload.fileData = fileBase64;
        payload.mimeType = fileMimeType;
      } else if (inputMode === 'paste' || inputMode === 'sample') {
        if (!pastedText.trim()) {
          throw new Error('Vui lòng nhập nội dung văn bản.');
        }
        payload.inputType = 'text';
        payload.textContent = pastedText;
      } else {
        throw new Error('Vui lòng tải lên tệp hoặc dán nội dung văn bản.');
      }

      const response = await fetch('/api/standardize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('Máy chủ đang bận xử lý hoặc kết nối mạng bị gián đoạn. Vui lòng thử lại!');
      }

      if (response.ok && data.success && data.document) {
        if (processingMode === 'basic') {
          data.document.isYouthUnionDoc = false;
          data.document.diffCorrections = [];
        }
        setCurrentDoc(data.document);
        setHasProcessed(true);
        if (data.document.isYouthUnionDoc !== undefined && processingMode !== 'basic') {
          setIsYouthUnionDoc(data.document.isYouthUnionDoc);
        }
      } else {
        throw new Error(data?.error || 'Không nhận diện được cấu trúc văn bản.');
      }
    } catch (err: any) {
      console.error(err);
      if (selectedSampleId) {
        const matched = SAMPLE_TEMPLATES.find((t) => t.id === selectedSampleId);
        if (matched && pastedText === matched.rawText) {
          setCurrentDoc(matched.standardized);
          setHasProcessed(true);
          setIsLoading(false);
          return;
        }
      }
      if (pastedText && pastedText.trim()) {
        const fallback = parseDocumentFast(pastedText, processingMode === 'basic' ? false : isYouthUnionDoc);
        setCurrentDoc(fallback);
        setHasProcessed(true);
        return;
      }
      // If docx upload had an error, try client-side extraction as ultimate safety net
      if (fileBase64 && selectedFile && (selectedFile.name.toLowerCase().endsWith('.docx') || selectedFile.name.toLowerCase().endsWith('.doc'))) {
        try {
          const binary = atob(fileBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const zip = await JSZip.loadAsync(bytes);
          const docXml = zip.file('word/document.xml');
          if (docXml) {
            const xml = await docXml.async('string');
            const text = xml.replace(/<w:p\b[^>]*>/gi, '').replace(/<\/w:p>/gi, '\n').replace(/<[^>]+>/g, '').trim();
            if (text) {
              const fallback = parseDocumentFast(text, processingMode === 'basic' ? false : isYouthUnionDoc);
              setCurrentDoc(fallback);
              setHasProcessed(true);
              return;
            }
          }
        } catch (zErr) {
          console.warn('Fallback error:', zErr);
        }
      }
      setErrorMsg(err.message || 'Có lỗi xảy ra trong quá trình xử lý văn bản.');
    } finally {
      setIsLoading(false);
    }
  };

  // Instant Word (.docx) Download
  const handleDownloadWord = async () => {
    if (!currentDoc) return;
    try {
      const blob = await generateDocxBlob(currentDoc, settings);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      let baseName = '';
      if (originalFileName) {
        baseName = originalFileName.replace(/\.[^/.]+$/, '').trim();
        baseName = baseName.replace(/[\s_-]*(chuẩn\s*NĐ\s*30|chuan\s*nd\s*30)$/i, '').trim();
      } else {
        baseName = (currentDoc.subject || currentDoc.documentType || 'Văn_bản').trim();
      }

      a.href = url;
      a.download = `${baseName} chuẩn NĐ30.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Lỗi tải file Word:', error);
      alert('Không thể tạo file Word. Vui lòng kiểm tra lại trình duyệt.');
    }
  };

  // Filtered sample templates
  const filteredTemplates = SAMPLE_TEMPLATES.filter((tpl) => {
    const matchesCat = sampleCategory === 'all' || tpl.category === sampleCategory;
    const matchesSearch =
      !sampleSearch.trim() ||
      tpl.name.toLowerCase().includes(sampleSearch.toLowerCase()) ||
      tpl.description.toLowerCase().includes(sampleSearch.toLowerCase()) ||
      tpl.standardized.documentType.toLowerCase().includes(sampleSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans">
      {/* 1. TOP BAR */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-white font-bold text-sm">
              30
            </div>
            <div>
              <span className="font-bold text-neutral-900 text-base tracking-tight">
                Văn Thư Chuẩn 30
              </span>
              <span className="text-xs text-neutral-500 ml-2 hidden sm:inline">
                Nghị định 30/2020/NĐ-CP
              </span>
            </div>
          </div>

          {/* Mode Switcher in Header: Cơ bản vs Nâng cao */}
          <div className="flex items-center p-1 bg-neutral-100 rounded-lg border border-neutral-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleSwitchMode('basic')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                processingMode === 'basic'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Chế độ cơ bản: Chỉ cho tải file Word (.docx) và dán văn bản, định dạng chuẩn 30 không sửa chính tả"
            >
              <Zap className="w-3.5 h-3.5 text-blue-600" />
              <span>Cơ bản (Nhanh)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('advanced')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                processingMode === 'advanced'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Chế độ nâng cao: Sửa lỗi chính tả AI, đủ mẫu NĐ 30, tính năng Soạn tự động AI, hỗ trợ PDF & Ảnh"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Nâng cao (Sửa lỗi & Soạn AI)</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Link Share (-pre-)</span>
            </button>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Cài đặt thông số lề và phông"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* INPUT BOX */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow-xs overflow-hidden">
          {/* TABS HEADER: Phân loại theo Cơ bản vs Nâng cao */}
          <div className="flex border-b border-neutral-200 bg-neutral-50/70 px-4 pt-3 gap-2 overflow-x-auto">
            {/* Tab 1: Upload */}
            <button
              onClick={() => setInputMode('upload')}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                inputMode === 'upload'
                  ? 'bg-white text-neutral-900 border-t-2 border-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{processingMode === 'basic' ? 'Tải lên file Word (.docx, .doc)' : 'Tải lên file (Word, PDF, Ảnh)'}</span>
            </button>

            {/* Tab 2: Paste */}
            <button
              onClick={() => setInputMode('paste')}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                inputMode === 'paste'
                  ? 'bg-white text-neutral-900 border-t-2 border-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Dán nội dung</span>
            </button>

            {/* Tabs only available in Advanced mode */}
            {processingMode === 'advanced' && (
              <>
                {/* Tab 3: Mẫu có sẵn */}
                <button
                  onClick={() => setInputMode('sample')}
                  className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    inputMode === 'sample'
                      ? 'bg-white text-neutral-900 border-t-2 border-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Mẫu có sẵn (NĐ 30)</span>
                  <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded-full text-[10px] font-bold">
                    {SAMPLE_TEMPLATES.length}
                  </span>
                </button>

                {/* Tab 4: Soạn tự động bằng AI */}
                <button
                  onClick={() => setInputMode('ai_draft')}
                  className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    inputMode === 'ai_draft'
                      ? 'bg-white text-indigo-900 border-t-2 border-indigo-600 shadow-xs'
                      : 'text-neutral-500 hover:text-indigo-800'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-bold text-indigo-700">Soạn tự động (AI)</span>
                  <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-bold">
                    Mới
                  </span>
                </button>
              </>
            )}
          </div>

          <div className="p-5">
            {/* Tab 1: Upload */}
            {inputMode === 'upload' && (
              <div>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-300 hover:border-neutral-400 rounded-xl p-8 text-center cursor-pointer transition-colors bg-neutral-50/40 hover:bg-neutral-50 flex flex-col items-center justify-center gap-2.5"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={
                      processingMode === 'basic'
                        ? '.docx,.doc'
                        : '.docx,.doc,.pdf,image/png,image/jpeg,image/jpg,image/webp'
                    }
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="w-10 h-10 rounded-full bg-neutral-200/70 flex items-center justify-center text-neutral-700">
                    <FileUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {selectedFile
                        ? selectedFile.name
                        : processingMode === 'basic'
                        ? 'Kéo thả file Word (.docx, .doc) vào đây hoặc nhấp để chọn tệp'
                        : 'Kéo thả file vào đây hoặc nhấp để chọn tệp'}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {processingMode === 'basic'
                        ? 'Chế độ cơ bản chỉ hỗ trợ định dạng Microsoft Word (.docx, .doc)'
                        : 'Hỗ trợ Microsoft Word (.docx), PDF scan (.pdf) hoặc ảnh chụp văn bản (.jpg, .png)'}
                    </p>
                  </div>
                  {selectedFile && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đã chọn ({Math.round(selectedFile.size / 1024)} KB)
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Paste */}
            {inputMode === 'paste' && (
              <div>
                <textarea
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value);
                    if (currentDoc || hasProcessed) {
                      setCurrentDoc(null);
                      setHasProcessed(false);
                    }
                  }}
                  onPaste={() => {
                    setCurrentDoc(null);
                    setHasProcessed(false);
                  }}
                  placeholder={
                    processingMode === 'basic'
                      ? 'Dán nội dung văn bản vào đây để định dạng lại thể thức theo chuẩn Nghị định 30 (căn lề, cỡ chữ, phông Times New Roman, Quốc hiệu - Tiêu ngữ, số ký hiệu, nơi nhận)...'
                      : 'Dán nội dung văn bản vào đây (chương trình sẽ tự động nhận diện, sửa lỗi chính tả, dính chữ, sai dấu, viết hoa và áp dụng đúng thể thức Nghị định 30)...'
                  }
                  rows={7}
                  className="w-full p-3.5 border border-neutral-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            )}

            {/* Tab 3: Mẫu có sẵn (Advanced only) */}
            {processingMode === 'advanced' && inputMode === 'sample' && (
              <div className="space-y-4">
                {/* Search & Category Filter */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between pb-2 border-b border-neutral-200">
                  <div className="flex items-center gap-1 overflow-x-auto text-xs py-1">
                    {[
                      { id: 'all', label: 'Tất cả' },
                      { id: 'Quyết định / Nghị quyết', label: 'Quyết định / NQ' },
                      { id: 'Kế hoạch / Chương trình', label: 'Kế hoạch' },
                      { id: 'Công văn / Tờ trình', label: 'Công văn / Tờ trình' },
                      { id: 'Thông báo / Báo cáo', label: 'Thông báo / Báo cáo' },
                      { id: 'Biên bản / Giấy tờ', label: 'Biên bản / Giấy tờ' },
                      { id: 'Văn bản Đội', label: '★ Văn bản Đội' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSampleCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                          sampleCategory === cat.id
                            ? 'bg-neutral-900 text-white shadow-2xs'
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={sampleSearch}
                      onChange={(e) => setSampleSearch(e.target.value)}
                      placeholder="Tìm kiếm mẫu văn bản..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                </div>

                {/* Grid of Templates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {filteredTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => {
                        setSelectedSampleId(tpl.id);
                        setPastedText(tpl.rawText);
                        setOriginalFileName(tpl.name);
                        setCurrentDoc(null);
                        setHasProcessed(false);
                        setIsYouthUnionDoc(Boolean(tpl.standardized.isYouthUnionDoc));
                      }}
                      className={`p-3 border rounded-lg cursor-pointer transition-all flex flex-col justify-between ${
                        selectedSampleId === tpl.id
                          ? 'border-neutral-900 bg-neutral-50 shadow-xs ring-1 ring-neutral-900'
                          : 'border-neutral-200 hover:border-neutral-400 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                            {tpl.standardized.documentType}
                          </span>
                          {selectedSampleId === tpl.id && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          )}
                        </div>
                        <h3 className="font-semibold text-neutral-900 text-xs line-clamp-1">{tpl.name}</h3>
                        <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>
                    </div>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <div className="col-span-full py-8 text-center text-xs text-neutral-500">
                      Không tìm thấy mẫu văn bản phù hợp với từ khóa "{sampleSearch}".
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Soạn tự động bằng AI (Advanced only) */}
            {processingMode === 'advanced' && inputMode === 'ai_draft' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-indigo-600" />
                      <span>Trí tuệ nhân tạo AI - Soạn thảo văn bản đầy đủ theo Nghị định 30</span>
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Chỉ cần nhập chủ đề hoặc yêu cầu, AI sẽ tự động soạn thảo đầy đủ nội dung từ A-Z (không chỉ đề mục) đảm bảo chuẩn thể thức từ Trung ương đến Địa phương.
                    </p>
                  </div>
                </div>

                {/* Main Prompt Textarea */}
                <div>
                  <textarea
                    value={aiDraftPrompt}
                    onChange={(e) => {
                      setAiDraftPrompt(e.target.value);
                      if (currentDoc || hasProcessed) {
                        setCurrentDoc(null);
                        setHasProcessed(false);
                      }
                    }}
                    placeholder="Nhập yêu cầu soạn thảo văn bản. Ví dụ: Kế hoạch tổ chức Hội thi giáo viên dạy giỏi cấp trường năm học 2024-2025; Quyết định khen thưởng cá nhân có thành tích xuất sắc đợt thi đua 20/11; Tờ trình xin cấp kinh phí sửa chữa phòng tin học..."
                    rows={4}
                    className="w-full p-3.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                {/* Suggestion Chips */}
                <div>
                  <div className="text-[11px] font-semibold text-neutral-600 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Gợi ý mẫu soạn nhanh (nhấp để điền):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_DRAFT_SUGGESTIONS.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAiDraftPrompt(sug.prompt);
                          setAiDraftDocType(sug.docType);
                          setAiDraftLevel(sug.level);
                          setCurrentDoc(null);
                          setHasProcessed(false);
                        }}
                        className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs rounded-full border border-neutral-200 transition-colors text-left cursor-pointer"
                      >
                        {sug.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional Settings Row: Level, DocType, Agency */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-neutral-100">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Cấp hành chính
                    </label>
                    <select
                      value={aiDraftLevel}
                      onChange={(e) => setAiDraftLevel(e.target.value)}
                      className="w-full text-xs border border-neutral-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    >
                      <option value="Trường học / Đơn vị sự nghiệp">Trường học / Đơn vị sự nghiệp</option>
                      <option value="Xã / Phường / Thị trấn">Xã / Phường / Thị trấn</option>
                      <option value="Quận / Huyện / Thị xã">Quận / Huyện / Thị xã</option>
                      <option value="Tỉnh / Thành phố trực thuộc TW">Tỉnh / Thành phố</option>
                      <option value="Bộ / Ngành / Trung ương">Bộ / Ngành / Trung ương</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Loại văn bản
                    </label>
                    <select
                      value={aiDraftDocType}
                      onChange={(e) => setAiDraftDocType(e.target.value)}
                      className="w-full text-xs border border-neutral-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    >
                      <option value="Tự động nhận diện">Tự động nhận diện theo yêu cầu</option>
                      <option value="KẾ HOẠCH">Kế hoạch</option>
                      <option value="QUYẾT ĐỊNH">Quyết định</option>
                      <option value="TỜ TRÌNH">Tờ trình</option>
                      <option value="CÔNG VĂN">Công văn</option>
                      <option value="THÔNG BÁO">Thông báo</option>
                      <option value="QUY CHẾ">Quy chế</option>
                      <option value="BIÊN BẢN">Biên bản</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Tên cơ quan ban hành (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={aiDraftOrgName}
                      onChange={(e) => setAiDraftOrgName(e.target.value)}
                      placeholder="VD: Trường THCS Nguyễn Trãi..."
                      className="w-full text-xs border border-neutral-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                </div>

                {/* Action button inside AI Tab */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleAutoDraft}
                    disabled={isLoading || !aiDraftPrompt.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 disabled:bg-neutral-300 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                    <span>{isLoading ? 'Đang soạn thảo...' : 'Kích hoạt AI soạn văn bản'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error Message if any */}
            {errorMsg && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* OUTPUT AREA: A4 Document Preview */}
        {currentDoc && (
          <div className="py-2">
            {rawDraftText && (
              <div className="max-w-[850px] mx-auto mb-4 bg-white rounded-xl border border-neutral-300 p-2 shadow-sm flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('decree30')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      activePreviewTab === 'decree30'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Bản chuẩn hóa Nghị định 30 (Khổ A4)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreviewTab('raw_draft')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      activePreviewTab === 'raw_draft'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <Bot className="w-4 h-4 text-indigo-600" />
                    <span>Văn bản gốc AI soạn thảo (Toàn văn chuyên sâu)</span>
                  </button>
                </div>

                {activePreviewTab === 'raw_draft' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(rawDraftText);
                        setCopiedDraft(true);
                        setTimeout(() => setCopiedDraft(false), 2000);
                      }}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedDraft ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedDraft ? 'Đã sao chép vào bộ nhớ tạm!' : 'Sao chép toàn văn'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {activePreviewTab === 'raw_draft' && rawDraftText ? (
              <div className="max-w-[850px] mx-auto bg-white rounded-xl shadow-lg border border-neutral-300 p-8 text-neutral-800">
                <div className="flex items-center justify-between pb-4 mb-6 border-b border-neutral-200">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-indigo-600" />
                    <span className="font-bold text-sm text-neutral-900">Văn bản toàn văn do AI khởi tạo (Chất lượng chuyên sâu như ChatGPT/Gemini)</span>
                  </div>
                  <span className="text-xs text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full font-medium">
                    {rawDraftText.length} ký tự
                  </span>
                </div>
                <div className="whitespace-pre-wrap font-serif text-[13pt] leading-relaxed select-text space-y-4">
                  {rawDraftText}
                </div>
              </div>
            ) : (
              <DocumentPreview
                doc={currentDoc}
                settings={settings}
                onUpdateDoc={(updated) => setCurrentDoc(updated)}
                showGuides={showMarginGuides}
                onOpenDiffModal={() => setIsDiffModalOpen(true)}
                isBasicMode={processingMode === 'basic'}
              />
            )}
          </div>
        )}
      </main>

      {/* Pinned Bottom-Right Action Bar */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 print:hidden">
        {isLoading && (
          <div className="flex items-center gap-2.5 px-6 py-3.5 bg-indigo-700 text-white font-bold rounded-2xl shadow-2xl border border-indigo-400 animate-pulse text-sm">
            <Loader2 className="w-5 h-5 animate-spin shrink-0" />
            <div className="flex flex-col text-left">
              <span>{inputMode === 'ai_draft' ? 'Đang kích hoạt AI soạn thảo & chuẩn hóa' : 'Đang xử lý chuẩn hóa'}</span>
              <span className="text-[11px] font-normal text-indigo-200">
                {inputMode === 'ai_draft'
                  ? 'Bước 1: Soạn toàn văn chuyên sâu → Bước 2: Chuẩn hóa NĐ 30'
                  : 'Kiểm định thể thức, lề trang & khối chữ ký'}
              </span>
            </div>
          </div>
        )}

        {!isLoading && hasProcessed && currentDoc && (
          <div className="flex items-center gap-2.5 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-neutral-300 shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-bold rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Đã xử lý xong</span>
            </div>
            {/* Nút Tạo lại cạnh Xử lý xong: Cho phép người dùng yêu cầu tạo lại văn bản gốc mà không cần tải mới lên */}
            <button
              onClick={handleProcessDocument}
              className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-800 font-bold rounded-xl shadow-xs transition-all cursor-pointer text-sm"
              title="Tạo lại văn bản gốc mà không cần tải mới lên"
            >
              <RotateCcw className="w-4 h-4 text-neutral-700" />
              <span>Tạo lại</span>
            </button>
            <button
              onClick={handleDownloadWord}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer text-sm"
              title="Tải về file Word (.docx) chuẩn Nghị định 30"
            >
              <Download className="w-4 h-4" />
              <span>Tải về</span>
            </button>
          </div>
        )}

        {!isLoading && !hasProcessed && (
          <button
            onClick={handleProcessDocument}
            disabled={
              isLoading ||
              (inputMode === 'upload' && !selectedFile) ||
              ((inputMode === 'paste' || inputMode === 'sample') && !pastedText.trim()) ||
              (inputMode === 'ai_draft' && !aiDraftPrompt.trim())
            }
            className={`flex items-center gap-2.5 px-6 py-3.5 ${
              inputMode === 'ai_draft'
                ? 'bg-indigo-700 hover:bg-indigo-800 border-indigo-500'
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700'
            } active:scale-95 disabled:bg-neutral-400 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-2xl border transition-all cursor-pointer text-sm`}
            title={inputMode === 'ai_draft' ? 'Bắt đầu soạn thảo bằng AI' : 'Xử lý văn bản ngay'}
          >
            {inputMode === 'ai_draft' ? (
              <Bot className="w-4.5 h-4.5 text-amber-300" />
            ) : processingMode === 'advanced' ? (
              <Wand2 className="w-4.5 h-4.5 text-amber-300" />
            ) : (
              <Zap className="w-4.5 h-4.5 text-amber-300" />
            )}
            <span>{inputMode === 'ai_draft' ? 'Soạn thảo bằng AI' : 'Xử lý ngay'}</span>
          </button>
        )}
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => setSettings(newSettings)}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        sharedUrl={SHARED_APP_URL}
      />

      {currentDoc && (
        <DiffDetailsModal
          isOpen={isDiffModalOpen}
          onClose={() => setIsDiffModalOpen(false)}
          doc={currentDoc}
        />
      )}
    </div>
  );
}

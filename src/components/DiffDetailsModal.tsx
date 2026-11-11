import React from 'react';
import { X, SpellCheck, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { StandardDocument } from '../types/document';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  doc: StandardDocument;
}

export const DiffDetailsModal: React.FC<Props> = ({ isOpen, onClose, doc }) => {
  if (!isOpen) return null;

  const diffs = doc.diffCorrections || [];
  const audit = doc.auditSummary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl overflow-hidden border border-neutral-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-neutral-900 text-white rounded-lg">
              <SpellCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                Chi Tiết Các Lỗi Đã Được AI Rà Soát & Khắc Phục
              </h2>
              <p className="text-[11px] text-neutral-500">
                Đối chiếu từ sai ban đầu và kết quả chỉnh sửa hoàn thiện
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs text-neutral-700">
          {/* List of corrected words */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-bold text-neutral-900 text-sm">
                Danh sách từ ngữ, chính tả & lỗi gõ đã sửa ({diffs.length} vị trí):
              </span>
            </div>

            {diffs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {diffs.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-1.5 font-mono mb-1 text-xs">
                      <span className="line-through text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                        {item.original}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {item.corrected}
                      </span>
                    </div>
                    {item.reason && (
                      <span className="text-[10px] text-neutral-500 italic mt-0.5">
                        {item.reason}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs">
                Văn bản gốc không có lỗi chính tả hoặc đã được chuẩn hóa trọn vẹn theo quy tắc ngữ pháp.
              </div>
            )}
          </div>

          {/* Decree 30 Compliance Summary */}
          {audit && (
            <div className="pt-4 border-t border-neutral-200">
              <span className="font-bold text-neutral-900 text-sm block mb-2.5">
                Thông số thể thức đã chuẩn hóa theo Nghị định 30/2020/NĐ-CP:
              </span>
              <div className="grid grid-cols-2 gap-2.5 text-xs text-neutral-700 mb-3">
                <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg">
                  <span className="font-semibold text-neutral-900 block">Định lề A4:</span>
                  <span>{audit.margins}</span>
                </div>
                <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg">
                  <span className="font-semibold text-neutral-900 block">Phông chữ & Mã:</span>
                  <span>{audit.font}</span>
                </div>
                <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg">
                  <span className="font-semibold text-neutral-900 block">Giãn dòng & Đoạn:</span>
                  <span>{audit.lineSpacing}</span>
                </div>
                <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg">
                  <span className="font-semibold text-neutral-900 block">Loại văn bản:</span>
                  <span>{audit.detectedType}</span>
                </div>
              </div>

              {audit.correctionsApplied && (
                <div className="space-y-1 text-[11px] text-neutral-600">
                  {audit.correctionsApplied.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

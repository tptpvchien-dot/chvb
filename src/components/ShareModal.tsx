import React, { useState } from 'react';
import { X, Share2, Copy, Check, Globe, Smartphone, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sharedUrl: string;
}

export const ShareModal: React.FC<Props> = ({ isOpen, onClose, sharedUrl }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(sharedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-neutral-900 text-white rounded-lg">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                Chia Sẻ Ứng Dụng (Link Public)
              </h2>
              <p className="text-[11px] text-neutral-500">Mở được trên mọi thiết bị và tài khoản</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" />
            <div>
              <span className="font-semibold">Link chia sẻ công khai chuẩn (-pre-):</span>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Đường dẫn này cho phép đồng nghiệp, giáo viên, học viên hoặc cán bộ văn thư truy cập trực tiếp để chuẩn hóa văn bản mà không yêu cầu quyền chỉnh sửa code.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Đường dẫn liên kết (Shared App URL):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={sharedUrl}
                className="w-full text-xs font-mono bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-800 select-all focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs ${
                  copied
                    ? 'bg-emerald-700 text-white'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Đã chép!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Sao chép
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-neutral-400" /> Web máy tính
            </span>
            <span className="flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-neutral-400" /> Điện thoại & Máy tính bảng
            </span>
            <span>Miễn phí 100%</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { X, Sliders, Check } from 'lucide-react';
import { DocumentSettings, DEFAULT_SETTINGS } from '../types/document';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: DocumentSettings;
  onSaveSettings: (settings: DocumentSettings) => void;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [current, setCurrent] = React.useState<DocumentSettings>(settings);

  React.useEffect(() => {
    setCurrent(settings);
  }, [settings]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-neutral-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-neutral-800" />
            <h2 className="text-sm font-bold text-neutral-900">
              Cài đặt thông số căn chỉnh (Nghị định 30/2020/NĐ-CP)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs text-neutral-700">
          {/* Preset margin choices */}
          <div>
            <label className="block font-semibold text-neutral-900 mb-2">
              Bộ định lề trang in (Quy định: Trên 20-25mm, Dưới 20-25mm, Trái 30-35mm, Phải 15-20mm)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setCurrent({
                    ...current,
                    marginTopMm: 20,
                    marginBottomMm: 20,
                    marginLeftMm: 30,
                    marginRightMm: 15,
                  })
                }
                className={`p-3 text-left border rounded-lg transition-colors ${
                  current.marginLeftMm === 30 && current.marginRightMm === 15
                    ? 'border-emerald-700 bg-emerald-50/60 ring-1 ring-emerald-700'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="font-bold text-neutral-900 flex items-center justify-between">
                  Chuẩn tối ưu (khuyên dùng)
                  {current.marginLeftMm === 30 && current.marginRightMm === 15 && (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  )}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  Trái: 30mm · Phải: 15mm · Trên: 20mm · Dưới: 20mm
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setCurrent({
                    ...current,
                    marginTopMm: 25,
                    marginBottomMm: 25,
                    marginLeftMm: 35,
                    marginRightMm: 20,
                  })
                }
                className={`p-3 text-left border rounded-lg transition-colors ${
                  current.marginLeftMm === 35 && current.marginRightMm === 20
                    ? 'border-emerald-700 bg-emerald-50/60 ring-1 ring-emerald-700'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="font-bold text-neutral-900 flex items-center justify-between">
                  Chuẩn rộng (đóng tập dày)
                  {current.marginLeftMm === 35 && current.marginRightMm === 20 && (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  )}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  Trái: 35mm · Phải: 20mm · Trên: 25mm · Dưới: 25mm
                </div>
              </button>
            </div>
          </div>

          {/* Body font size */}
          <div>
            <label className="block font-semibold text-neutral-900 mb-2">
              Cỡ chữ nội dung văn bản (Times New Roman)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCurrent({ ...current, fontSize: 14 })}
                className={`p-2.5 text-left border rounded-lg transition-colors ${
                  current.fontSize === 14
                    ? 'border-emerald-700 bg-emerald-50/60 ring-1 ring-emerald-700 font-semibold'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="font-bold text-neutral-900">14 pt (Tiêu chuẩn phổ biến nhất)</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">Rõ ràng, dễ đọc khi in ấn</div>
              </button>
              <button
                type="button"
                onClick={() => setCurrent({ ...current, fontSize: 13 })}
                className={`p-2.5 text-left border rounded-lg transition-colors ${
                  current.fontSize === 13
                    ? 'border-emerald-700 bg-emerald-50/60 ring-1 ring-emerald-700 font-semibold'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="font-bold text-neutral-900">13 pt (Tiêu chuẩn văn bản dài)</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">Tiết kiệm số trang</div>
              </button>
            </div>
          </div>

          {/* Line spacing */}
          <div>
            <label className="block font-semibold text-neutral-900 mb-2">
              Khoảng cách giãn dòng (Quy định NĐ 30: tối thiểu dòng đơn, tối đa 1.5 lines)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCurrent({ ...current, lineSpacing: 1.3 })}
                className={`p-2.5 text-left border rounded-lg transition-colors ${
                  current.lineSpacing === 1.3
                    ? 'border-emerald-700 bg-emerald-50/60 ring-1 ring-emerald-700 font-semibold'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="font-bold text-neutral-900">1.3 dòng (Tiêu chuẩn hành chính)</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">Khoảng cách đoạn 6pt</div>
              </button>
              <button
                type="button"
                onClick={() => setCurrent({ ...current, lineSpacing: 1.5 })}
                className={`p-2.5 text-left border rounded-lg transition-colors ${
                  current.lineSpacing === 1.5
                    ? 'border-emerald-700 bg-emerald-50/60 ring-1 ring-emerald-700 font-semibold'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="font-bold text-neutral-900">1.5 dòng (Thoáng mắt)</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">Dành cho văn bản ký nháy/góp ý</div>
              </button>
            </div>
          </div>

          {/* Indentation */}
          <div>
            <label className="block font-semibold text-neutral-900 mb-2">
              Độ thụt đầu dòng đoạn văn (First line indent)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCurrent({ ...current, indentMm: 12.7 })}
                className={`p-2.5 text-left border rounded-lg transition-colors ${
                  current.indentMm === 12.7
                    ? 'border-emerald-700 bg-emerald-50/60 ring-1 ring-emerald-700 font-semibold'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="font-bold text-neutral-900">1.27 cm (0.5 inch / Chuẩn quốc tế)</div>
              </button>
              <button
                type="button"
                onClick={() => setCurrent({ ...current, indentMm: 10 })}
                className={`p-2.5 text-left border rounded-lg transition-colors ${
                  current.indentMm === 10
                    ? 'border-emerald-700 bg-emerald-50/60 ring-1 ring-emerald-700 font-semibold'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="font-bold text-neutral-900">1.0 cm (Chuẩn gọn)</div>
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrent(DEFAULT_SETTINGS)}
            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Khôi phục mặc định
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-neutral-300 text-neutral-700 rounded-lg text-xs font-medium hover:bg-neutral-100 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveSettings(current);
                onClose();
              }}
              className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Áp dụng cài đặt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

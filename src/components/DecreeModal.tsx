import React from 'react';
import { X, FileText, Download, CheckCircle2, BookOpen, ExternalLink } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const DecreeModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const pdfUrl = '/assets/aistudio/30.signed_be251446.pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-700 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Nghị định số 30/2020/NĐ-CP của Chính phủ về Công tác Văn thư
              </h2>
              <p className="text-xs text-neutral-500">
                Ban hành ngày 05/03/2020 · Quy chuẩn quốc gia về thể thức & kỹ thuật trình bày văn bản
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={pdfUrl}
              download="30.signed_ND_CP_Cong_tac_van_thu.pdf"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Tải file PDF gốc ({'>'}76 trang)
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-neutral-700">
          {/* Quick Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Khổ giấy & Hướng
              </div>
              <div className="text-base font-bold text-slate-900">Khổ A4 (Đứng)</div>
              <div className="text-xs text-slate-600 mt-1">210 mm × 297 mm</div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Quy chuẩn Căn lề
              </div>
              <div className="text-sm font-bold text-slate-900">Trái: 30 - 35 mm</div>
              <div className="text-xs text-slate-600 mt-0.5">Phải: 15 - 20 mm · Trên/Dưới: 20 - 25 mm</div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Phông chữ & Mã
              </div>
              <div className="text-base font-bold text-slate-900">Times New Roman</div>
              <div className="text-xs text-slate-600 mt-1">Unicode TCVN 6909:2001, màu đen</div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Giãn dòng & Đoạn
              </div>
              <div className="text-sm font-bold text-slate-900">1.3 - 1.5 dòng</div>
              <div className="text-xs text-slate-600 mt-0.5">Cách đoạn min 6pt, thụt dòng 1 - 1.27cm</div>
            </div>
          </div>

          {/* Table of Font Sizes and Styles (Bảng Mục V Phụ lục I) */}
          <div>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-700" />
              Bảng quy cách cỡ chữ và kiểu chữ theo Mục V Phụ lục I
            </h3>
            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-100 text-neutral-700 border-b border-neutral-200 font-semibold">
                  <tr>
                    <th className="p-2.5">Thành phần thể thức</th>
                    <th className="p-2.5">Cỡ chữ</th>
                    <th className="p-2.5">Kiểu chữ</th>
                    <th className="p-2.5">Ví dụ minh họa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  <tr>
                    <td className="p-2.5 font-medium">Quốc hiệu</td>
                    <td className="p-2.5">12 - 13</td>
                    <td className="p-2.5">In hoa, đứng, đậm</td>
                    <td className="p-2.5 font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</td>
                  </tr>
                  <tr className="bg-neutral-50/50">
                    <td className="p-2.5 font-medium">Tiêu ngữ</td>
                    <td className="p-2.5">13 - 14</td>
                    <td className="p-2.5">In thường, đứng, đậm (có gạch ngang kín chữ)</td>
                    <td className="p-2.5 font-bold">Độc lập - Tự do - Hạnh phúc</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">Tên cơ quan ban hành</td>
                    <td className="p-2.5">12 - 13</td>
                    <td className="p-2.5">In hoa, đứng, đậm (có gạch ngang 1/3-1/2)</td>
                    <td className="p-2.5 font-bold uppercase">ỦY BAN NHÂN DÂN TỈNH ĐẮK LẮK</td>
                  </tr>
                  <tr className="bg-neutral-50/50">
                    <td className="p-2.5 font-medium">Số, ký hiệu văn bản</td>
                    <td className="p-2.5">13</td>
                    <td className="p-2.5">In thường, đứng</td>
                    <td className="p-2.5">Số: 15/QĐ-UBND</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">Địa danh và thời gian</td>
                    <td className="p-2.5">13 - 14</td>
                    <td className="p-2.5">In thường, nghiêng</td>
                    <td className="p-2.5 italic">Hà Nội, ngày 05 tháng 01 năm 2026</td>
                  </tr>
                  <tr className="bg-neutral-50/50">
                    <td className="p-2.5 font-medium">Tên loại văn bản</td>
                    <td className="p-2.5">13 - 14</td>
                    <td className="p-2.5">In hoa, đứng, đậm, canh giữa</td>
                    <td className="p-2.5 font-bold uppercase">QUYẾT ĐỊNH / KẾ HOẠCH</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">Trích yếu nội dung</td>
                    <td className="p-2.5">13 - 14</td>
                    <td className="p-2.5">In thường, đứng, đậm (có gạch ngang 1/3-1/2)</td>
                    <td className="p-2.5 font-bold">Về việc ban hành quy chế làm việc...</td>
                  </tr>
                  <tr className="bg-neutral-50/50">
                    <td className="p-2.5 font-medium">Căn cứ ban hành</td>
                    <td className="p-2.5">13 - 14</td>
                    <td className="p-2.5">In thường, nghiêng, kết thúc ; hoặc .</td>
                    <td className="p-2.5 italic">Căn cứ Luật Tổ chức chính quyền địa phương...;</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">Nội dung văn bản (Điều, khoản)</td>
                    <td className="p-2.5">13 - 14</td>
                    <td className="p-2.5">In thường, đứng, căn đều 2 bên, lùi 1.27cm</td>
                    <td className="p-2.5">Điều 1. Phạm vi điều chỉnh...</td>
                  </tr>
                  <tr className="bg-neutral-50/50">
                    <td className="p-2.5 font-medium">Quyền hạn & Chức vụ ký</td>
                    <td className="p-2.5">13 - 14</td>
                    <td className="p-2.5">In hoa, đứng, đậm (TM., KT., TL., TUQ.)</td>
                    <td className="p-2.5 font-bold uppercase">TM. ỦY BAN NHÂN DÂN / CHỦ TỊCH</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">Họ tên người ký</td>
                    <td className="p-2.5">13 - 14</td>
                    <td className="p-2.5">In thường, đứng, đậm</td>
                    <td className="p-2.5 font-bold">Nguyễn Văn An</td>
                  </tr>
                  <tr className="bg-neutral-50/50">
                    <td className="p-2.5 font-medium">Nơi nhận</td>
                    <td className="p-2.5">12 (tiêu đề) · 11 (danh sách)</td>
                    <td className="p-2.5">Nghiêng đậm (tiêu đề), đứng thường (các mục)</td>
                    <td className="p-2.5">
                      <span className="italic font-bold">Nơi nhận:</span> - Như Điều 3; - Lưu: VT.
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">Số trang văn bản</td>
                    <td className="p-2.5">13 - 14</td>
                    <td className="p-2.5">Đứng thường, canh giữa lề trên từ trang 2</td>
                    <td className="p-2.5">2, 3, 4... (không đánh số trang 1)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Embedded PDF Viewer preview or link */}
          <div className="p-4 bg-neutral-100 rounded-lg flex items-center justify-between border border-neutral-200">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-neutral-600" />
              <div>
                <div className="font-semibold text-neutral-900 text-xs">
                  Tài liệu pháp lý đính kèm: 30.signed_be251446.pdf
                </div>
                <div className="text-[11px] text-neutral-500">
                  Văn bản có chữ ký số điện tử của Văn phòng Chính phủ ngày 09/03/2020.
                </div>
              </div>
            </div>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-medium rounded-md transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Mở trực tiếp PDF
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Đóng bảng tra cứu
          </button>
        </div>
      </div>
    </div>
  );
};

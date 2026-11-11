export interface StandardDocument {
  governingBody?: string; // Tên cơ quan chủ quản cấp trên (nếu có)
  issuingBody: string; // Tên cơ quan, tổ chức ban hành
  documentNumber: string; // Số và ký hiệu văn bản (e.g. Số: 12/QĐ-UBND)
  location: string; // Địa danh (e.g. Hà Nội)
  date: string; // Ngày tháng năm (e.g. ngày 24 tháng 10 năm 2026)
  documentType: string; // Tên loại văn bản (e.g. QUYẾT ĐỊNH, KẾ HOẠCH, CÔNG VĂN...)
  subject: string; // Trích yếu nội dung văn bản
  recipientTop?: string; // Kính gửi (áp dụng cho công văn, tờ trình, giấy mời...)
  legalBases?: string[]; // Căn cứ ban hành văn bản (in nghiêng)
  sections: DocumentSection[];
  signerAuthority?: string; // Quyền hạn người ký dòng 1 (e.g. TM. HỘI ĐỒNG ĐỘI, TM. BAN GIÁM HIỆU, KT. CHỦ TỊCH...)
  signerRole: string; // Chức vụ người ký dòng 2 (e.g. CHỦ TỊCH, TỔNG PHỤ TRÁCH, HIỆU TRƯỞNG...)
  signerName: string; // Họ và tên người ký
  recipientsBottom: string[]; // Nơi nhận ở góc dưới trái (- Như trên; - Lưu: VT...)
  hideHeaderFooter?: boolean; // Tùy chọn: Không sử dụng tiêu đề (bỏ Quốc hiệu, Tiêu ngữ, Tên cơ quan, Địa danh, ngày tháng số ở trên và Nơi nhận, khối ký tên ở dưới)
  signers?: SignerItem[]; // Danh sách người ký (hỗ trợ 2, 3, 4, 5 người ký xếp ngang hàng)
  diffCorrections?: CorrectionDiffItem[]; // Danh sách các lỗi sai đã được AI sửa (trước -> sau)
  isYouthUnionDoc?: boolean; // Tích chọn: Thể thức văn bản Đội TNTP Hồ Chí Minh (không dùng Quốc hiệu/Tiêu ngữ, dùng 3 dấu sao ***)
  isPlaceholder?: boolean; // Văn bản mẫu có các vị trí giữ chỗ
  images?: AttachedImage[]; // Danh sách hình ảnh từ tài liệu gốc được bảo tồn
  auditSummary?: {
    margins: string;
    font: string;
    lineSpacing: string;
    correctionsApplied: string[];
    detectedType: string;
  };
}

export interface SignerItem {
  authority?: string; // Dòng 1: Quyền hạn (e.g. TM. HỘI ĐỒNG ĐỘI, TM. BAN GIÁM HIỆU, KT. CHỦ TỊCH...)
  role: string; // Dòng 2: Chức vụ (e.g. CHỦ TỊCH, TỔNG PHỤ TRÁCH, HIỆU TRƯỞNG...)
  name: string; // Họ và tên người ký
}

export interface CorrectionDiffItem {
  original: string; // Từ/cụm từ sai ban đầu
  corrected: string; // Từ/cụm từ chuẩn hóa đúng
  reason: string; // Lý do sửa (chính tả, dính chữ, dấu câu, viết hoa...)
}

export interface AttachedImage {
  id: string;
  data: string; // base64 or data URL
  caption?: string;
  mimeType?: string;
  width?: number;
  height?: number;
}

export interface DocumentSection {
  id?: string;
  type: 'article' | 'heading' | 'paragraph' | 'bullet' | 'table' | 'image';
  number?: string; // e.g. "Điều 1.", "Điều 2.", "1.", "a)"
  title?: string; // e.g. "Phạm vi điều chỉnh"
  content: string;
  subItems?: string[];
  tableData?: string[][]; // Ma trận dữ liệu hàng - cột nếu là bảng biểu
  imageData?: string; // Data URL hoặc base64 của hình ảnh từ file gốc
  imageCaption?: string;
  imageId?: string;
  imageWidth?: number;
  imageHeight?: number;
}

export interface DocumentSettings {
  marginTopMm: number; // 20 - 25 mm
  marginBottomMm: number; // 20 - 25 mm
  marginLeftMm: number; // 30 - 35 mm
  marginRightMm: number; // 15 - 20 mm
  fontSize: 13 | 14; // 13pt or 14pt (Decree 30 specifies consistent 13 or 14 for body)
  lineSpacing: 1.3 | 1.4 | 1.5; // 1.3 - 1.5 lines
  indentMm: 10 | 12.7; // 1cm or 1.27cm
}

export const DEFAULT_SETTINGS: DocumentSettings = {
  marginTopMm: 20,
  marginBottomMm: 20,
  marginLeftMm: 30,
  marginRightMm: 15,
  fontSize: 14,
  lineSpacing: 1.3,
  indentMm: 12.7,
};

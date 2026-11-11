import { StandardDocument } from '../types/document';

export interface SampleTemplateItem {
  id: string;
  name: string;
  category: string;
  description: string;
  rawText: string;
  standardized: StandardDocument;
}

export const SAMPLE_TEMPLATES: SampleTemplateItem[] = [
  // 1. Mẫu 1.1: Nghị quyết (cá biệt)
  {
    id: 'nghi-quyet',
    name: 'Mẫu 1.1: Nghị quyết (cá biệt)',
    category: 'Quyết định / Nghị quyết',
    description: 'Nghị quyết của Hội đồng / Ban chấp hành về nhiệm vụ công tác',
    rawText: `HOI DONG TRUONG
TRUONG THCS NGUYEN TRAI
So: 03 / NQ - HDT
Ha Noi, ngay 12 thang 9 nam 2026
NGHI QUYET
Ve viec thong qua Ke hoach phat trien nha truong giai doan 2026 - 2030
HOI DONG TRUONG THCS NGUYEN TRAI
Can cu Dieu le truong trung hoc co so ban hanh kem theo Thong tu so 32/2020/TT-BGDDT;
Can cu Nghi dinh so 30/2020/ND-CP ngay 05 thang 3 nam 2020 cua Chinh phu ve cong tac van thu;
Xet de nghi cua Hieu truong nha truong ve Ke hoach phat trien giai doan 2026 - 2030.
QUYET NGHI:
Dieu 1. Thong qua Ke hoach phat trien nha truong giai doan 2026 - 2030 voi cac muc tieu trong tam:
- Xay dung truong dat chuan quoc gia muc do 2 vao nam 2028.
- 100% can bo quan ly va giao vien dat chuan trinh do dao tao theo Luat Giao duc 2019.
- Thuc hien chuyen doi so toan dien trong giang day va quan ly ho so van ban.
Dieu 2. Giao Hieu truong nha truong chi dao xay dung chuong trinh hanh dong va to chuc thuc hien hieu qua Nghi quyet nay.
Dieu 3. Cac thanh vien Hoi dong truong, Ban Giam hieu va cac to chuyen mon chiu trach nhiem thi hanh Nghi quyet nay./.
Noi nhan: Nhu Dieu 3; Phong GD&DT; Luu: VT, HDT.
CHUTICH
Tran Thi Mai`,
    standardized: {
      governingBody: 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO',
      issuingBody: 'HỘI ĐỒNG TRƯỜNG THCS NGUYỄN TRÃI',
      documentNumber: 'Số: 03/NQ-HĐT',
      location: 'Hà Nội',
      date: 'ngày 12 tháng 9 năm 2026',
      documentType: 'NGHỊ QUYẾT',
      subject: 'Về việc thông qua Kế hoạch phát triển nhà trường giai đoạn 2026 - 2030',
      legalBases: [
        'Căn cứ Điều lệ trường trung học cơ sở ban hành kèm theo Thông tư số 32/2020/TT-BGDĐT ngày 15 tháng 9 năm 2020 của Bộ trưởng Bộ Giáo dục và Đào tạo;',
        'Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư;',
        'Xét đề nghị của Hiệu trưởng nhà trường về dự thảo Kế hoạch phát triển giai đoạn 2026 - 2030.',
      ],
      sections: [
        {
          type: 'article',
          number: 'Điều 1.',
          content: 'Thông qua Kế hoạch phát triển nhà trường giai đoạn 2026 - 2030 với các mục tiêu trọng tâm sau:',
          subItems: [
            '- Xây dựng trường đạt chuẩn quốc gia mức độ 2 vào năm 2028;',
            '- 100% cán bộ quản lý và giáo viên đạt chuẩn trình độ đào tạo theo Luật Giáo dục 2019;',
            '- Thực hiện chuyển đổi số toàn diện trong công tác quản lý và dạy học.',
          ],
        },
        {
          type: 'article',
          number: 'Điều 2.',
          content: 'Giao Hiệu trưởng nhà trường chỉ đạo xây dựng chương trình hành động chi tiết, phân công nhiệm vụ cụ thể và tổ chức thực hiện thắng lợi Nghị quyết này.',
        },
        {
          type: 'article',
          number: 'Điều 3.',
          content: 'Các thành viên Hội đồng trường, Ban Giám hiệu và các tổ chuyên môn, đoàn thể chịu trách nhiệm thi hành Nghị quyết này./.',
        },
      ],
      signerAuthority: 'TM. HỘI ĐỒNG TRƯỜNG',
      signerRole: 'CHỦ TỊCH',
      signerName: 'Trần Thị Mai',
      recipientsBottom: [
        '- Như Điều 3;',
        '- Phòng GD&ĐT (để b/c);',
        '- Chi bộ nhà trường;',
        '- Lưu: VT, HĐT.',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'NGHỊ QUYẾT (Cá biệt - Mẫu 1.1)',
        correctionsApplied: ['Chuẩn hóa thể thức Nghị quyết cá biệt theo Mẫu 1.1 Phụ lục III NĐ 30'],
      },
    },
  },

  // 2. Mẫu 1.2: Quyết định (cá biệt - quy định trực tiếp)
  {
    id: 'quyet-dinh',
    name: 'Mẫu 1.2: Quyết định quy định trực tiếp',
    category: 'Quyết định / Nghị quyết',
    description: 'Quyết định bổ nhiệm, kiện toàn, khen thưởng hoặc thành lập hội đồng',
    rawText: `uy ban nhan dan tinh dak lak
so giao duc va dao tao
so: 152 / qd - sgddt
buon ma thuot, ngay 15 thang 9 nam 2026
QUYET DINH
Ve viec kien toan Hoi dong Thi dua - Khen thuong nam hoc 2026 - 2027
GIAM DOC SO GIAO DUC VA DAO TAO
Can cu Luat Thi dua, khen thuong ngay 15 thang 6 nam 2022;
Can cu Nghi dinh so 30/2020/ND-CP ngay 05 thang 3 nam 2020 cua Chinh phu ve cong tac van thu;
Theo de nghi cua Truong phong To chuc can bo.
QUYET DINH:
Dieu 1. Kien toan Hoi dong Thi dua - Khen thuong So Giao duc va Dao tao gom cac ong, ba co ten trong danh sach kem theo.
Dieu 2. Hoi dong co nhiem vu giup Giam doc So chi dao, to chuc thuc hien phong trao thi dua va xet khen thuong theo dung quy dinh.
Dieu 3. Quyet dinh nay co hieu luc ke tu ngay ky.
Dieu 4. Chanh Van phong, Truong phong To chuc can bo va cac ong, ba co ten tai Dieu 1 chiu trach nhiem thi hanh Quyet dinh nay./.
Noi nhan: Nhu Dieu 4; Giam doc va cac Pho Giam doc; Luu: VT, TCCB.
GIAM DOC
Nguyen Van Binh`,
    standardized: {
      governingBody: 'ỦY BAN NHÂN DÂN TỈNH ĐẮK LẮK',
      issuingBody: 'SỞ GIÁO DỤC VÀ ĐÀO TẠO',
      documentNumber: 'Số: 152/QĐ-SGDĐT',
      location: 'Buôn Ma Thuột',
      date: 'ngày 15 tháng 9 năm 2026',
      documentType: 'QUYẾT ĐỊNH',
      subject: 'Về việc kiện toàn Hội đồng Thi đua - Khen thưởng năm học 2026 - 2027',
      legalBases: [
        'Căn cứ Luật Thi đua, khen thưởng ngày 15 tháng 6 năm 2022;',
        'Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư;',
        'Theo đề nghị của Trưởng phòng Tổ chức cán bộ.',
      ],
      sections: [
        {
          type: 'article',
          number: 'Điều 1.',
          content: 'Kiện toàn Hội đồng Thi đua - Khen thưởng Sở Giáo dục và Đào tạo năm học 2026 - 2027 gồm các ông, bà có tên trong danh sách kèm theo.',
        },
        {
          type: 'article',
          number: 'Điều 2.',
          content: 'Hội đồng có nhiệm vụ giúp Giám đốc Sở chỉ đạo, tổ chức thực hiện phong trào thi đua và xét khen thưởng theo đúng quy định hiện hành của Nhà nước.',
        },
        {
          type: 'article',
          number: 'Điều 3.',
          content: 'Quyết định này có hiệu lực thi hành kể từ ngày ký.',
        },
        {
          type: 'article',
          number: 'Điều 4.',
          content: 'Chánh Văn phòng, Trưởng phòng Tổ chức cán bộ và các ông, bà có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này./.',
        },
      ],
      signerAuthority: '',
      signerRole: 'GIÁM ĐỐC',
      signerName: 'Nguyễn Văn Bình',
      recipientsBottom: [
        '- Như Điều 4;',
        '- Giám đốc và các Phó Giám đốc;',
        '- Lưu: VT, TCCB (03b).',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'QUYẾT ĐỊNH (Cá biệt trực tiếp - Mẫu 1.2)',
        correctionsApplied: ['Chuẩn hóa thể thức Quyết định cá biệt trực tiếp theo Mẫu 1.2 NĐ 30'],
      },
    },
  },

  // 3. Mẫu 1.3: Quyết định (quy định gián tiếp - ban hành Quy chế/Quy định/Đề án)
  {
    id: 'quyet-dinh-quy-che',
    name: 'Mẫu 1.3: Quyết định ban hành Quy chế / Quy định',
    category: 'Quyết định / Nghị quyết',
    description: 'Quyết định ban hành kèm theo Quy chế làm việc, Quy tắc ứng xử',
    rawText: `TRUONG THPT CHUYEN LE HONG PHONG
So: 89 / QD - THPT
Nam Dinh, ngay 20 thang 8 nam 2026
QUYET DINH
Ban hanh Quy che quan ly va su dung phong may vi tinh nha truong
HIEU TRUONG TRUONG THPT CHUYEN LE HONG PHONG
Can cu Luat Giao duc ngay 14 thang 6 nam 2019;
Can cu Nghi dinh so 30/2020/ND-CP ngay 05 thang 3 nam 2020 cua Chinh phu;
Theo de nghi cua To truong To Tin hoc.
QUYET DINH:
Dieu 1. Ban hanh kem theo Quyet dinh nay "Quy che quan ly va su dung phong may vi tinh nha truong".
Dieu 2. Quyet dinh nay co hieu luc ke tu ngay ky.
Dieu 3. Ban Giam hieu, To Tin hoc, can bo phu trach phong may va toan the hoc sinh chiu trach nhiem thi hanh Quyet dinh nay./.
Noi nhan: Nhu Dieu 3; So GD&DT; Luu: VT.
HIEU TRUONG
Vu Duc Long`,
    standardized: {
      governingBody: 'SỞ GIÁO DỤC VÀ ĐÀO TẠO',
      issuingBody: 'TRƯỜNG THPT CHUYÊN LÊ HỒNG PHONG',
      documentNumber: 'Số: 89/QĐ-THPT',
      location: 'Nam Định',
      date: 'ngày 20 tháng 8 năm 2026',
      documentType: 'QUYẾT ĐỊNH',
      subject: 'Ban hành Quy chế quản lý và sử dụng phòng máy vi tính nhà trường',
      legalBases: [
        'Căn cứ Luật Giáo dục ngày 14 tháng 6 năm 2019;',
        'Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư;',
        'Theo đề nghị của Tổ trưởng Tổ Tin học.',
      ],
      sections: [
        {
          type: 'article',
          number: 'Điều 1.',
          content: 'Ban hành kèm theo Quyết định này "Quy chế quản lý và sử dụng phòng máy vi tính nhà trường".',
        },
        {
          type: 'article',
          number: 'Điều 2.',
          content: 'Quyết định này có hiệu lực thi hành kể từ ngày ký ban hành.',
        },
        {
          type: 'article',
          number: 'Điều 3.',
          content: 'Ban Giám hiệu, Tổ Tin học, cán bộ phụ trách thiết bị và toàn thể cán bộ, giáo viên, học sinh nhà trường chịu trách nhiệm thi hành Quyết định này./.',
        },
      ],
      signerAuthority: '',
      signerRole: 'HIỆU TRƯỞNG',
      signerName: 'Vũ Đức Long',
      recipientsBottom: [
        '- Như Điều 3;',
        '- Sở GD&ĐT (để b/c);',
        '- Lưu: VT, TH.',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'QUYẾT ĐỊNH (Quy định gián tiếp - Mẫu 1.3)',
        correctionsApplied: ['Chuẩn hóa thể thức ban hành văn bản quy định gián tiếp theo Mẫu 1.3 NĐ 30'],
      },
    },
  },

  // 4. Mẫu 1.4: Chỉ thị (cá biệt)
  {
    id: 'chi-thi',
    name: 'Mẫu 1.4: Chỉ thị (cá biệt)',
    category: 'Quyết định / Nghị quyết',
    description: 'Chỉ thị phát động phong trào thi đua hoặc tăng cường kỷ cương hành chính',
    rawText: `UBND HUYEN GIA VIEN
So: 05 / CT - UBND
Gia Vien, ngay 05 thang 9 nam 2026
CHI THI
Ve viec tang cuong ky cuong hanh chinh va phong chong bao lut tren dia ban huyen
CHU TICH UY BAN NHAN DAN HUYEN GIA VIEN
De chu dong ung pho voi cac dien bien phuc tap cua mua mua bao nam 2026, Chu tich UBND huyen yeu cau:
1. Thu truong cac phong, ban, Chu tich UBND cac xa, thi tran:
- Duy tri che do truc ban 24/24h trong thoi gian co bao.
- Kiem tra toan bo he thong de dieu, cong ranh tren dia ban.
2. Ban Chi huy phong chong thien tai va tim kiem cuu nan huyen thuong xuyen cap nhat thong tin thoi tiet.
3. Yeu cau cac don vi nghiem tuc thuc hien./.
Noi nhan: Nhu khoan 1; Thuong truc Huyen uy; Luu: VT.
CHU TICH
Pham Van Dung`,
    standardized: {
      governingBody: 'ỦY BAN NHÂN DÂN TỈNH NINH BÌNH',
      issuingBody: 'ỦY BAN NHÂN DÂN HUYỆN GIA VIỄN',
      documentNumber: 'Số: 05/CT-UBND',
      location: 'Gia Viễn',
      date: 'ngày 05 tháng 9 năm 2026',
      documentType: 'CHỈ THỊ',
      subject: 'Về việc tăng cường kỷ cương hành chính và chủ động phòng, chống bão lụt năm 2026',
      sections: [
        {
          type: 'paragraph',
          content: 'Để chủ động ứng phó với các diễn biến phức tạp của mùa mưa bão năm 2026, bảo đảm tuyệt đối an toàn tính mạng và tài sản của Nhà nước và nhân dân, Chủ tịch Ủy ban nhân dân huyện yêu cầu Thủ trưởng các phòng, ban, ngành, đoàn thể và Chủ tịch UBND các xã, thị trấn tập trung triển khai các nhiệm vụ trọng tâm sau:',
        },
        {
          type: 'article',
          number: '1.',
          title: 'Duy trì chế độ ứng trực và kiểm tra công trình',
          content: 'Các đơn vị duy trì nghiêm túc chế độ trực ban 24/24 giờ trong suốt thời gian bão lũ. Tổ chức kiểm tra thực địa toàn bộ hệ thống đê điều, hồ đập, các điểm xung yếu.',
        },
        {
          type: 'article',
          number: '2.',
          title: 'Sẵn sàng phương án 4 tại chỗ',
          content: 'Chuẩn bị đầy đủ lực lượng, vật tư, phương tiện dự phòng theo phương châm 4 tại chỗ, kịp thời xử lý sự cố ngay từ giờ đầu.',
        },
        {
          type: 'article',
          number: '3.',
          title: 'Tổ chức thực hiện',
          content: 'Giao Văn phòng HĐND&UBND huyện theo dõi, đôn đốc và tổng hợp tình hình báo cáo Thường trực Huyện ủy, Chủ tịch UBND huyện hàng ngày./.',
        },
      ],
      signerAuthority: '',
      signerRole: 'CHỦ TỊCH',
      signerName: 'Phạm Văn Dũng',
      recipientsBottom: [
        '- Thường trực Huyện ủy (để b/c);',
        '- Chủ tịch, các PCT UBND huyện;',
        '- Các phòng, ban thuộc huyện;',
        '- UBND các xã, thị trấn;',
        '- Lưu: VT, PCTT.',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'CHỈ THỊ (Cá biệt - Mẫu 1.4)',
        correctionsApplied: ['Chuẩn hóa thể thức Chỉ thị cá biệt theo Mẫu 1.4 NĐ 30'],
      },
    },
  },

  // 5. Mẫu 1.5: Quy chế / Quy định
  {
    id: 'quy-che',
    name: 'Mẫu 1.5: Quy chế / Quy định',
    category: 'Quyết định / Nghị quyết',
    description: 'Quy chế văn hóa công sở, quy chế làm việc nội bộ ban hành kèm quyết định',
    rawText: `QUY CHE
Van hoa cong so va ky luat lao dong tai Co quan
(Ban hanh kem theo Quyet dinh so 42/QD-UBND ngay 10/3/2026 cua UBND huyen)
Chuong I
QUY DINH CHUNG
Dieu 1. Pham vi va doi tuong ap dung
Quy che nay quy dinh ve trang phuc, giao tiep ung xu va gio giac lam viec cua toan the can bo, cong chuc.
Dieu 2. Nguyen tac thuc hien
Dam bao tinh trang trong, dung muc, phuc vu tan tuy nhan dan.
Chuong II
QUY DINH CU THE
Dieu 3. Trang phuc lam viec
Can bo cong chuc mac trang phuc lich su, deo the cong chuc trong gio lam viec.`,
    standardized: {
      governingBody: 'ỦY BAN NHÂN DÂN HUYỆN GIA LỘC',
      issuingBody: 'VĂN PHÒNG HĐND & UBND',
      documentNumber: '',
      location: 'Hải Dương',
      date: '',
      documentType: 'QUY CHẾ',
      subject: 'Văn hóa công sở và kỷ cương hành chính tại cơ quan',
      sections: [
        {
          type: 'heading',
          title: 'CHƯƠNG I: QUY ĐỊNH CHUNG',
          content: '',
        },
        {
          type: 'article',
          number: 'Điều 1.',
          title: 'Phạm vi điều chỉnh và đối tượng áp dụng',
          content: 'Quy chế này quy định về chuẩn mực đạo đức công vụ, văn hóa giao tiếp, kỷ luật giờ giấc làm việc và trách nhiệm nêu gương của toàn thể cán bộ, công chức, người lao động.',
        },
        {
          type: 'article',
          number: 'Điều 2.',
          title: 'Nguyên tắc chấp hành kỷ luật kỷ cương',
          content: 'Tôn trọng kỷ cương, nêu cao trách nhiệm người đứng đầu, phục vụ tận tụy nhân dân, không gây phiền hà, sách nhiễu trong giải quyết thủ tục hành chính.',
        },
        {
          type: 'heading',
          title: 'CHƯƠNG II: CHUẨN MỰC GIAO TIẾP VÀ TRANG PHỤC',
          content: '',
        },
        {
          type: 'article',
          number: 'Điều 3.',
          title: 'Trang phục và tác phong công sở',
          content: 'Cán bộ, công chức khi thi hành nhiệm vụ phải mặc trang phục gọn gàng, lịch sự, đeo thẻ công chức đúng quy định. Nghiêm cấm sử dụng rượu bia trong giờ làm việc.',
        },
      ],
      signerAuthority: 'TM. ỦY BAN NHÂN DÂN',
      signerRole: 'CHỦ TỊCH',
      signerName: 'Lê Hoàng Nam',
      recipientsBottom: [
        '- Thường trực HĐND, UBND huyện;',
        '- Các phòng chuyên môn;',
        '- Toàn thể cán bộ, công chức;',
        '- Lưu: VT, NV.',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'QUY CHẾ (Mẫu 1.5)',
        correctionsApplied: ['Chuẩn hóa thể thức Quy chế theo Chương - Điều theo Mẫu 1.5 NĐ 30'],
      },
    },
  },

  // 6. Mẫu 1.7: Thông báo
  {
    id: 'thong-bao',
    name: 'Mẫu 1.7: Thông báo',
    category: 'Thông báo / Báo cáo',
    description: 'Thông báo lịch công tác, lịch nghỉ lễ hoặc kết luận cuộc họp',
    rawText: `TRUONG THCS TRAN PHU
So: 36 / TB - THCS
Hai Phong, ngay 25 thang 8 nam 2026
THONG BAO
Lich nghi le Quoc khanh 02/9 va to chuc Le Khai giang nam hoc 2026 - 2027
Kinh gui: Can bo, giao vien, nhan vien va toan the phu huynh hoc sinh
Can cu quy dinh cua Bo Luat Lao dong ve che do nghi le, Tet;
Can cu Khung ke hoach thoi gian nam hoc 2026 - 2027 cua UBND thanh pho;
Truong THCS Tran Phu thong bao nhu sau:
1. Thoi gian nghi le: Tu thu Bay ngay 31/8/2026 den het thu Ba ngay 03/9/2026.
2. Thoi gian tap trung hoc sinh chuan bi khai giang: 07h30 ngay 04/9/2026.
3. Le Khai giang nam hoc moi: Bat dau tu 07h15 ngay 05/9/2026.
Yeu cau can bo, giao vien va hoc sinh thuc hien dung thoi gian thong bao./.
Noi nhan: Nhu tren; Luu: VT.
HIEU TRUONG
Dang Thi Thuy`,
    standardized: {
      governingBody: 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO',
      issuingBody: 'TRƯỜNG THCS TRẦN PHÚ',
      documentNumber: 'Số: 36/TB-THCS',
      location: 'Hải Phòng',
      date: 'ngày 25 tháng 8 năm 2026',
      documentType: 'THÔNG BÁO',
      subject: 'Lịch nghỉ lễ Quốc khánh 02/9 và công tác chuẩn bị Khai giảng năm học 2026 - 2027',
      sections: [
        {
          type: 'paragraph',
          content: 'Thực hiện quy định của Bộ luật Lao động và khung kế hoạch thời gian năm học 2026 - 2027 của Ủy ban nhân dân thành phố, Trường THCS Trần Phú thông báo lịch nghỉ lễ Quốc khánh và lễ Khai giảng như sau:',
        },
        {
          type: 'article',
          number: '1.',
          title: 'Thời gian nghỉ lễ Quốc khánh 02/9',
          content: 'Toàn thể cán bộ, giáo viên, nhân viên và học sinh nghỉ lễ liên tục 04 ngày, từ thứ Bảy ngày 31 tháng 8 năm 2026 đến hết thứ Ba ngày 03 tháng 9 năm 2026.',
        },
        {
          type: 'article',
          number: '2.',
          title: 'Tập trung học sinh chuẩn bị Khai giảng',
          content: 'Học sinh toàn trường tập trung lúc 07 giờ 30 phút, thứ Tư ngày 04 tháng 9 năm 2026 để tổng duyệt nghi thức Đội và chuẩn bị cho Lễ Khai giảng.',
        },
        {
          type: 'article',
          number: '3.',
          title: 'Tổ chức Lễ Khai giảng năm học 2026 - 2027',
          content: 'Lễ Khai giảng chính thức diễn ra vào lúc 07 giờ 15 phút, thứ Năm ngày 05 tháng 9 năm 2026 tại sân trường. Học sinh mặc đồng phục trang trọng.',
        },
      ],
      signerAuthority: '',
      signerRole: 'HIỆU TRƯỞNG',
      signerName: 'Đặng Thị Thủy',
      recipientsBottom: [
        '- Ban Giám hiệu;',
        '- Các tổ chuyên môn, văn phòng;',
        '- Phụ huynh và học sinh toàn trường;',
        '- Lưu: VT.',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'THÔNG BÁO (Mẫu 1.7)',
        correctionsApplied: ['Định dạng thông báo theo Mẫu 1.7 NĐ 30, bỏ Kính gửi theo đúng thể thức'],
      },
    },
  },

  // 7. Mẫu 1.8: Hướng dẫn
  {
    id: 'huong-dan',
    name: 'Mẫu 1.8: Hướng dẫn chuyên môn',
    category: 'Thông báo / Báo cáo',
    description: 'Hướng dẫn đánh giá xếp loại học sinh, hướng dẫn nghiệp vụ văn thư',
    rawText: `PHONG GIAO DUC VA DAO TAO
So: 18 / HD - PGDDT
Nha Trang, ngay 15 thang 11 nam 2026
HUONG DAN
Cong tac danh gia, xep loai hoc sinh cuoi hoc ky I nam hoc 2026 - 2027
De thuc hien dong bo va cong bang trong viec danh gia ket qua hoc tap va ren luyen cua hoc sinh, Phong GD&DT huong dan cac truong THCS nhu sau:
I. NGUYEN TAC DANH GIA
- Danh gia vi su tien bo cua hoc sinh, ket hop danh gia thuong xuyen va dinh ky.
- Khong so sanh hoc sinh nay voi hoc sinh khac.
II. QUY TRINH THUC HIEN
- Giao vien bo mon hoan thanh cham diem truoc ngay 20/12/2026.
- To chuyen mon to chuc xet duyet va bao cao Ban Giam hieu.`,
    standardized: {
      governingBody: 'ỦY BAN NHÂN DÂN THÀNH PHỐ NHA TRANG',
      issuingBody: 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO',
      documentNumber: 'Số: 18/HD-PGDĐT',
      location: 'Nha Trang',
      date: 'ngày 15 tháng 11 năm 2026',
      documentType: 'HƯỚNG DẪN',
      subject: 'Công tác đánh giá, xếp loại học sinh cuối học kỳ I năm học 2026 - 2027',
      sections: [
        {
          type: 'paragraph',
          content: 'Nhằm thực hiện nghiêm túc, khách quan và công bằng trong việc kiểm tra, đánh giá kết quả rèn luyện và học tập của học sinh, Phòng Giáo dục và Đào tạo hướng dẫn các trường THCS trên địa bàn triển khai các nội dung sau:',
        },
        {
          type: 'heading',
          title: 'I. NGUYÊN TẮC VÀ YÊU CẦU ĐÁNH GIÁ',
          content: '',
        },
        {
          type: 'article',
          number: '1.',
          content: 'Đánh giá vì sự tiến bộ của học sinh; coi trọng việc động viên, khuyến khích sự cố gắng trong học tập và rèn luyện của học sinh.',
        },
        {
          type: 'article',
          number: '2.',
          content: 'Kết hợp đánh giá thường xuyên và đánh giá định kỳ theo đúng Thông tư số 22/2021/TT-BGDĐT của Bộ Giáo dục và Đào tạo.',
        },
        {
          type: 'heading',
          title: 'II. QUY TRÌNH VÀ TIẾN ĐỘ THỰC HIỆN',
          content: '',
        },
        {
          type: 'article',
          number: '1.',
          content: 'Giáo viên bộ môn hoàn thành việc nhập điểm và nhận xét trên hệ thống cơ sở dữ liệu ngành trước ngày 25 tháng 12 năm 2026.',
        },
        {
          type: 'article',
          number: '2.',
          content: 'Hiệu trưởng các trường kiểm tra, phê duyệt học bạ số và báo cáo kết quả về Phòng trước ngày 05 tháng 01 năm 2027./.',
        },
      ],
      signerAuthority: '',
      signerRole: 'TRƯỞNG PHÒNG',
      signerName: 'Nguyễn Thanh Tùng',
      recipientsBottom: [
        '- Lãnh đạo Phòng;',
        '- Các trường THCS trên địa bàn;',
        '- Cán bộ phụ trách chuyên môn THCS;',
        '- Lưu: VT, GDTrH.',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'HƯỚNG DẪN (Mẫu 1.8)',
        correctionsApplied: ['Chuẩn hóa văn bản hướng dẫn theo Mẫu 1.8 NĐ 30'],
      },
    },
  },

  // 8. Mẫu 1.10: Kế hoạch
  {
    id: 'ke-hoach',
    name: 'Mẫu 1.10: Kế hoạch công tác năm học',
    category: 'Kế hoạch / Chương trình',
    description: 'Kế hoạch chuyển đổi số, tổ chức hoạt động, hội thi theo mẫu 1.10 NĐ 30',
    rawText: `TRUONG THCS LE QUY DON
So: 12 / KH - THCS
Da Nang, ngay 10 thang 10 nam 2026
KE HOACH
Chuyen doi so va ung dung cong nghe thong tin nam hoc 2026 - 2027
I. MUC DICH, YEU CAU
1. Nang cao nang luc ung dung cong nghe thong tin cho can bo quan ly va giao vien.
2. 100% ho so so sach duoc so hoa va quan ly tren moi truong mang theo Nghi dinh 30/2020/ND-CP.
II. NOI DUNG THUC HIEN
1. To chuc tap huan so hoa van ban va chu ky so.
2. Trien khai phan mem quan ly van ban va dieu hanh.
III. TO CHUC THUC HIEN
Ban Giam hieu phu trach chung. To Tin hoc chiu trach nhiem ve mat ky thuat.
HIEU TRUONG
Le Thi Thu Ha
Noi nhan: Cac to chuyen mon; Luu: VT.`,
    standardized: {
      governingBody: 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO',
      issuingBody: 'TRƯỜNG THCS LÊ QUÝ ĐÔN',
      documentNumber: 'Số: 12/KH-THCS',
      location: 'Đà Nẵng',
      date: 'ngày 10 tháng 10 năm 2026',
      documentType: 'KẾ HOẠCH',
      subject: 'Chuyển đổi số và ứng dụng công nghệ thông tin năm học 2026 - 2027',
      sections: [
        {
          type: 'heading',
          title: 'I. MỤC ĐÍCH, YÊU CẦU',
          content: '',
        },
        {
          type: 'article',
          number: '1.',
          content: 'Nâng cao năng lực ứng dụng công nghệ thông tin và chuyển đổi số cho toàn thể cán bộ quản lý, giáo viên, nhân viên.',
        },
        {
          type: 'article',
          number: '2.',
          content: '100% hồ sơ sổ sách chuyên môn được số hóa, ký số và quản lý trên môi trường mạng đúng quy chuẩn Nghị định số 30/2020/NĐ-CP của Chính phủ.',
        },
        {
          type: 'heading',
          title: 'II. NỘI DUNG VÀ NHIỆM VỤ TRỌNG TÂM',
          content: '',
        },
        {
          type: 'article',
          number: '1.',
          content: 'Tổ chức tập huấn kỹ năng quản trị văn bản điện tử và tạo lập hồ sơ số.',
        },
        {
          type: 'article',
          number: '2.',
          content: 'Đầu tư hoàn thiện hạ tầng mạng nội bộ, phòng máy vi tính và thiết bị trình chiếu thông minh.',
        },
        {
          type: 'heading',
          title: 'III. TỔ CHỨC THỰC HIỆN',
          content: '',
        },
        {
          type: 'article',
          number: '1.',
          content: 'Ban Giám hiệu phụ trách chung, chỉ đạo đôn đốc tiến độ thực hiện.',
        },
        {
          type: 'article',
          number: '2.',
          content: 'Tổ Tin học chịu trách nhiệm hỗ trợ kỹ thuật và an toàn thông tin dữ liệu./.',
        },
      ],
      signerAuthority: '',
      signerRole: 'HIỆU TRƯỞNG',
      signerName: 'Lê Thị Thu Hà',
      recipientsBottom: [
        '- Ban Giám hiệu;',
        '- Các tổ chuyên môn, văn phòng;',
        '- Lưu: VT, CNTT.',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'KẾ HOẠCH (Mẫu 1.10)',
        correctionsApplied: ['Định dạng kế hoạch theo các phần La Mã và mục số theo Mẫu 1.10 NĐ 30'],
      },
    },
  },

  // 9. Mẫu 1.13: Báo cáo
  {
    id: 'bao-cao',
    name: 'Mẫu 1.13: Báo cáo công tác định kỳ / tổng kết',
    category: 'Thông báo / Báo cáo',
    description: 'Báo cáo sơ kết học kỳ, báo cáo tình hình triển khai công tác',
    rawText: `TRUONG THCS CHU VAN AN
So: 45 / BC - THCS
Ha Noi, ngay 15 thang 01 nam 2027
BAO CAO
So ket cong tac hoc ky I va phuong huong nhiem vu hoc ky II nam hoc 2026 - 2027
I. KET QUA DAT DUOC
1. Ve cong tac day va hoc: Ty le hoc sinh kha, gioi dat tren 85%.
2. Ve cong tac co so vat chat: Hoan thanh nang cap thu vien tien tien.
II. PHUONG HUONG HOC KY II
Tiep tuc nang cao chat luong mui nhon, on luyen thi vao lop 10.
HIEU TRUONG
Doan Van Thang`,
    standardized: {
      governingBody: 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO',
      issuingBody: 'TRƯỜNG THCS CHU VĂN AN',
      documentNumber: 'Số: 45/BC-THCS',
      location: 'Hà Nội',
      date: 'ngày 15 tháng 01 năm 2027',
      documentType: 'BÁO CÁO',
      subject: 'Sơ kết công tác học kỳ I và phương hướng, nhiệm vụ học kỳ II năm học 2026 - 2027',
      sections: [
        {
          type: 'heading',
          title: 'I. KẾT QUẢ ĐẠT ĐƯỢC TRONG HỌC KỲ I',
          content: '',
        },
        {
          type: 'article',
          number: '1.',
          title: 'Công tác giáo dục đạo đức và rèn luyện kỹ năng',
          content: 'Nhà trường duy trì nền nếp kỷ cương, không có học sinh vi phạm kỷ luật. 100% học sinh xếp loại rèn luyện Tốt và Khá.',
        },
        {
          type: 'article',
          number: '2.',
          title: 'Chất lượng dạy và học',
          content: 'Tỷ lệ học sinh đạt kết quả học tập Tốt và Khá đạt 86,5%. Đội tuyển học sinh giỏi cấp quận đạt 18 giải (trong đó có 03 giải Nhất).',
        },
        {
          type: 'heading',
          title: 'II. PHƯƠNG HƯỚNG, NHIỆM VỤ TRỌNG TÂM HỌC KỲ II',
          content: '',
        },
        {
          type: 'article',
          number: '1.',
          content: 'Tiếp tục đổi mới phương pháp giảng dạy, ôn luyện hiệu quả cho học sinh khối 9 chuẩn bị kỳ thi tuyển sinh vào lớp 10 THPT.',
        },
        {
          type: 'article',
          number: '2.',
          content: 'Tổ chức các hoạt động trải nghiệm, giáo dục STEM và ngày hội văn hóa thể thao chào mừng ngày thành lập Đoàn./.',
        },
      ],
      signerAuthority: '',
      signerRole: 'HIỆU TRƯỞNG',
      signerName: 'Đoàn Văn Thắng',
      recipientsBottom: [
        '- Phòng GD&ĐT (để b/c);',
        '- Chi bộ, BGH;',
        '- Các tổ chuyên môn;',
        '- Lưu: VT.',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'BÁO CÁO (Mẫu 1.13)',
        correctionsApplied: ['Chuẩn hóa thể thức Báo cáo theo Mẫu 1.13 NĐ 30'],
      },
    },
  },

  // 10. Mẫu 1.14: Biên bản
  {
    id: 'bien-ban',
    name: 'Mẫu 1.14: Biên bản cuộc họp / hội nghị',
    category: 'Biên bản / Giấy tờ',
    description: 'Biên bản họp Hội đồng sư phạm, biên bản kiểm tra đánh giá',
    rawText: `TRUONG THCS NGUYEN DU
BIEN BAN
Hop Hoi dong su pham thang 10 nam 2026
Thoi gian: Vao hoi 08 gio 00 phut, ngay 15 thang 10 nam 2026.
Dia diem: Phong hoi dong Truong THCS Nguyen Du.
Thanh phan tham du:
- Ba Nguyen Thi Ha - Hieu truong, Chu toa.
- Ong Tran Van Nam - Pho Hieu truong.
- Ba Le Thi Thao - Thu ky cuoc hop.
- Cung toan the 45/45 can bo, giao vien, nhan vien nha truong.
NOI DUNG CUOC HOP
1. Danh gia cong tac thang 9: Cac to hoan thanh tot ke hoach de ra.
2. Trien khai cong tac thang 10: To chuc hoi thi giao vien gioi cap truong.
Cuoc hop ket thuc vao hoi 11 gio 00 phut cung ngay.
THU KY
Le Thi Thao
CHU TOA
Nguyen Thi Ha`,
    standardized: {
      governingBody: 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO',
      issuingBody: 'TRƯỜNG THCS NGUYỄN DU',
      documentNumber: '',
      location: 'Hà Nội',
      date: 'ngày 15 tháng 10 năm 2026',
      documentType: 'BIÊN BẢN',
      subject: 'Họp Hội đồng sư phạm triển khai công tác tháng 10 năm 2026',
      sections: [
        {
          type: 'paragraph',
          content: 'Thời gian: Bắt đầu từ 08 giờ 00 phút, ngày 15 tháng 10 năm 2026.',
        },
        {
          type: 'paragraph',
          content: 'Địa điểm: Hội trường A, Trường THCS Nguyễn Du.',
        },
        {
          type: 'article',
          number: 'I.',
          title: 'THÀNH PHẦN THAM DỰ',
          content: 'Cuộc họp có mặt đầy đủ các thành viên gồm:',
          subItems: [
            '- Bà Nguyễn Thị Hà - Hiệu trưởng, Chủ tọa cuộc họp;',
            '- Ông Trần Văn Nam - Phó Hiệu trưởng;',
            '- Bà Lê Thị Thảo - Thư ký ghi biên bản;',
            '- Cùng 45/45 cán bộ quản lý, giáo viên, nhân viên nhà trường.',
          ],
        },
        {
          type: 'article',
          number: 'II.',
          title: 'NỘI DUNG CUỘC HỌP',
          content: 'Sau khi nghe Hiệu trưởng đánh giá công tác tháng 9 và triển khai nhiệm vụ tháng 10, các tổ chuyên môn đã thảo luận và thống nhất các chỉ tiêu chuyên môn.',
        },
        {
          type: 'paragraph',
          content: 'Biên bản được đọc lại cho toàn thể cuộc họp cùng nghe, nhất trí 100% thông qua và ký biên bản. Cuộc họp bế mạc vào hồi 11 giờ 00 phút cùng ngày./.',
        },
      ],
      signerAuthority: '',
      signerRole: 'CHỦ TỌA',
      signerName: 'Nguyễn Thị Hà',
      signers: [
        { authority: '', role: 'THƯ KÝ', name: 'Lê Thị Thảo' },
        { authority: '', role: 'CHỦ TỌA', name: 'Nguyễn Thị Hà' },
      ],
      recipientsBottom: [
        '- Ban Giám hiệu;',
        '- Các tổ chuyên môn;',
        '- Lưu: VT.',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'BIÊN BẢN (Mẫu 1.14)',
        correctionsApplied: ['Chuẩn hóa biên bản với 2 người ký (Thư ký bên trái, Chủ tọa bên phải) theo Mẫu 1.14 NĐ 30'],
      },
    },
  },

  // 11. Mẫu 1.15: Tờ trình
  {
    id: 'to-trinh',
    name: 'Mẫu 1.15: Tờ trình xin phê duyệt',
    category: 'Công văn / Tờ trình',
    description: 'Tờ trình phê duyệt kinh phí, bổ nhiệm cán bộ hoặc sửa chữa cơ sở vật chất',
    rawText: `TRUONG TH&THCS BAO THUAN
So: 21 / TTr - TH&THCS
Bao Thuan, ngay 02 thang 10 nam 2026
TO TRINH
Ve viec xin phe duyet chu truong sua chua phong hoc bo mon nam 2026
Kinh gui: Phong Giao duc va Dao tao huyen
Can cu vao hien trang co so vat chat cua nha truong da qua nhieu nam su dung, mot so hang muc xuong cap.
De bao dam an toan cho hoc sinh, Truong TH&THCS Bao Thuan kinh trinh Phong GD&DT xem xet, phe duyet chu truong sua chua voi cac noi dung sau:
1. Ten cong trinh: Sua chua chong tham phong hoc bo mon.
2. Du toan kinh phi: 85.000.000 dong (Tam muoi lam trieu dong).
3. Nguon von: Ngan sach nha nuoc cap.
Kinh mong Phong GD&DT xem xet, quyet dinh./.
Noi nhan: Nhu tren; Luu: VT.
HIEU TRUONG
Nguyen Van Thuan`,
    standardized: {
      governingBody: 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO',
      issuingBody: 'TRƯỜNG TH&THCS BẢO THUẬN',
      documentNumber: 'Số: 21/TTr-TH&THCS',
      location: 'Bảo Thuận',
      date: 'ngày 02 tháng 10 năm 2026',
      documentType: 'TỜ TRÌNH',
      subject: 'Về việc xin phê duyệt chủ trương sửa chữa, cải tạo phòng học bộ môn năm học 2026 - 2027',
      recipientTop: 'Kính gửi: Phòng Giáo dục và Đào tạo huyện',
      sections: [
        {
          type: 'paragraph',
          content: 'Căn cứ vào hiện trạng cơ sở vật chất của nhà trường qua nhiều năm sử dụng, hiện nay dãy phòng học bộ môn thực hành Tin học và Khoa học tự nhiên đã có hiện tượng thấm dột, xuống cấp cần được duy tu kịp thời.',
        },
        {
          type: 'paragraph',
          content: 'Để bảo đảm an toàn tuyệt đối cho giáo viên và học sinh trong mùa mưa bão, Trường TH&THCS Bảo Thuận kính trình Phòng Giáo dục và Đào tạo xem xét, thẩm định và phê duyệt chủ trương sửa chữa với các nội dung cụ thể như sau:',
        },
        {
          type: 'article',
          number: '1.',
          title: 'Hạng mục cải tạo',
          content: 'Xử lý chống thấm mái, sơn lại tường trong và ngoài, thay mới hệ thống cửa sổ sổ hư hỏng.',
        },
        {
          type: 'article',
          number: '2.',
          title: 'Dự toán kinh phí khái toán',
          content: '85.000.000 đồng (Bằng chữ: Tám mươi lăm triệu đồng chẵn).',
        },
        {
          type: 'article',
          number: '3.',
          title: 'Nguồn vốn đề nghị',
          content: 'Ngân sách sự nghiệp giáo dục năm 2026 được giao.',
        },
        {
          type: 'paragraph',
          content: 'Kính trình Phòng Giáo dục và Đào tạo xem xét, quyết định./.',
        },
      ],
      signerAuthority: '',
      signerRole: 'HIỆU TRƯỞNG',
      signerName: 'Nguyễn Văn Thuận',
      recipientsBottom: [
        '- Như Kính gửi;',
        '- Ban Giám hiệu;',
        '- Lưu: VT, KT.',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'TỜ TRÌNH (Mẫu 1.15)',
        correctionsApplied: ['Tự động thêm ô số 5b Kính gửi chuẩn theo Nghị định 30 đối với Tờ trình'],
      },
    },
  },

  // 12. Mẫu 1.17: Công văn hành chính
  {
    id: 'cong-van',
    name: 'Mẫu 1.17: Công văn phối hợp công tác',
    category: 'Công văn / Tờ trình',
    description: 'Công văn hành chính gửi cơ quan, đơn vị (Mẫu 1.17 NĐ 30)',
    rawText: `TRUONG THPT NGUYEN DU
So: 48 / CV - THPT
Ha Noi, ngay 24 thang 10 nam 2026
V/v phoi hop to chuc ky thi hoc sinh gioi cap truong
Kinh gui: Phong Giao duc va Dao tao quan
De chuan bi tot cho ky thi chon hoc sinh gioi cap truong nam hoc 2026 - 2027, Truong THPT Nguyen Du tran trong de nghi Phong Giao duc va Dao tao ho tro cu can bo giam sat va ra de thi theo ke hoach.
Thoi gian to chuc: Ngay 18 thang 11 nam 2026.
Dia diem: Tai hoi truong A, Truong THPT Nguyen Du.
Rat mong nhan duoc su phoi hop va quan tam tao dieu kien cua Quy phong.
HIEU TRUONG
Tran Van Minh
Noi nhan: Nhu tren; Luu: VT.`,
    standardized: {
      governingBody: 'SỞ GIÁO DỤC VÀ ĐÀO TẠO',
      issuingBody: 'TRƯỜNG THPT NGUYỄN DU',
      documentNumber: 'Số: 48/CV-THPT',
      location: 'Hà Nội',
      date: 'ngày 24 tháng 10 năm 2026',
      documentType: 'CÔNG VĂN',
      subject: 'phối hợp tổ chức kỳ thi học sinh giỏi cấp trường năm học 2026 - 2027',
      recipientTop: 'Kính gửi: Phòng Giáo dục và Đào tạo quận',
      sections: [
        {
          type: 'paragraph',
          content: 'Để chuẩn bị tốt cho kỳ thi chọn học sinh giỏi cấp trường năm học 2026 - 2027, Trường THPT Nguyễn Du trân trọng đề nghị Phòng Giáo dục và Đào tạo hỗ trợ cử cán bộ tham gia giám sát và thẩm định đề thi theo kế hoạch chung.',
        },
        {
          type: 'paragraph',
          content: 'Thời gian tổ chức: Bắt đầu từ 07 giờ 30 phút, ngày 18 tháng 11 năm 2026.',
        },
        {
          type: 'paragraph',
          content: 'Địa điểm: Hội trường A, Trường THPT Nguyễn Du.',
        },
        {
          type: 'paragraph',
          content: 'Rất mong nhận được sự phối hợp và quan tâm tạo điều kiện của Quý phòng để kỳ thi diễn ra thành công tốt đẹp./.',
        },
      ],
      signerAuthority: '',
      signerRole: 'HIỆU TRƯỞNG',
      signerName: 'Trần Văn Minh',
      recipientsBottom: [
        '- Như Kính gửi;',
        '- Ban Giám hiệu;',
        '- Lưu: VT, CM.',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'CÔNG VĂN (Mẫu 1.17)',
        correctionsApplied: [
          'Đưa trích yếu "V/v" về đúng vị trí ô số 5b dưới Số và ký hiệu văn bản',
          'Định dạng phần "Kính gửi" tại ô số 9a đúng chuẩn Nghị định 30',
        ],
      },
    },
  },

  // 13. Mẫu 1.20: Giấy mời
  {
    id: 'giay-moi',
    name: 'Mẫu 1.20: Giấy mời dự hội nghị / họp',
    category: 'Biên bản / Giấy tờ',
    description: 'Giấy mời dự lễ kỷ niệm, hội nghị chuyên đề theo Mẫu 1.20 NĐ 30',
    rawText: `TRUONG THCS VO THI SAU
So: 15 / GM - THCS
Vung Tau, ngay 10 thang 11 nam 2026
GIAY MOI
Du Le ky niem 44 nam Ngay Nha giao Viet Nam (20/11/1982 - 20/11/2026)
Kinh gui: Quy can bo, nha giao lao thanh va Ban Dai dien Cha me hoc sinh
Truong THCS Vo Thi Sau tran trong kinh moi Quy dai bieu toi du buoi Le ky niem:
1. Thoi gian: 08h00 ngay 20 thang 11 nam 2026.
2. Dia diem: San truong THCS Vo Thi Sau.
Su hien dien cua Quy vi la niem vinh du lon cho thay va tro nha truong./.
HIEU TRUONG
Nguyen Van Hau`,
    standardized: {
      governingBody: 'PHÒNG GIÁO DỤC VÀ ĐÀO TẠO',
      issuingBody: 'TRƯỜNG THCS VÕ THỊ SÁU',
      documentNumber: 'Số: 15/GM-THCS',
      location: 'Vũng Tàu',
      date: 'ngày 10 tháng 11 năm 2026',
      documentType: 'GIẤY MỜI',
      subject: 'Dự Lễ kỷ niệm 44 năm Ngày Nhà giáo Việt Nam (20/11/1982 - 20/11/2026)',
      recipientTop: 'Kính gửi: Quý thầy cô giáo lão thành và Ban Đại diện Cha mẹ học sinh',
      sections: [
        {
          type: 'paragraph',
          content: 'Nhân dịp kỷ niệm 44 năm Ngày Nhà giáo Việt Nam (20/11/1982 - 20/11/2026), Trường THCS Võ Thị Sáu trân trọng kính mời Quý đại biểu tới dự buổi gặp mặt truyền thống tri ân các thế hệ nhà giáo:',
        },
        {
          type: 'article',
          number: '1.',
          title: 'Thời gian tổ chức',
          content: 'Bắt đầu từ 08 giờ 00 phút, thứ Sáu ngày 20 tháng 11 năm 2026.',
        },
        {
          type: 'article',
          number: '2.',
          title: 'Địa điểm tổ chức',
          content: 'Hội trường lớn, Trường THCS Võ Thị Sáu.',
        },
        {
          type: 'paragraph',
          content: 'Sự hiện diện của Quý đại biểu là niềm vinh dự, nguồn cổ vũ to lớn đối với toàn thể cán bộ, giáo viên và học sinh nhà trường./.',
        },
      ],
      signerAuthority: '',
      signerRole: 'HIỆU TRƯỞNG',
      signerName: 'Nguyễn Văn Hậu',
      recipientsBottom: [
        '- Như Kính gửi;',
        '- Lưu: VT.',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'GIẤY MỜI (Mẫu 1.20)',
        correctionsApplied: ['Tự động thêm Kính gửi và định dạng chuẩn Giấy mời theo Mẫu 1.20 NĐ 30'],
      },
    },
  },

  // 14. Mẫu Kế hoạch hoạt động Đội TNTP Hồ Chí Minh (Liên đội trường học)
  {
    id: 'lien-doi',
    name: 'Mẫu Kế hoạch Đội TNTP Hồ Chí Minh',
    category: 'Văn bản Đội',
    description: 'Kế hoạch hoạt động Liên đội (Đội TNTP HCM, 3 dấu sao ***, không dùng Quốc hiệu)',
    rawText: `DOI TNTP HO CHI MINH
LIEN DOI TRUONG TH&THCS BAO THUAN
So: 06 / KH - LD
Bao Thuan, ngay 05 thang 11 nam 2026
KE HOACH
To chuc Hoi thi Van nghe chao mung ngay Nha giao Viet Nam 20/11
I. MUC DICH, YEU CAU
1. Giao duc truyen thong Ton su trong dao, tri an cac thay co giao.
2. Tao san choi lanh manh, phat huy nang khieu van nghe cua cac em doi vien.
II. NOI DUNG, HINH THUC
1. Noi dung: Cac tiet muc ca mua, ca ngoi que huong, dat nuoc, thay co va mai truong.
2. Hinh thuc: Moi chi doi tham gia 01 tiet muc.
TONG PHU TRACH
Nguyen Van A`,
    standardized: {
      governingBody: 'ĐỘI TNTP HỒ CHÍ MINH',
      issuingBody: 'LIÊN ĐỘI TRƯỜNG TH&THCS BẢO THUẬN',
      documentNumber: 'Số .... /KH-LĐ',
      location: 'Bảo Thuận',
      date: 'ngày 05 tháng 11 năm 2026',
      documentType: 'KẾ HOẠCH',
      subject: 'Tổ chức Hội thi Văn nghệ chào mừng 44 năm Ngày Nhà giáo Việt Nam 20/11',
      isYouthUnionDoc: true,
      sections: [
        {
          type: 'heading',
          title: 'I. MỤC ĐÍCH, YÊU CẦU',
          content: '',
        },
        {
          type: 'article',
          number: '1.',
          content: 'Giáo dục truyền thống "Tôn sư trọng đạo", lòng biết ơn sâu sắc của đội viên, thiếu nhi đối với các thầy cô giáo nhân Ngày Nhà giáo Việt Nam 20/11.',
        },
        {
          type: 'article',
          number: '2.',
          content: 'Tạo không khí thi đua sôi nổi, rèn luyện kỹ năng sinh hoạt tập thể, phát huy năng khiếu văn hóa văn nghệ cho các em đội viên.',
        },
        {
          type: 'heading',
          title: 'II. NỘI DUNG VÀ HÌNH THỨC DỰ THI',
          content: '',
        },
        {
          type: 'article',
          number: '1.',
          title: 'Nội dung',
          content: 'Ca ngợi tình cảm thầy trò, mái trường thân yêu, ca ngợi Đảng quang vinh, Bác Hồ vĩ đại và tình yêu quê hương đất nước.',
        },
        {
          type: 'article',
          number: '2.',
          title: 'Đối tượng và số lượng',
          content: 'Học sinh toàn trường thi theo khối lớp:',
          subItems: [
            '- Bậc Tiểu học: Mỗi khối lớp tham gia tối thiểu 01 tiết mục;',
            '- Bậc THCS: Mỗi chi đội đăng ký 01 tiết mục (hát múa, đơn ca, múa phụ họa);',
            '- Các tiết mục cần được tập luyện chu đáo, đảm bảo an toàn tuyệt đối.',
          ],
        },
      ],
      signerAuthority: 'TM. LIÊN ĐỘI',
      signerRole: 'TỔNG PHỤ TRÁCH',
      signerName: 'Nguyễn Văn A',
      recipientsBottom: [
        '- Ban Giám hiệu (để b/c);',
        '- Ban Chấp hành Chi đoàn;',
        '- Các chi đội, lớp nhi đồng;',
        '- Lưu: Liên đội.',
      ],
      auditSummary: {
        margins: 'Lề trên: 20mm, Dưới: 20mm, Trái: 30mm, Phải: 15mm (Khổ A4)',
        font: 'Times New Roman (Unicode TCVN 6909:2001)',
        lineSpacing: 'Dòng giãn 1.3 lines, cách đoạn 6pt, thụt dòng 1.27cm',
        detectedType: 'KẾ HOẠCH LIÊN ĐỘI (ĐỘI TNTP HỒ CHÍ MINH)',
        correctionsApplied: [
          'Áp dụng thể thức chuẩn văn bản Đội TNTP Hồ Chí Minh',
          'Không dùng Quốc hiệu và Tiêu ngữ ở góc phải trên',
          'Dùng 3 dấu sao (***) dưới tên Liên đội',
          'Bảo tồn 100% tên cơ quan ban hành: LIÊN ĐỘI TRƯỜNG TH&THCS BẢO THUẬN',
        ],
      },
    },
  },
];

# VSLA Admin v2 — Full Context Document
# Cập nhật: 2026-05-22 (paulsteigel + Claude session)

---

## 1. TỔNG QUAN DỰ ÁN

Đang viết lại toàn bộ **care-web-admin** (React CRA cũ) thành **vsla-admin** (Vite + React 18 mới).
Mục tiêu: nhanh hơn, đẹp hơn, mobile responsive, chạy song song test trên admin.sfdp.net trước
khi replace production admin.vsla.care.org.vn.

---

## 2. HẠ TẦNG SERVER

### Server production (SSH vào được)
- **IP:** 109.237.65.174
- **SSH user:** paulsteigel (có sudo)
- **OS:** Ubuntu 24, zsh

### Các thư mục quan trọng
```
/opt/digifarmer/          ← Java API production (carevn-api.jar, port 4567)
/opt/digifarmer-admin/    ← Web admin production → admin.vsla.care.org.vn
/opt/digifarmer-admin-uat/← Web admin UAT → admin.sfdp.net (test Vite mới ở đây)
/opt/vsla-admin-v2/       ← Source code Vite project (git clone từ GitHub)
/opt/care-web-admin/      ← Source code CRA cũ (dùng để build production hiện tại)
```

### Nginx config
```
admin.vsla.care.org.vn  → /opt/digifarmer-admin/    (production CRA)
admin.sfdp.net          → /opt/digifarmer-admin-uat/ (test Vite mới)
apis.care.org.vn        → proxy port 4567 (Java API)
```

### Java API
- **Port:** 4567
- **Base URL production:** https://apis.care.org.vn (không có prefix /carevn-api)
- **Base URL UAT:** https://apis-uat.resta.vn/carevn-api (server khác của UnikGate)
- **DB:** MySQL, host 127.0.0.1:3306, db=digi_farmer, user=carevndbuser, pass=vnR@68Q^93
- **Restart:** cd /opt/digifarmer && sh stop.sh && nohup sh start.sh > carevn-api.out &

### Deploy workflow
```bash
# Build và deploy lên UAT test
cd /opt/vsla-admin-v2
git pull origin main
npm install
npm run build
cp -r dist/* /opt/digifarmer-admin-uat/

# Khi ổn → deploy production
cp -r dist/* /opt/digifarmer-admin/
```

### Git conflict tip
```bash
# Nếu git pull báo conflict package.json:
git stash
git pull origin main
git stash pop
```

---

## 3. REPO GITHUB

- **URL:** https://github.com/paulsteigel/vsla.git
- **Branch:** main
- **Cách làm việc:** Claude xuất file → paulsteigel commit lên GitHub → pull về server → build

---

## 4. STACK KỸ THUẬT

```json
{
  "dependencies": {
    "@ant-design/icons": "^5.3.7",
    "@mui/material": "^5.15.0",
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0",
    "antd": "^5.17.0",
    "axios": "^1.7.2",
    "dayjs": "^1.11.11",
    "exceljs": "^4.4.0",
    "file-saver": "^2.0.5",
    "jwt-decode": "^4.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1",
    "react-toastify": "^10.0.5",
    "recharts": "^2.12.7",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "vite": "^5.2.13"
  }
}
```

### Vite alias
```js
resolve: { alias: { '@': path.resolve(__dirname, './src') } }
```

---

## 5. CẤU TRÚC PROJECT

```
src/
├── App.jsx
├── main.jsx                         ← ConfigProvider antd (colorPrimary: #E4701E)
├── index.css
│
├── store/
│   └── authStore.js                 ← Zustand: infoUser, roleUser, logout
│
├── shared/
│   ├── api/
│   │   ├── http.js                  ← axios wrapper → { status, payload }
│   │   ├── projectApi.js
│   │   ├── reportApi.js
│   │   ├── addressApi.js
│   │   └── orgApi.js
│   ├── components/
│   │   ├── Layout.jsx
│   │   ├── CustomSelect.jsx
│   │   ├── CustomTable.jsx
│   │   └── CustomDatePicker.jsx
│   └── utils/
│       ├── format.js
│       ├── auth.js
│       └── exportExcel.js
│
└── features/
    ├── auth/LoginPage.jsx           ✅ DONE
    ├── dashboard/DashboardPage.jsx  ✅ DONE (v5 - management command center)
    ├── reports/ReportPage.jsx       ✅ DONE
    ├── groups/                      ⏳ TODO
    ├── meetings/                    ⏳ TODO
    ├── organizations/               ⏳ TODO
    ├── projects/                    ⏳ TODO
    ├── transactions/                ⏳ TODO
    ├── articles/                    ⏳ TODO
    ├── messages/                    ⏳ TODO
    ├── surveys/                     ⏳ TODO
    └── admin-roles/                 ⏳ TODO
```

---

## 6. THIẾT KẾ SYSTEM (NGUYÊN TẮC BẤT BIẾN)

### Màu sắc (Tailwind custom colors)
```js
"orange-bg":    "#E4701E"  // Primary action, header table, nút chính
"orange-hover": "#F18C42"
"main-text":    "#F28649"
"main-title":   "#24272C"
"gray-text":    "#484746"
"gray-border":  "#D9D9D9"
"light-gray":   "#E6E6E6"
"link":         "#435CE1"
"danger":       "#DC3545"
"light-orange": "#FFF4DE"
"light-pink":   "#FFE2E5"
"light-green":  "#DCFCE7"
"light-purple": "#F3E8FF"
```

### Component patterns
```jsx
<div className="bg-white rounded-2xl p-5 border border-light-gray">
<h3 className="font-bold text-[15px] font-manrope text-main-title">
<button className="bg-orange-bg hover:bg-orange-hover text-white font-[600] font-manrope rounded-xl h-12 px-5">
.ant-table-thead > tr > th { background-color: #E4701E !important; color: white !important; }
```

---

## 7. AUTH & PERMISSIONS

```
ADMIN              → Xem tất cả
ORGANIZATION_ADMIN → Chỉ xem tổ chức mình
PROJECT_ADMIN      → Chỉ xem dự án mình
CITY_ADMIN         → Chỉ xem tỉnh
WARD_ADMIN         → Chỉ xem xã
```

```js
const { infoUser, roleUser } = useAuthStore()
// roleUser: { organizationId, projectId, cityCode, wardCode, cityName, wardName, projectName }
```

### http wrapper
```js
const res = await httpAuth.get('/endpoint')
// res.payload.data = array
// res.payload.total = number
```

---

## 8. API ENDPOINTS QUAN TRỌNG

```
GET /auth                       → login { token }
GET /admin-roles?customerId=    → role detail
GET /groups                     → list nhóm VSLA
GET /meetings                   → list cuộc họp
GET /customers                  → list user
GET /projects                   → list dự án
GET /organizations              → list tổ chức
GET /posts                      → list bài viết
GET /notifications              → list thông báo
GET /surveys                    → list khảo sát
GET /transactions               → list giao dịch
GET /addresses?administrativeLevel=2              → list tỉnh
GET /addresses?administrativeLevel=4&cityCode=... → list xã
GET /reports?reportType=overview_report_v2&fromDate=...&toDate=...
```

### Filter params chung
```
fromDate=YYYY-MM-DD   toDate=YYYY-MM-DD
cityCode=son_la       wardCode=nam_lau,muong_chanh  (multi, join phẩy)
organizationId=1      projectId=2
_start=0              _end=20
status=Active|Pending|Done
meetingType=first_meeting|last_meeting|regular_meeting
```

### ⚠️ Java auto-adjusts dates
- `fromDate` → ép về đầu tháng (`withDayOfMonth(1)`)
- `toDate` → ép về cuối tháng (`lengthOfMonth()`)

---

## 9. OVERVIEW_REPORT_V2 — KEY MAPPING ĐẦY ĐỦ

### ⚠️ QUAN TRỌNG: IDs bị lặp lại giữa 3 section A/B/C

Dùng 2 helper functions:
```js
// gv: safe cho unique IDs (13, 13.1-4, 14, 14.1, 14.2)
const mkGv = (data) => (id, field='accumulatedValue') =>
  Number(data.find(r => String(r.id) === String(id))?.[field] || 0)

// bs: dùng cho ID trùng (1-12 đều bị trùng giữa A/B/C)
const mkBs = (data) => (section, id, field='accumulatedValue') => {
  const si = data.findIndex(r => String(r.id) === section)
  if (si === -1) return 0
  const ei = data.findIndex((r,i) => i > si && ['A','B','C'].includes(String(r.id)))
  const rows = ei === -1 ? data.slice(si+1) : data.slice(si+1, ei)
  return Number(rows.find(r => String(r.id) === String(id))?.[field] || 0)
}
```

### Section A — XÂY DỰNG TỔ CHỨC
| ID  | Tên | Unit | Dùng gv() |
|-----|-----|------|-----------|
| '3' | Nhóm đang hoạt động | Nhóm | gv('3') ← A-3, first match OK |
| '4' | Thành viên mới tham gia (lũy kế proxy total) | TV | gv('4') |
| '6' | Thành viên đang hoạt động | TV | gv('6') ✓ SAFE |
| '7' | TB thành viên/nhóm (~14-17) | TV | gv('7') — ĐỪNG dùng làm principal! |
| '8' | Tỉ lệ tham dự cuộc họp | % | gv('8') ✓ SAFE |

### Section B — HOẠT ĐỘNG TÍN DỤNG
| ID   | Tên | Unit | Cách lấy | value vs acc |
|------|-----|------|----------|--------------|
| B'3' | Tiết kiệm gốc cuối kỳ | Đồng | bs('B','3','value') | Dùng VALUE (acc = sum snapshots = overcounts) |
| B'4' | Tiết kiệm bình quân/TV | Đồng | bs('B','4','value') | Dùng VALUE |
| B'9' | Khoản vay hoàn trả hết | Khoản | bs('B','9','value') | Dùng VALUE cho rate |
| B'10'| Khoản vay chưa hoàn trả | Khoản | bs('B','10','value') | Dùng VALUE |
| '13' | Tổng vốn phát ra | Đồng | gv('13','value') | UNIQUE ✓ |
| '13.1'| Vốn khẩn cấp | Đồng | gv('13.1','value') | UNIQUE ✓ |
| '13.2'| Vốn kinh doanh | Đồng | gv('13.2','value') | UNIQUE ✓ |
| '13.3'| Vốn tiêu dùng | Đồng | gv('13.3','value') | UNIQUE ✓ |
| '13.4'| Vốn khác | Đồng | gv('13.4','value') | UNIQUE ✓ |
| '14' | Hoàn trả vốn tổng | Đồng | gv('14','value') | UNIQUE ✓ |
| '14.1'| Hoàn trả gốc | Đồng | gv('14.1','value') | UNIQUE ✓ |
| '14.2'| Lãi thu được | Đồng | gv('14.2','value') | UNIQUE ✓ |

### Section C — QUỸ TƯƠNG TRỢ
| ID   | Tên | Cách lấy |
|------|-----|----------|
| C'1' | Thu quỹ tương trợ | bs('C','1','value') |
| C'2' | Chi quỹ tương trợ | bs('C','2','value') |
| C'4' | Dư nợ quỹ tương trợ | bs('C','4','value') |

### ⚠️ Giới hạn dữ liệu — QUAN TRỌNG

**overview_report chỉ cập nhật cuối tháng:**
- Cron chạy 23:59 hàng ngày, INSERT records vào `overview_report` chỉ khi end-of-month
- Records có `created_date = LAST_DAY(month)`, ví dụ 2026-04-30
- **Tháng hiện tại (chưa kết thúc): `value` = 0** → hiện "—"
- Fix: default period = tháng trước (`dayjs().subtract(1,'month')`)
- Hoặc: khi `value = 0`, dùng `accumulatedValue` với chú thích "lũy kế"

**Vấn đề snapshot overcounting với balance metrics:**
- `so_tien_goc_co_phan_cuoi_ky` được INSERT bằng cách SUM `group_asset.accumulated_*`
- `group_asset` có 1 record PER MEETING (snapshot lũy kế mỗi cuộc họp)
- Nếu nhóm họp 4 lần/tháng: `accumulatedValue` = 4× số dư thực tế
- Fix: dùng `value` (kỳ hiện tại) hoặc diff (acc_curr - acc_prev)
- Amount-based outstanding/repayment KHÔNG tin cậy → dùng count-based (B-9, B-10)

### Công thức đúng cho các chỉ số MEAL
```js
// Tỉ lệ hoàn trả (COUNT-based, tin cậy hơn amount-based)
const repaidCount      = bs('B', '9',  'value')
const outstandingCount = bs('B', '10', 'value')
const repaymentRate    = pct(repaidCount, repaidCount + outstandingCount)

// Tỉ lệ TV hoạt động
const activeMemberRate = pct(gv('6'), gv('4'))

// Tỉ lệ nhóm có cuộc họp trong kỳ
const meetingCoverage  = pct(gv('3','value'), gv('3'))  // value/accumulated

// Tỉ lệ tham dự
const attendanceRate   = gv('8')  // A-8: % trực tiếp từ SQL
```

---

## 10. DASHBOARD V5 — MANAGEMENT COMMAND CENTER

### Triết lý thiết kế
- **Exception-first**: Alerts zone ở đầu, không phải cuối
- **Threshold-aware**: ThresholdMeter với ngưỡng VSLA (repayment ≥90%, attendance ≥80%)
- **3 personas**: Project Manager / MEAL Officer / Government Official
- **2-phase loading**: KPI chính hiện ngay, trend chart load sau riêng biệt

### VSLA Thresholds
```js
const THR = {
  repayment:   { good: 90, warn: 75 },
  attendance:  { good: 80, warn: 65 },
  activeMember:{ good: 75, warn: 60 },
  meetings:    { good: 85, warn: 65 },
}
```

### Performance architecture
```
Phase 1 (~2-3s): Promise.all([
  fetchReport(curr), fetchReport(prev),  // 2 report calls
  httpAuth.get('/groups'),               // group counts
  httpAuth.get('/meetings'),             // recent meetings
  httpAuth.get('/notifications'),        // suggestions
])
→ Set KPI, Alerts, MEAL metrics ngay

Phase 2 (~3-5s, riêng biệt): Promise.all([
  fetchReport(month-5), ..., fetchReport(month-0)  // 6 calls parallel
])
→ Set trend chart với loading spinner riêng
```

### Ghi chú về performance
Dashboard hiện tại chậm vì mỗi report call = 35+ UNION SQL queries. Hướng cải thiện tương lai:
1. **Bảng tạm dashboard_summary**: Cron hàng tối cập nhật pre-aggregated metrics, API chỉ đọc 1 bảng
2. **Redis cache**: Cache report results 1-2 giờ, background refresh
3. **Incremental update**: Cập nhật summary table real-time khi có giao dịch mới
→ Cần phối hợp với backend Java team để implement

### Layout zones
```
[Header: Role + Scope + Alert count + Period picker]
[Zone 2: Alerts & Exceptions — exception-first!]
[Zone 3: Impact Stats — 4 cards: nhóm/TV/tiết kiệm/cho vay]
[Zone 4: MEAL Scorecard — 4 ThresholdMeter]
[Zone 5: Financial Health — 4 FinCard + Area trend chart]
[Zone 6: Loan Purpose + Recent Meetings]
```

---

## 11. BACKEND JAVA API — NOTES QUAN TRỌNG

- **SQL template:** Java load file `.sql` từ classpath trong JAR, replace `{{placeholder}}`
- **wardCode:** `IN ({{wardCode}})` → hỗ trợ multi-select (split theo phẩy)
- **fromDate/toDate:** Java tự ép về đầu/cuối tháng
- **Cron:** 23:59 hàng ngày, chỉ INSERT overview_report vào cuối tháng
- **Sửa SQL:** `zip carevn-api.jar -j file.sql` rồi restart
- **group_asset:** 1 record per meeting per group (snapshot lũy kế, không phải flow)

---

## 12. PROGRESS

### ✅ DONE
- `LoginPage.jsx`
- `Layout.jsx` (sidebar + header)
- `authStore.js` (Zustand)
- `App.jsx` (routes + RequireAuth)
- `ReportPage.jsx` (filter đa tỉnh/xã, export Excel)
- `DashboardPage.jsx` v5 (management command center, 2-phase load)

### ⏳ TODO (theo thứ tự ưu tiên)
| # | Feature | Notes |
|---|---------|-------|
| 1 | **Nhóm VSLA** | GroupManagement, DetailsGroup — phức tạp nhất |
| 2 | **Cuộc họp** | MeetingManagement, DetailMeeting |
| 3 | **Giao dịch** | ManageTransaction |
| 4 | **Tổ chức** | OrganizeManagement CRUD |
| 5 | **Dự án** | ProjectsManage CRUD |
| 6 | **Admin roles** | AdminManager |
| 7 | **Bài viết** | ArticleManagement (TipTap rich text) |
| 8 | **Thông báo** | MessagesManagement |
| 9 | **Khảo sát** | SurveysManager |
| 10 | **Tra cứu user** | SearchUsers |
| 11 | **Query data** | QueryData (raw SQL UI) |

---

## 13. NGUYÊN TẮC KHI VIẾT CODE MỚI

1. **Mỗi feature = 1 file JSX hoàn chỉnh**
2. **Import pattern:**
   ```js
   import { useAuthStore } from '@/store/authStore'
   import { httpAuth } from '@/shared/api/http'
   import { formatVN, buildParam } from '@/shared/utils/format'
   ```
3. **Không dùng Redux** — chỉ Zustand
4. **Không dùng fetch thủ công** — chỉ `httpAuth.get/post/patch/delete`
5. **Comment đầu file:** `// [paulsteigel - YYYY-MM-DD] mô tả`
6. **Mobile responsive:** grid cols, overflow-x-auto cho table, ResponsiveContainer cho chart
7. **Loading state:** skeleton `animate-pulse bg-gray-100 rounded-lg`
8. **Format số:** `Number(n).toLocaleString('vi-VN')`
9. **Scope params từ roleUser:** luôn include khi fetch để data đúng quyền
10. **Period picker:** default tháng trước (data đã có), không phải tháng hiện tại

---

## 14. CÁCH BẮT ĐẦU CHAT MỚI

Paste đoạn này vào đầu chat mới:

```
Tôi đang làm dự án VSLA Admin v2 — rewrite React CRA → Vite.
Context đầy đủ: [paste nội dung file VSLA_Admin_v2_Context.md]

Hôm nay cần làm: [tên feature]
Repo: https://github.com/paulsteigel/vsla.git
```

---

*Tạo bởi paulsteigel + Claude, cập nhật 2026-05-22*
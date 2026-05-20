# VSLA Admin v2 — Full Context Document
# Chuẩn bị cho chat session mới — paulsteigel

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
/opt/digifarmer-admin/    ← Web admin production (serve bởi Nginx) → admin.vsla.care.org.vn
/opt/digifarmer-admin-uat/← Web admin UAT → admin.sfdp.net (test Vite mới ở đây)
/opt/vsla-admin-v2/       ← Source code Vite project (git clone từ GitHub)
/opt/care-web-admin/      ← Source code CRA cũ (dùng để build production hiện tại)
```

### Nginx config
```
admin.vsla.care.org.vn  → /opt/digifarmer-admin/   (production CRA)
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
// vite.config.js
resolve: { alias: { '@': path.resolve(__dirname, './src') } }
```

---

## 5. CẤU TRÚC PROJECT

```
src/
├── App.jsx                          ← Routes + RequireAuth + load roleUser
├── main.jsx                         ← ConfigProvider antd (colorPrimary: #E4701E)
├── index.css                        ← Tailwind + table header override
│
├── store/
│   └── authStore.js                 ← Zustand (thay Redux): infoUser, roleUser, logout
│
├── shared/
│   ├── api/
│   │   ├── http.js                  ← axios wrapper → { status, payload }
│   │   ├── projectApi.js
│   │   ├── reportApi.js
│   │   ├── addressApi.js
│   │   └── orgApi.js
│   ├── components/
│   │   ├── Layout.jsx               ← Sidebar + Header + Outlet
│   │   ├── CustomSelect.jsx
│   │   ├── CustomTable.jsx
│   │   └── CustomDatePicker.jsx
│   └── utils/
│       ├── format.js                ← formatVN, formatCurrency, buildParam
│       ├── auth.js                  ← isTokenExpired
│       └── exportExcel.js           ← exportToExcelHighLight
│
└── features/
    ├── auth/
    │   └── LoginPage.jsx            ✅ DONE
    ├── dashboard/
    │   └── DashboardPage.jsx        ✅ DONE (charts, KPI, trend 6 tháng)
    ├── reports/
    │   └── ReportPage.jsx           ✅ DONE (multi-select tỉnh/xã, month picker)
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
"orange-hover": "#F18C42"  // Hover state
"main-text":    "#F28649"  // Secondary orange
"main-title":   "#24272C"  // Text heading
"gray-text":    "#484746"  // Text body
"gray-border":  "#D9D9D9"  // Border
"light-gray":   "#E6E6E6"  // Light border
"link":         "#435CE1"  // Link color
"danger":       "#DC3545"  // Error/delete
"light-orange": "#FFF4DE"  // Background card
"light-pink":   "#FFE2E5"  // Background card
"light-green":  "#DCFCE7"  // Background card
"light-purple": "#F3E8FF"  // Background card
```

### Typography
```
font-manrope  → Heading, title, label quan trọng
font-inter    → Body text, label thường, số
font-roboto   → Table content
```

### Component patterns
```jsx
// Card wrapper
<div className="bg-white rounded-2xl p-5 border border-light-gray">

// Section header
<h3 className="font-bold text-[15px] font-manrope text-main-title">

// Primary button
<button className="bg-orange-bg hover:bg-orange-hover text-white font-[600] font-manrope rounded-xl h-12 px-5">

// Input
<input className="h-12 px-4 rounded-xl border-2 border-light-gray focus:border-orange-bg">

// Table header (Ant Design override in index.css)
.ant-table-thead > tr > th { background-color: #E4701E !important; color: white !important; }

// Title row highlight
.title-row-high-light { background-color: #FFF4DE !important; font-weight: 700; }
```

### Mobile responsive rules
```
- Layout: sidebar ẩn trên mobile (dùng drawer/overlay)
- Grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
- Charts: ResponsiveContainer width="100%" (recharts)
- Table: overflow-x-auto wrapper
- Font size: text-[14px] → text-[13px] trên mobile
- Padding: p-4 md:p-6
```

### Format số chuẩn Việt Nam
```js
// format.js
export const formatVN = (n) => Number(n||0).toLocaleString('vi-VN')
export const formatCurrency = (n) => `${formatVN(n)} ₫`
export const formatPercent = (n) => `${formatVN(n)}%`
// Kết quả: 1.234.567 (dấu chấm nghìn, dấu phẩy thập phân)
```

---

## 7. AUTH & PERMISSIONS

### Roles
```
ADMIN              → Xem tất cả, không bị giới hạn scope
ORGANIZATION_ADMIN → Chỉ xem tổ chức mình quản lý
PROJECT_ADMIN      → Chỉ xem dự án mình quản lý
CITY_ADMIN         → Chỉ xem địa bàn tỉnh
WARD_ADMIN         → Chỉ xem địa bàn xã
```

### Auth store (Zustand)
```js
// authStore.js — tự init từ localStorage token khi load
const { infoUser, roleUser, setInfoUser, setRoleUser, logout } = useAuthStore()

// infoUser: { username, name, role, customerId, exp, ... } (từ JWT decode)
// roleUser: { organizationId, projectId, cityCode, wardCode, ... } (từ /admin-roles API)
```

### API http wrapper
```js
// http.js — wrap axios → { status, payload }
const res = await httpAuth.get('/endpoint')
// res.status === 200
// res.payload.data = array
// res.payload.total = number
```

---

## 8. API ENDPOINTS QUAN TRỌNG

```
GET  /auth                    → login { token }
GET  /admin-roles?customerId= → role detail

GET  /groups                  → list nhóm VSLA
GET  /groups/:id              → detail nhóm
GET  /meetings                → list cuộc họp
GET  /customers               → list user
GET  /projects                → list dự án
GET  /organizations           → list tổ chức
GET  /posts                   → list bài viết
GET  /notifications           → list thông báo
GET  /surveys                 → list khảo sát
GET  /transactions            → list giao dịch

GET  /addresses?administrativeLevel=2              → list tỉnh
GET  /addresses?administrativeLevel=4&cityCode=... → list xã
GET  /customers/:id/cities?organizationId=...      → tỉnh theo org
GET  /customers/:id/organizations                  → org theo customer
GET  /customers/:id/projects?organizationId=...    → project theo org

GET  /reports?reportType=overview_report_v2&fromDate=...&toDate=...&cityCode=...&wardCode=...
     → báo cáo VSLA (wardCode hỗ trợ multi: "xa1,xa2,xa3")
```

### Filter params chung
```
fromDate=YYYY-MM-DD   toDate=YYYY-MM-DD
cityCode=son_la       wardCode=nam_lau,muong_chanh  (multi, join dấu phẩy)
organizationId=1      projectId=2
_start=0              _end=20   (pagination)
status=Active|Pending|Done
```

---

## 9. BACKEND JAVA API — NOTES QUAN TRỌNG

- **SQL template:** Java load file `.sql` từ classpath trong JAR, replace `{{placeholder}}`
- **wardCode:** `= {{wardCode}}` đã được đổi thành `IN ({{wardCode}})` → hỗ trợ multi-select
- **fromDate:** Java tự ép về `withDayOfMonth(1)` → đầu tháng
- **toDate:** Java tự ép về cuối tháng
- **Cron reload:** chạy lúc 23:59 hàng ngày, chỉ reload cuối tháng
- **Sửa SQL:** phải update JAR (`zip carevn-api.jar -j file.sql`) rồi restart

---

## 10. PROGRESS CHI TIẾT

### ✅ DONE

#### LoginPage.jsx (`src/features/auth/LoginPage.jsx`)
- 2 cột: left panel decorative + right panel form
- httpAuth.post('/auth') → res.payload.token
- Roles allowed: ADMIN, *_ADMIN
- Redirect: ADMIN → '/', others → '/groups'

#### Layout.jsx (`src/shared/components/Layout.jsx`)
- Sidebar collapse (toggle button)
- Menu items với submenu accordion
- Header: tên user + role + logout
- Outlet cho page content

#### authStore.js (`src/store/authStore.js`)
- initFromToken() — đọc JWT từ localStorage khi khởi tạo
- setInfoUser, setRoleUser, logout

#### App.jsx (`src/App.jsx`)
- RequireAuth wrapper
- Load roleUser từ /admin-roles sau khi có infoUser
- Routes: / → Dashboard, /reports → ReportPage, * → "đang xây dựng"

#### ReportPage.jsx (`src/features/reports/ReportPage.jsx`)
- Filter: Tổ chức → Dự án → Tỉnh (multi) → Xã (multi, nhóm OptGroup theo tỉnh)
- Date picker: picker="month" format MM/YYYY
- Nút "Xem báo cáo" thủ công (không auto-fetch)
- Format số VN: vi-VN locale, Đồng thêm ₫, % thêm %
- Export Excel với header kỳ báo cáo + địa bàn
- Label kỳ: "Từ Tháng 4/2026 đến Tháng 5/2026"
- Nhãn địa bàn sau khi load: "Sơn La — Nậm Lầu, Mường Chanh"

#### DashboardPage.jsx (`src/features/dashboard/DashboardPage.jsx`)
- Greeting banner gradient cam với 3 số tổng quan
- 4 KPI cards với trend tuần
- Line chart 6 tháng: Nhóm mới + Thành viên + Cuộc họp (Recharts)
- 2 Progress rings: % thành viên HĐ + % tỉ lệ họp nhóm
- Bar chart: cho vay theo mục đích (4 loại)
- Cuộc họp gần nhất (6 items)
- Danh sách dự án (5 items)
- Góp ý người dùng (8 items, scroll)
- Loading skeleton toàn bộ

### ⏳ TODO (theo thứ tự ưu tiên)

| # | Feature | Files cần viết | Notes |
|---|---------|----------------|-------|
| 1 | **Nhóm VSLA** | GroupManagement, DetailsGroup, HeadingDetail | Phức tạp nhất, có filter địa bàn |
| 2 | **Cuộc họp** | MeetingManagement, DetailMeeting, UpdateMeeting | |
| 3 | **Giao dịch** | ManageTransaction, DetailTransaction | |
| 4 | **Tổ chức** | OrganizeManagement, FormOrg | CRUD |
| 5 | **Dự án** | ProjectsManage, CreateProject, UpdateProject, DetailProjects | CRUD |
| 6 | **Admin roles** | AdminManager, CreateAdminRole, UpdateAdminPopup | |
| 7 | **Bài viết** | ArticleManagement, CreatePost | Có rich text editor (TipTap) |
| 8 | **Chủ đề** | TopicManager, Create/UpdateTopicPopup | |
| 9 | **Thông báo** | MessagesManagement, FormMessages, ViewMessage | |
| 10 | **Khảo sát** | SurveysManager, DetailSurvey, Create/UpdateSurveysPopup | |
| 11 | **Tra cứu user** | SearchUsers | |
| 12 | **Query data** | QueryData | Raw SQL query UI |

---

## 11. NGUYÊN TẮC KHI VIẾT CODE MỚI

1. **Mỗi feature = 1 file JSX hoàn chỉnh** — không chia nhỏ quá, dễ commit
2. **Import pattern:**
   ```js
   import { useAuthStore } from '@/store/authStore'
   import { httpAuth } from '@/shared/api/http'
   import { formatVN, buildParam } from '@/shared/utils/format'
   ```
3. **Không dùng Redux** — chỉ dùng Zustand (`useAuthStore`)
4. **Không dùng fetch thủ công** — chỉ dùng `httpAuth.get/post/patch/delete`
5. **Comment đầu file:**
   ```js
   // [paulsteigel - 2026-05-20] Mô tả ngắn gọn thay đổi
   ```
6. **Mobile responsive bắt buộc:**
   - Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N`
   - Table: bọc trong `<div className="overflow-x-auto">`
   - Sidebar: ẩn trên mobile, hiện drawer
   - Chart: luôn dùng `<ResponsiveContainer width="100%">`
7. **Loading state:** dùng skeleton (`animate-pulse bg-gray-100 rounded-lg`)
8. **Error handling:** try/catch, toast.error khi cần
9. **Format số:** luôn dùng `formatVN()` từ `@/shared/utils/format`
10. **Ant Design ConfigProvider** đã set `colorPrimary: #E4701E` — không cần override thêm

---

## 12. CÁCH BẮT ĐẦU CHAT MỚI

Copy đoạn này vào đầu chat mới:

```
Tôi đang làm dự án VSLA Admin v2 — rewrite React CRA → Vite.
Context đầy đủ ở đây: [paste nội dung file này]

Hôm nay cần làm: [tên feature cần làm]
Source code cũ tôi sẽ cung cấp nếu cần.
Repo: https://github.com/paulsteigel/vsla.git
```

---

*Tạo bởi paulsteigel + Claude, 2026-05-20*
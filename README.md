# VSLA Admin v2.0

Rewrite của care-web-admin dùng Vite + React 18 + Zustand + Ant Design 5.

## Stack
- **Vite** — build tool nhanh hơn CRA ~10x
- **React 18** — giữ nguyên
- **Ant Design 5** — giữ nguyên component
- **Tailwind CSS** — giữ nguyên màu sắc từ bản cũ
- **Zustand** — thay Redux, đơn giản hơn
- **Axios** — thay fetch thủ công

## Setup

```bash
npm install
npm run dev       # dev server tại localhost:5173
npm run build     # build production vào dist/
```

## Deploy lên server (test trên admin.sfdp.net)

```bash
npm run build
cp -r dist/* /opt/digifarmer-admin-uat/
```

## Cấu trúc

```
src/
├── features/
│   ├── auth/       LoginPage.jsx
│   ├── dashboard/  DashboardPage.jsx
│   ├── reports/    ReportPage.jsx  ← đã hoàn chỉnh
│   └── groups/     (TODO)
├── shared/
│   ├── api/        http.js + các API files
│   ├── components/ Layout.jsx, CustomSelect, CustomTable...
│   └── utils/      format.js, auth.js
└── store/
    └── authStore.js  (Zustand)
```

## Progress

- [x] Auth — Login page
- [x] Layout — SideMenu + Header + routing
- [x] Báo cáo VSLA — đầy đủ filter + multi-select + format VN
- [ ] Dashboard — placeholder
- [ ] Nhóm VSLA
- [ ] Cuộc họp
- [ ] Tổ chức / Dự án
- [ ] Thông báo / Khảo sát
- [ ] Bài viết
- [ ] Admin roles

# FinFlow — Internal Expense Reimbursement Platform (Frontend)

Giao diện người dùng cho nền tảng quản lý **chi phí nội bộ và hoàn tiền** dành cho doanh nghiệp. Nhân viên nộp chứng từ ứng trước → Manager phê duyệt → Accountant hoàn tiền. Được xây dựng bằng **Angular 21** với **Apollo GraphQL** client.

> 🔗 **Backend Repository:** [FinFlow-BackEnd](https://github.com/hort3nsia/FinFlow-BackEnd)

---

## ✨ Tính năng chính

### 🔐 Authentication & Authorization
- Đăng ký / Đăng nhập với JWT
- Xác thực email qua OTP
- Quên mật khẩu / Reset password
- Workspace selection (chuyển đổi giữa nhiều tổ chức)
- **Role-based guards**: SuperAdmin, TenantAdmin, Manager, Accountant, Staff

### 📊 Dashboard
- Tổng quan chi tiêu, ngân sách, chứng từ pending
- Analytics charts và trend visualization

### 📄 Documents (Nộp chứng từ hoàn tiền)
- Nhân viên upload biên lai/hóa đơn đã ứng trước (thủ công hoặc quét qua OCR)
- Luồng xử lý: Draft → Submitted → Approved/Rejected → Hoàn tiền
- Chi tiết chứng từ: vendor, số tiền, loại tiền, thuế, line items
- Inspector panel cho review và approval

### ✅ Approvals (Phê duyệt)
- Danh sách chứng từ chờ phê duyệt (Manager/TenantAdmin)
- Approve / Reject với lý do
- Escalation flow tự động

### 💳 Payments (Hoàn tiền)
- Hàng đợi hoàn tiền cho nhân viên (Accountant/TenantAdmin)
- Mark as paid, cancel, refund
- Xuất CSV chuyển khoản theo định dạng ngân hàng VN (VCB, BIDV, TCB)

### 👥 Members (Thành viên)
- Mời thành viên qua email
- Quản lý vai trò và phòng ban
- Deactivate / Reactivate thành viên

### 🏢 Departments (Phòng ban)
- Department tree explorer (cây phòng ban)
- CRUD phòng ban với parent-child hierarchy
- Activate / Deactivate

### 💰 Budgets (Ngân sách)
- Tạo và quản lý ngân sách theo phòng ban
- Trạng thái: Allocated / Committed / Spent
- Budget utilization tracking

### 🏪 Vendors (Nhà cung cấp/Nơi mua hàng)
- Quản lý danh sách nơi mua hàng (để phân loại chứng từ hoàn tiền)
- Auto-link vendor khi nhân viên submit chứng từ

### 📈 Reporting (Báo cáo)
- Tổng chi hoàn tiền theo phòng ban, nhân viên
- Budget utilization (ngân sách đã dùng / còn lại)
- Monthly trend analysis
- *(Yêu cầu Paid Plan)*

### 🤖 AI Chat (Chatbot)
- Chat với AI để truy vấn dữ liệu tài chính
- Streaming responses
- *(Yêu cầu Paid Plan)*

### ⚙️ Settings (Cài đặt)
- Tenant branding (logo, tên)
- Approval policies, budget policies
- Notification preferences
- *(TenantAdmin only)*

### 🔒 Platform Admin Console
- Quản lý tất cả tenants
- Subscription management
- *(SuperAdmin only)*

---

## 🏗️ Kiến trúc

```
src/
├── app/
│   ├── core/                      # Core services & guards
│   │   ├── guards/                # Auth, Role, Workspace, Subscription guards
│   │   ├── interceptors/          # HTTP interceptors
│   │   └── services/              # Auth, GraphQL, Storage services
│   │
│   ├── features/                  # Feature modules (lazy-loaded)
│   │   ├── auth/                  # Login, Register, OTP, Workspace
│   │   ├── dashboard/             # Main dashboard
│   │   ├── documents/             # Document CRUD, OCR, Review
│   │   ├── approvals/             # Approval queue
│   │   ├── payments/              # Payment processing
│   │   ├── members/               # Member management
│   │   ├── departments/           # Department tree
│   │   ├── budgets/               # Budget management
│   │   ├── vendors/               # Vendor management
│   │   ├── chat/                  # AI chatbot
│   │   ├── reporting/             # Analytics & charts
│   │   ├── subscription/          # Plan management
│   │   ├── settings/              # Tenant settings
│   │   ├── profile/               # User profile
│   │   ├── notifications/         # In-app notifications
│   │   ├── platform-admin/        # SuperAdmin console
│   │   ├── marketing/             # Landing page
│   │   ├── forbidden/             # 403 page
│   │   └── not-found/             # 404 page
│   │
│   ├── layout/                    # App shell, sidebar, header
│   ├── shared/                    # Shared components, pipes, directives
│   │
│   ├── app.routes.ts              # Route definitions with guards
│   ├── app.config.ts              # App configuration
│   └── app.ts                     # Root component
│
├── environments/                  # Environment configs
├── styles.scss                    # Global styles
└── index.html
```

### Kiến trúc nổi bật
- **Standalone Components** — Không dùng NgModules, mỗi component tự quản lý dependencies
- **Lazy Loading** — Mỗi feature module chỉ load khi cần, tối ưu bundle size
- **Route Guards** — 6 guard types: Auth, Guest, Workspace, Role, SuperAdmin, Subscription Feature
- **Apollo GraphQL Client** — State management qua Apollo cache, không cần store riêng
- **Proxy Configuration** — Dev proxy tới backend API (port 5219)

---

## 🛠️ Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Framework | Angular 21 |
| Language | TypeScript 5.9 |
| API Client | Apollo Angular 13, GraphQL |
| Styling | TailwindCSS 3.4, SCSS |
| Testing | Vitest, Playwright (E2E) |
| Build | Angular CLI 21, Vite |
| Formatting | Prettier |

---

## 📋 Yêu cầu hệ thống

- Node.js 20+
- npm 11+
- Angular CLI 21 (`npm install -g @angular/cli`)
- Backend API đang chạy tại `http://localhost:5219`

---

## ▶️ Cài đặt & Chạy

### 1. Clone repository

```bash
git clone https://github.com/hort3nsia/FinFlow-FrontEnd.git
cd FinFlow-FrontEnd
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Chạy development server

```bash
npm run dev
```

Truy cập: **http://localhost:4200**

> ⚠️ **Lưu ý:** Backend API phải đang chạy tại `http://localhost:5219`. Proxy đã được cấu hình tự động trong `proxy.conf.json`.

### 4. Build production

```bash
npm run build
```

Output sẽ nằm trong thư mục `dist/`.

---

## 🔒 Role-based Access

| Trang | SuperAdmin | TenantAdmin | Manager | Accountant | Staff |
|-------|:----------:|:-----------:|:-------:|:----------:|:-----:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Documents | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approvals | — | ✅ | ✅ | — | — |
| Payments | — | ✅ | — | ✅ | — |
| Members | — | ✅ | ✅ | ✅ | — |
| Departments | — | ✅ | ✅ | ✅ | — |
| Budgets | — | ✅ | ✅ | ✅ | — |
| Vendors | — | ✅ | ✅ | ✅ | — |
| Reports | — | ✅ | ✅ | ✅ | — |
| Settings | — | ✅ | — | — | — |
| Chat | — | ✅ | ✅ | ✅ | ✅ |
| Admin Console | ✅ | — | — | — | — |

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests (Playwright)
npm run e2e
```

---

## 📡 API Proxy

Dev server tự động proxy các request tới backend:

| Path | Target |
|------|--------|
| `/graphql` | `http://localhost:5219` |
| `/api/*` | `http://localhost:5219` |
| `/uploads/*` | `http://localhost:5219` |

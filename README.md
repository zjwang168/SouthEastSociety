# SouthEastSociety Internal Dashboard

Internal CRM / order tracking dashboard built for small business operations.

This system allows administrators to manage customers, create orders, track outstanding balances, send SMS reminders, export accounting data, and review staff activity logs.

The project includes role-based access control and is designed as a lightweight internal operations tool.

---

# Features

### Authentication
- Secure login system
- JWT authentication
- Change password
- Admin reset staff password

### Role-based Access Control
Two roles are supported:

**Admin**
- Full system access
- Create orders
- Manage customers
- View phone numbers
- Send SMS reminders
- View audit logs
- Reset staff passwords
- Export CSV

**Staff**
- Read-only reporting access
- Export accounting CSV
- View audit logs
- Cannot see customer phone numbers
- Cannot create orders

---

# Core Modules

### Customer Management
- Create customers
- Add multiple phone numbers
- Primary phone selection
- SMS enable/disable per phone

### Order Management
- Create orders
- Record payment amount
- Track outstanding balances
- Points earned calculation
- Operator tracking

### Outstanding Balance Tracking
- Aggregates unpaid balances
- Lists customers with debt
- Allows SMS reminder creation

### SMS Reminder System
Queue-based SMS system

Workflow:
1. Create SMS reminder
2. Queue SMS
3. Send scheduled messages
4. Store delivery logs

---

### Audit Logging

Tracks critical system actions:

- Login
- Password changes
- Admin password resets
- Data modifications

Admins can review system activity through the audit dashboard.

---

### CSV Export (Accounting)

Exports order data for bookkeeping and tax reporting.

Export fields:

- order_id
- created_at
- customer_id
- phone_number_used (Admin only)
- amount
- paid_amount
- points_earned
- operator_user_id
- note

Staff exports automatically hide phone numbers.

---

# Tech Stack

### Backend
FastAPI  
SQLAlchemy  
SQLite (MVP database)  
JWT Authentication  

### Frontend
React  
TypeScript  
Vite  
Axios  

---

# Project Structure
backend/
app/
routers/
auth.py
customers.py
orders.py
sms.py
audit.py
services/
audit.py
sms.py
models.py
schemas.py
main.py

frontend/
src/
pages/
DashboardPage.tsx
CustomersPage.tsx
OrdersCreatePage.tsx
OutstandingPage.tsx
SmsQueuePage.tsx
AuditPage.tsx
ExportPage.tsx
components/
ProtectedRoute.tsx
RoleProtectedRoute.tsx

---

# Local Development

### Backend
cd backend
uvicorn app.main:app –reload –port 8004


API docs available at:
http://127.0.0.1:8004/docs

---

### Frontend
cd frontend
npm install
npm run dev

Frontend runs at:
http://localhost:5173

---

# Default Admin Account (First Run)

The system auto-creates an admin user if no users exist.

Change the password immediately after first login.

---

# Security Notes

- Passwords are hashed
- JWT tokens used for authentication
- Role-based authorization enforced
- Audit logs track administrative actions

---

# MVP Limitations

This MVP version uses:

- SQLite database
- Basic SMS sending integration
- No email password recovery

Future improvements may include:

- PostgreSQL database
- SMS provider integration
- User management UI
- Production deployment

---

# License

Internal business software.
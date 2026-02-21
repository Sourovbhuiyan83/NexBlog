# Simple Full-Stack Website

## Folder Structure

```
project/
├── backend/
│   ├── server.js          ← Main backend file (Node.js + Express)
│   └── package.json       ← Dependencies list
└── frontend/
    ├── index.html         ← Main website (Signup/Login)
    └── admin.html         ← Admin panel
```

## Features
- ✅ User Signup & Login (bcrypt password hashing)
- ✅ Admin Panel with user list
- ✅ Password Reset by admin
- ✅ Visitor Counter
- ✅ Dashboard with stats

---

## Setup Instructions (Step by Step)

### Step 1: MongoDB Install করুন
MongoDB community edition install করুন এবং চালু করুন।
- Windows: https://www.mongodb.com/try/download/community
- Mac: `brew install mongodb-community`
- Linux: `sudo apt install mongodb`

MongoDB চালু করুন:
```
# Windows: MongoDB Compass বা Services থেকে চালু করুন
# Mac/Linux:
sudo systemctl start mongod
```

### Step 2: Node.js Install করুন (যদি না থাকে)
https://nodejs.org থেকে LTS version download করুন।

### Step 3: Backend Setup
```bash
cd project/backend
npm install
```

### Step 4: Server চালু করুন
```bash
node server.js
```

Server চালু হলে দেখবেন:
```
MongoDB connected successfully
Server চালু আছে: http://localhost:3000
Admin panel: http://localhost:3000/admin.html
```

### Step 5: Website দেখুন
Browser-এ যান:
- **Main Website:** http://localhost:3000
- **Admin Panel:** http://localhost:3000/admin.html

---

## Admin Credentials
```
Username: admin
Password: admin123
```

---

## API Endpoints

| Method | URL | কাজ |
|--------|-----|-----|
| POST | /api/signup | User signup |
| POST | /api/login | User login |
| POST | /api/visitor/increment | Visitor count বাড়ানো |
| GET | /api/visitor/count | Visitor count দেখা |
| POST | /api/admin/login | Admin login |
| GET | /api/admin/users | সব user list |
| GET | /api/admin/stats | Dashboard stats |
| POST | /api/admin/reset-password | Password reset |

---

## Important Notes
- Password কখনো plain text-এ save হয় না (bcrypt use করা হয়েছে)
- Admin panel-এ কোনো password দেখা যায় না
- Visitor count database-এ save হয়

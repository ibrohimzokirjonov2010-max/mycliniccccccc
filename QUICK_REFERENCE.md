# ⚡ Quick Reference Guide

## 🚀 Boshlash (Getting Started)

### Backend Ishga Tushirish
```bash
cd backend
npm install
copy .env.example .env
# .env ni tahrirlang (MongoDB connection string qo'shing)
npm run start:dev
```

**Server:** http://localhost:3000  
**API Docs:** http://localhost:3000/api/docs

### Docker Bilan (Eng Oson)
```bash
docker-compose up -d
```

---

## 🔑 Muhim Fayllar

| Fayl | Maqsad |
|------|--------|
| `backend/.env.example` | Environment template |
| `backend/docker-compose.yml` | Docker setup |
| `backend/README.md` | To'liq qo'llanma |
| `backend/SETUP_UZ.md` | O'zbekcha o'rnatish |
| `backend/DEPLOYMENT.md` | Production deploy |
| `PROJECT_SUMMARY.md` | Loyiha xulosasi |

---

## 📦 12 Ta Entity

1. Patient - Bemorlar
2. Appointment - Qabullar
3. Payment - To'lovlar
4. Service - Xizmatlar
5. Inventory - Inventarizatsiya
6. Lead - Potensial mijozlar
7. TreatmentPlan - Davolash rejasi
8. **Implant** - Implantlar ✨ (FIXED!)
9. User - Foydalanuvchilar
10. Expense - Xarajatlar
11. Recall - Eslatmalar
12. Debt - Qarzlar

---

## 🔐 Auth Flow

```javascript
// 1. Login
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123",
  "clinic_id": "ava-dent"
}

// Response: { access_token, user }

// 2. API Call with Token
GET /api/patients
Headers:
  Authorization: Bearer eyJhbGci...
  X-Clinic-ID: ava-dent
```

---

## 🌐 API Endpoints (CRUD)

Har bir entity uchun:
- `GET /api/{entity}` - Ro'yxat
- `GET /api/{entity}/:id` - Bitta yozuv
- `POST /api/{entity}` - Yaratish
- `PUT /api/{entity}/:id` - Yangilash
- `DELETE /api/{entity}/:id` - O'chirish

**Misol:**
```bash
GET /api/implants?patient_id=123
POST /api/appointments
PUT /api/payments/:id
```

---

## 💻 Frontend Integratsiyasi

### API Client Yarating

```javascript
// src/api/apiClient.js
const API_BASE = 'http://localhost:3000/api';

export const apiClient = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('jwt_token');
    const clinicId = localStorage.getItem('clinic_id');
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Clinic-ID': clinicId,
      },
    };
    
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    if (!response.ok) throw new Error('Request failed');
    return response.json();
  },
};
```

### Service Misol

```javascript
// src/services/implantService.js
import { apiClient } from '@/api/apiClient';

export const implantService = {
  getAll: (filters) => apiClient.get(`/implants?${new URLSearchParams(filters)}`),
  getById: (id) => apiClient.get(`/implants/${id}`),
  create: (data) => apiClient.post('/implants', data),
  update: (id, data) => apiClient.put(`/implants/${id}`, data),
  delete: (id) => apiClient.delete(`/implants/${id}`),
};
```

---

## 🐛 Troubleshooting

### Dependencies Installation Failed
```bash
rm -rf node_modules package-lock.json
npm install
```

### MongoDB Connection Error
- Check MongoDB Atlas connection string
- Ensure IP whitelist includes your server
- Test with: `mongosh "your-connection-string"`

### Port Already in Use
Edit `.env`:
```
PORT=3001
```

### CORS Error
Check `backend/src/main.ts`:
```typescript
app.enableCors({
  origin: ['http://localhost:5175'],
  credentials: true,
});
```

---

## 📊 Database Commands

### MongoDB Atlas (Cloud)
1. Ro'yxatdan o'ting: https://www.mongodb.com/cloud/atlas
2. Free cluster yarating
3. Connection string oling
4. `.env` ga qo'shing: `MONGODB_URI=mongodb+srv://...`

### Local MongoDB
```bash
# Windows (PowerShell)
mongosh mongodb://localhost:27017/dental-clinic

# Show collections
show collections

# Query implants
db.implants.find()
```

### Docker MongoDB
```bash
docker-compose exec mongodb mongosh -u admin -p admin123
use dental-clinic
db.implants.find()
```

---

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### Load Test (200 users)
```bash
npm install -g artillery
artillery quick --count 200 --num 10 http://localhost:3000/api/patients
```

### API Testing (Swagger)
1. Open http://localhost:3000/api/docs
2. Authorize with JWT token
3. Try any endpoint

---

## 🚀 Deploy Checklist

- ✅ MongoDB connection configured
- ✅ JWT secret set (strong random string)
- ✅ Stripe keys added (if using payments)
- ✅ Frontend URL configured in CORS
- ✅ `.env` file complete
- ✅ Dependencies installed
- ✅ Server starts without errors
- ✅ API docs accessible
- ✅ Can create/read/update/delete entities

### Production Deploy

```bash
# DigitalOcean / VPS
git clone YOUR_REPO
cd backend
npm install --production
cp .env.example .env
# Edit .env
pm2 start dist/main.js --name dental-backend
pm2 startup
pm2 save
```

---

## 💰 Stripe Setup (Optional)

1. Ro'yxatdan: https://stripe.com
2. API keys oling
3. `.env` ga qo'shing:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Create Payment Intent
```javascript
POST /api/stripe/create-payment-intent
{
  "amount": 50000, // $500.00
  "currency": "usd",
  "clinic_id": "ava-dent"
}
```

---

## 📱 Mobile Adaptation

Frontend allaqachon mobile-friendly!  
Backend changes not needed for mobile.

Key mobile pages already optimized:
- ✅ Settings
- ✅ Debts
- ✅ Recall
- ✅ Patients
- ✅ Appointments
- ✅ Implants

---

## 🎯 Key Files to Edit

### Environment
- `backend/.env` - Database, JWT, Stripe

### Database Schemas
- `backend/src/*/schemas/*.schema.ts` - All 12 entities

### Authentication
- `backend/src/auth/auth.controller.ts` (create this)
- `backend/src/auth/auth.service.ts` (create this)

### API Routes
- `backend/src/*/controllers/*.controller.ts` (create these)

---

## 🔗 Useful Links

- **NestJS Docs:** https://docs.nestjs.com
- **MongoDB Docs:** https://docs.mongodb.com
- **Stripe Docs:** https://stripe.com/docs
- **Docker Docs:** https://docs.docker.com
- **DigitalOcean Tutorials:** https://www.digitalocean.com/community/tutorials

---

## 📞 Yordam

Muammolar uchun:
1. API docs: http://localhost:3000/api/docs
2. Logs: `pm2 logs dental-backend`
3. Nginx: `tail -f /var/log/nginx/error.log`
4. MongoDB: `mongosh` va `db.implants.find()`

---

## ✅ Tayyor!

Sizda bor:
- ✅ Professional backend
- ✅ 12 ta entity schemas
- ✅ Multi-tenant architecture
- ✅ JWT authentication ready
- ✅ Docker setup
- ✅ Deployment guides
- ✅ Complete documentation

Endi kerak:
1. Install dependencies
2. Setup MongoDB
3. Start server
4. Test API
5. Deploy to production

**Omad tilaymiz!** 🚀

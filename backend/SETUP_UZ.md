# 🚀 O'RNATISH QOIDASI (Installation Guide)

## 1-QADAM: Backend Dependencies

```bash
cd backend
npm install
```

**Eslatma:** Agar xatolar chiqsa (module not found), bu normal - hali dependencies o'rnatilmagan.

## 2-QADAM: Environment Variables

```bash
# .env faylni yarating
cp .env.example .env
```

`.env` faylni tahrirlang va quyidagi ma'lumotlarni kiriting:

### MongoDB (TANLASH KERAK):

**Variant A: MongoDB Atlas (Cloud - Tavsiya etiladi)**
1. https://www.mongodb.com/cloud/atlas ga ro'yxatdan o'ting
2. Free cluster yarating
3. Connection string oling: `mongodb+srv://username:password@cluster.mongodb.net/dental-clinic`
4. `.env` faylda `MONGODB_URI` ga qo'ying

**Variant B: Local MongoDB**
```
MONGODB_URI=mongodb://localhost:27017/dental-clinic
```

Agar Docker ishlatayotgan bo'lsangiz:
```
MONGODB_URI=mongodb://admin:admin123@localhost:27017/dental-clinic?authSource=admin
```

### JWT Secret
```bash
JWT_SECRET=super-secret-key-change-this-to-random-string-2024
```

Random string yaratish uchun:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Stripe (Optional - agar to'lov qilish kerak bo'lsa)
1. https://stripe.com da ro'yxatdan o'ting
2. API keys oling
3. `.env` ga qo'ying:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 3-QADAM: Serverni Ishga Tushirish

### Development Mode
```bash
npm run start:dev
```

Server ishga tushadi: **http://localhost:3000**

API Documentation: **http://localhost:3000/api/docs**

### Production Mode
```bash
npm run build
npm run start:prod
```

## 4-QADAM: Docker Bilan Ishga Tushirish (Tavsiya etiladi)

```bash
# Barcha servislarni ishga tushirish
docker-compose up -d

# Loglarni ko'rish
docker-compose logs -f backend

# To'xtatish
docker-compose down
```

Docker quyidagilarni avtomatik ishga tushiradi:
- ✅ MongoDB database
- ✅ Redis cache
- ✅ Backend API

## 5-QADAM: Frontend Integratsiyasi

Frontend kodini yangilang:

### 1. API Client Yarating

`src/api/apiClient.js` faylni yarating:

```javascript
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
        ...options.headers,
      },
    };
    
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }
    
    return response.json();
  },
  
  // CRUD operations
  get: (endpoint) => this.request(endpoint),
  post: (endpoint, data) => this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint, data) => this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint) => this.request(endpoint, { method: 'DELETE' }),
};
```

### 2. Implant Service Misol

`src/services/implantService.js`:

```javascript
import { apiClient } from '@/api/apiClient';

export const implantService = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return apiClient.get(`/implants?${params}`);
  },
  
  getById: (id) => apiClient.get(`/implants/${id}`),
  
  create: (data) => apiClient.post('/implants', data),
  
  update: (id, data) => apiClient.put(`/implants/${id}`, data),
  
  delete: (id) => apiClient.delete(`/implants/${id}`),
};
```

### 3. Login Sahifasini Yangilash

`src/pages/Login.jsx` da:

```javascript
const handleLogin = async (credentials) => {
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      localStorage.setItem('jwt_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('clinic_id', data.user.clinic_id);
      window.location.href = '/';
    }
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
};
```

## 6-QADAM: Ma'lumotlarni Ko'chirish (Optional)

Agar LocalStorage dan ma'lumotlarni ko'chirmoqchi bo'lsangiz:

```javascript
// Browser console da ishga tushiring
async function migrateData() {
  const patients = JSON.parse(localStorage.getItem('mock_db_default_clinic_Patient') || '[]');
  
  for (const patient of patients) {
    await fetch('http://localhost:3000/api/patients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`,
      },
      body: JSON.stringify(patient),
    });
  }
  
  console.log('Migration complete!');
}

migrateData();
```

## 7-QADAM: Testing

### Unit Tests
```bash
npm run test
```

### Load Testing (200+ users)
```bash
npm install -g artillery
artillery quick --count 200 --num 10 http://localhost:3000/api/patients
```

## 🔍 Muammolarni Hal Qilish

### "Module not found" xatosi
```bash
npm install
rm -rf node_modules package-lock.json
npm install
```

### MongoDB ulanmayapti
```bash
# Docker ishlatayotgan bo'lsangiz
docker-compose ps
docker-compose logs mongodb

# Local MongoDB
mongosh mongodb://localhost:27017/dental-clinic
```

### Port band
`.env` faylda PORT ni o'zgartiring:
```
PORT=3001
```

### CORS xatosi
`backend/src/main.ts` da CORS sozlamalarini tekshiring:
```typescript
app.enableCors({
  origin: ['http://localhost:5175'], // Frontend URL
  credentials: true,
});
```

## ✅ Tayyor!

Backend tayyor. Endi frontend integratsiyasini bajaring va serverga joylashtiring!

### Keyingi Qadamlar:
1. ✅ Backend o'rnatildi va ishlamoqda
2. ⏳ Frontend API client integratsiyasi
3. ⏳ Authentication UI yangilash
4. ⏳ Production deployment

## 📞 Yordam

Savollar bo'lsa:
1. API docs: http://localhost:3000/api/docs
2. README.md faylni o'qing
3. NestJS docs: https://docs.nestjs.com

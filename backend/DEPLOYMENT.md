# 🌐 Production Deployment Guide

## Serverga Joylashtirish (Full Production Setup)

### 1-BOB: Cloud Hosting Tanlash

#### Tavsiya Etiladigan Platformalar:

**1. DigitalOcean (Eng Oson)**
- Narx: $6/oy (basic droplet)
- Link: https://www.digitalocean.com
- Qulaylik: One-click MongoDB, automatic backups

**2. AWS EC2 (Enterprise)**
- Narx: $10-15/oy (t3.medium)
- Link: https://aws.amazon.com/ec2
- Qulaylik: Masshtablanuvchan, ishonchli

**3. Hetzner (Arzon)**
- Narx: €5/oy
- Link: https://www.hetzner.com
- Qulaylik: Arzon lekin sifatli

**4. Cloud.uz (O'zbekistonda)**
- Narx: 50,000 so'm/oy dan
- Link: https://cloud.uz
- Qulaylik: Local support, tezlik

---

### 2-BOB: DigitalOcean Ga Deploy (Tavsiya Etiladi)

#### Qadam 1: Ro'yxatdan O'tish
1. https://www.digitalocean.com da ro'yxatdan o'ting
2. $200 credit olasiz (yangi foydalanuvchilar uchun)

#### Qadam 2: Droplet Yaratish
1. **Create Droplet** tugmasini bosing
2. **Choose an Image**: Ubuntu 22.04 LTS
3. **Choose a Plan**: Basic ($6/oy) yoki Premium ($12/oy)
4. **Add SSH Key** (tavsiya etiladi) yoki parol
5. **Hostname**: `dental-clinic-api`
6. **Create Droplet**

#### Qadam 3: SSH Orqali Ulanish
```bash
ssh root@YOUR_SERVER_IP
```

#### Qadam 4: Serverni Sozlash

```bash
# Yangilash
apt update && apt upgrade -y

# Node.js o'rnatish
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Git o'rnatish
apt install -y git

# MongoDB o'rnatish
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

# Nginx o'rnatish
apt install -y nginx

# Firewall sozlash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

#### Qadam 5: Kodni Yuklash

```bash
# Loyihani clone qilish
cd /var/www
git clone YOUR_GIT_REPO dental-clinic
cd dental-clinic/backend

# Dependencies o'rnatish
npm install --production

# .env fayl yaratish
nano .env
```

`.env` faylga quyidagilarni qo'shing:
```env
MONGODB_URI=mongodb://localhost:27017/dental-clinic
JWT_SECRET=super-secret-production-key-2024
PORT=3000
NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_...
FRONTEND_URL=https://yourdomain.com
```

#### Qadam 6: PM2 O'rnatish (Process Manager)

```bash
npm install -g pm2

# Backend ni ishga tushirish
pm2 start dist/main.js --name dental-backend

# Avtomatik ishga tushish
pm2 startup
pm2 save

# Holatini tekshirish
pm2 status
pm2 logs dental-backend
```

#### Qadam 7: Nginx Reverse Proxy

```bash
nano /etc/nginx/sites-available/dental-clinic
```

Config fayl:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Frontend (static files)
    location / {
        root /var/www/dental-clinic/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

Aktivlashtirish:
```bash
ln -s /etc/nginx/sites-available/dental-clinic /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

#### Qadam 8: SSL Certificate (HTTPS)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Avto-yangilash:
```bash
certbot renew --dry-run
```

---

### 3-BOB: Docker Bilan Deploy (Eng Oson)

#### Qadam 1: Docker O'rnatish

```bash
# Docker o'rnatish
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose o'rnatish
apt install docker-compose-plugin
```

#### Qadam 2: Kodni Yuklash

```bash
cd /var/www
git clone YOUR_GIT_REPO dental-clinic
cd dental-clinic/backend

# .env fayl yaratish
cp .env.example .env
nano .env
```

#### Qadam 3: Ishga Tushirish

```bash
docker-compose up -d
```

#### Qadam 4: Monitoring

```bash
# Loglarni ko'rish
docker-compose logs -f backend

# Holat
docker-compose ps

# To'xtatish
docker-compose down
```

---

### 4-BOB: Frontend Build va Deploy

```bash
# Frontend papkasida
cd ../frontend

# .env.production yaratish
echo "VITE_API_URL=https://yourdomain.com/api" > .env.production

# Build qilish
npm run build

# Nginx ga nusxalash
cp -r dist/* /var/www/dental-clinic/frontend/dist/
```

---

### 5-BOB: Database Backup Strategy

#### Kunlik Backup Script

```bash
nano /usr/local/bin/backup-mongodb.sh
```

Script:
```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d-%H%M)
BACKUP_DIR="/var/backups/mongodb"
mkdir -p $BACKUP_DIR

mongodump --db dental-clinic --out $BACKUP_DIR/backup-$DATE

# Faqat oxirgi 7 kunlik backuplarni saqlash
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;
```

Ishga tushirish:
```bash
chmod +x /usr/local/bin/backup-mongodb.sh

# Har kuni soat 3:00 da
crontab -e
# Qo'shing: 0 3 * * * /usr/local/bin/backup-mongodb.sh
```

---

### 6-BOB: Monitoring va Alerting

#### Uptime Monitoring
1. https://uptimerobot.com da ro'yxatdan o'ting
2. API URL qo'shing: `https://yourdomain.com/api/health`
3. Har 5 daqiqada tekshiradi
4. Email/SMS alert

#### Log Management
```bash
# PM2 loglari
pm2 logs dental-backend --lines 100

# Nginx loglari
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

#### Error Tracking (Sentry)
1. https://sentry.io da ro'yxatdan o'ting
2. Backend ga Sentry SDK qo'shing
3. Barcha xatolar avtomatik kuzatiladi

---

### 7-BOB: Performance Optimization

#### Redis Cache

```bash
# Docker compose da Redis bor
# Backend kodida cache qo'shing
```

#### Database Indexes

```javascript
// Mongoose schema da indexlar qo'shilgan
PatientSchema.index({ clinic_id: 1, full_name: 1 });
AppointmentSchema.index({ clinic_id: 1, date: 1, time: 1 });
```

#### CDN (Static Files)
1. Cloudflare (bepul)
2. Frontend static assets tezlashadi

---

### 8-BOB: Security Checklist

✅ **SSL Certificate** - HTTPS yoqilgan  
✅ **Firewall** - UFW faqat kerakli portlarni ochiq  
✅ **Fail2Ban** - Brute force hujumlardan himoya  
✅ **Rate Limiting** - API da so'rovlar soni cheklangan  
✅ **CORS** - Faqat ruxsat berilgan domenlar  
✅ **JWT Secret** - Maxfiy kalit  
✅ **Database Auth** - MongoDB autentifikatsiya  
✅ **Regular Updates** - Tizim va paketlar yangilangan  
✅ **Backups** - Kunlik backup  

---

### 9-BOB: Domain Setup

#### DNS Records

Domain registrar da quyidagi recordlarni qo'shing:

```
Type    Name              Value
A       @                 YOUR_SERVER_IP
A       www               YOUR_SERVER_IP
A       api               YOUR_SERVER_IP
```

#### Cloudflare (Optional lekin tavsiya)

1. https://www.cloudflare.com da ro'yxatdan o'ting
2. Domain qo'shing
3. Nameserverlarni o'zgartiring
4. SSL/TLS encryption mode: Full
5. Auto minify: HTML, CSS, JS yoqing

---

### 10-BOB: Final Testing

#### Health Check

```bash
curl https://yourdomain.com/api/health
```

#### Load Testing

```bash
# Artillery o'rnatish
npm install -g artillery

# Test: 200 user, 10 daqiqa
artillery quick --count 200 --num 10 https://yourdomain.com/api/patients
```

#### Mobile Test
1. Chrome DevTools da mobile view oching
2. Barcha sahifalarni tekshiring
3. Action icons ishlayotganligini tasdiqlang

---

### 11-BOB: Go Live!

#### Tayyormi? Checklist:

- ✅ Backend production mode da ishlamoqda
- ✅ Frontend build qilingan
- ✅ Database backup strategy mavjud
- ✅ SSL certificate o'rnatilgan
- ✅ Monitoring sozlangan
- ✅ Domain konfiguratsiyasi to'g'ri
- ✅ Load test muvaffaqiyatli o'tdi
- ✅ Security checklist bajarildi

#### Launch!

1. Oxirgi backupni oling
2. Frontend ni deploy qiling
3. Backend ni restart qiling
4. DNS propagation ni kuting (24-48 soat)
5. Barcha funksiyalarni test qiling

---

## 🎉 Tabriklayman! Sayt Live!

### Post-Launch:

1. **Analytics**: Google Analytics qo'shing
2. **Error Tracking**: Sentry monitoring
3. **Performance**: Core Web Vitals tekshirish
4. **SEO**: Meta tags, sitemap
5. **Marketing**: Ijtimoiy tarmoqlarda e'lon qiling

### Support:

Agar muammo bo'lsa:
- PM2 logs: `pm2 logs dental-backend`
- Nginx logs: `tail -f /var/log/nginx/error.log`
- MongoDB: `mongosh`

---

## 📊 Narxlar (Oyiga):

| Xizmat | Basic | Recommended |
|--------|-------|-------------|
| Hosting (DigitalOcean) | $6 | $12 |
| Domain | $1 | $1 |
| MongoDB Atlas (optional) | Free | $9 |
| Stripe fees | 2.9% + $0.30 | 2.9% + $0.30 |
| **JAMI** | **~$8/oy** | **~$22/oy** |

O'zbekiston so'mida: ~80,000 - 220,000 so'm/oy

---

## 🚀 Tez Boshlash:

```bash
# Eng oson yo'l - Docker bilan
git clone YOUR_REPO dental-clinic
cd dental-clinic/backend
cp .env.example .env
# .env ni tahrirlang
docker-compose up -d
```

**Hammasi!** Backend tayyor! 🎉

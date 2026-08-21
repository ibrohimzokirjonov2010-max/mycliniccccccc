# 🚀 START HERE - Backend Quick Setup

## ✅ 3 Simple Steps to Get Started

### Step 1: Verify Installation (1 minute)

Run this command in the backend folder:
```bash
npm install
```

**This installs all required packages.** Wait for it to complete.

---

### Step 2: Reload VS Code (10 seconds)

The errors you see are because VS Code hasn't reloaded yet!

**Press:** `Ctrl+Shift+P` → Type "Reload Window" → Press Enter

OR just close and reopen VS Code.

---

### Step 3: Setup Environment (2 minutes)

```bash
# Copy the example environment file
copy .env.example .env
```

Now edit `.env` file and add MongoDB connection string:

**Option A: MongoDB Atlas (Cloud - Recommended)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create free cluster (M0)
4. Click "Connect" → "Connect your application"
5. Copy connection string
6. Replace in `.env`:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dental-clinic
```

**Option B: Local MongoDB**
If you have MongoDB installed locally:
```
MONGODB_URI=mongodb://localhost:27017/dental-clinic
```

Or with Docker:
```
MONGODB_URI=mongodb://admin:admin123@localhost:27017/dental-clinic?authSource=admin
```

---

## 🎯 That's It! Now Start the Server

```bash
npm run start:dev
```

You should see:
```
🦷 Application is running on: http://localhost:3000
📚 API Documentation: http://localhost:3000/api/docs
```

---

## 🔍 Troubleshooting

### ❌ Still seeing errors?

**Check if dependencies installed:**
```bash
check-status.bat
```

This will tell you what's missing.

### ❌ "Cannot find module" errors persist?

1. Make sure you ran `npm install` in the `backend` folder
2. Wait 30 seconds after install completes
3. Reload VS Code window (`Ctrl+Shift+P` → "Reload Window")
4. If still failing, run:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### ❌ Port 3000 already in use?

Edit `.env` file:
```
PORT=3001
```

Then restart the server.

---

## ✅ Success Checklist

After following steps above, you should have:

- ✅ No more red errors in VS Code (or very few)
- ✅ Server starts without crashing
- ✅ Can access http://localhost:3000/api/docs
- ✅ Swagger documentation loads

---

## 📚 What's Next?

Once server is running:

1. **Test the API** at http://localhost:3000/api/docs
2. **Create your first user** via POST /api/users
3. **Integrate with frontend** by updating API calls
4. **Deploy to production** using DEPLOYMENT.md guide

---

## 🆘 Need Help?

- Check `README.md` for detailed documentation
- Check `SETUP_UZ.md` for Uzbek instructions
- Check `DEPLOYMENT.md` for production deployment
- Run `check-status.bat` to verify installation

---

**Good luck!** 🚀

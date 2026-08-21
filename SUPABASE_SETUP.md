# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Project name**: Dental Clinic
   - **Database password**: (create a strong password)
   - **Region**: Choose closest to you
5. Click "Create new project"
6. Wait for project to be ready (2-3 minutes)

## 2. Get Your Credentials

1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbG...`

## 3. Configure Environment Variables

1. Open `.env` file in the project root
2. Replace the values:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 4. Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the entire content of `supabase-schema.sql`
4. Click "Run" (or press Ctrl+Enter)
5. Wait for success message

## 5. Verify Setup

1. In Supabase dashboard, go to **Table Editor**
2. You should see all tables:
   - clinics
   - users
   - patients
   - appointments
   - payments
   - services
   - treatment_plans
   - tooth_records
   - implants
   - leads
   - recalls
   - debts
   - expenses
   - inventory
   - notes
   - xrays
   - advertisements

3. Check that default data exists:
   - **clinics** table should have 2 rows (ava-dent, default_clinic)
   - **users** table should have 4 rows

## 6. Test Connection

1. Start your development server: `npm run dev`
2. Open browser console (F12)
3. Look for any Supabase connection errors
4. If no errors, you're good to go!

## 7. Migrate Existing Data (Optional)

If you have existing data in localStorage:

### Option A: Manual Migration
1. Open browser console on your current app
2. Run:
```javascript
// Export clinics
console.log('CLINICS:', JSON.stringify(localStorage.getItem('system_clinics')));

// Export users
console.log('USERS:', JSON.stringify(localStorage.getItem('system_users')));
```
3. Copy the output
4. Use Supabase dashboard to manually insert data

### Option B: Automated Migration Script
(To be created based on your needs)

## 8. Security (Production)

For production, enable Row Level Security (RLS):

1. In Supabase, go to **Authentication** > **Policies**
2. Enable RLS for each table
3. Create policies based on user authentication

Example policy for clinics:
```sql
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinics viewable by authenticated users"
ON clinics FOR SELECT
TO authenticated
USING (true);
```

## Troubleshooting

### Connection Error
- Check if `.env` file has correct credentials
- Restart dev server after changing `.env`
- Check browser console for specific error messages

### Table Not Found
- Make sure you ran the entire SQL schema
- Check Supabase Table Editor to verify tables exist

### Data Not Showing
- Check browser console for errors
- Verify RLS policies aren't blocking access
- Check Network tab in DevTools for failed requests

## Next Steps

1. ✅ Update base44Client.jsx to use Supabase
2. ✅ Test all CRUD operations
3. ✅ Add real-time subscriptions (optional)
4. ✅ Set up backup strategy
5. ✅ Configure production environment

## Support

- Supabase Docs: https://supabase.com/docs
- Community: https://discord.supabase.com

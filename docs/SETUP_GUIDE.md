# Setup Guide - Phase 1: Supabase Foundation

## Step 1: Create Supabase Project (10 minutes)

### 1.1 Sign up / Login
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign in with GitHub (recommended) or email

### 1.2 Create New Project
1. Click "New Project"
2. Fill in:
   - **Organization:** Create new or use existing
   - **Name:** `fuel-bi-saas`
   - **Database Password:** Generate strong password (SAVE IT!)
   - **Region:** South America (São Paulo) - closest to Brazil
   - **Pricing Plan:** Free (for development)
3. Click "Create new project"
4. **Wait ~2 minutes** for project provisioning

### 1.3 Get API Credentials
Once project is ready:

1. Go to **Settings** → **API** (left sidebar)
2. Copy these values:
   ```
   Project URL: https://xxxxxxxxxxxxx.supabase.co
   anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (SECRET!)
   ```

3. Save to `config/.env.local`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-public-key
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```

---

## Step 2: Create Database Schema (15 minutes)

### 2.1 Open SQL Editor
1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click "New query"

### 2.2 Run Schema Creation
1. Copy the entire contents of `docs/DATABASE_SCHEMA.sql`
2. Paste into SQL Editor
3. Click **Run** (or Ctrl+Enter)
4. Verify: "Success. No rows returned"

### 2.3 Verify Tables Created
1. Go to **Table Editor** (left sidebar)
2. You should see 10 tables:
   - companies
   - users
   - access_logs
   - fuel_purchases
   - fuel_sales_intraday
   - fuel_cost_allocation_intraday
   - daily_summary
   - product_performance_daily
   - current_inventory
   - uploaded_reports

---

## Step 3: Create Storage Buckets (5 minutes)

### 3.1 Create Reports Bucket
1. Go to **Storage** (left sidebar)
2. Click "New bucket"
3. Enter:
   - **Name:** `erp-reports`
   - **Public bucket:** UNCHECKED (private)
   - **Allowed MIME types:** Leave default
   - **File size limit:** 50 MB
4. Click "Create bucket"

### 3.2 Set Storage Policies
The schema already created RLS policies, but verify:

1. Click on `erp-reports` bucket
2. Go to "Policies" tab
3. Should see policies for:
   - Service role can upload
   - Users can read their company's files

---

## Step 4: Create Super Admin Account (5 minutes)

### 4.1 Create First Company
1. Go to **Table Editor** → `companies`
2. Click "Insert" → "Insert row"
3. Fill in:
   ```
   company_code: ADMIN
   company_name: System Admin
   display_name: Admin
   status: active
   ```
4. Click "Save"
5. Note the `id` (probably 1)

### 4.2 Create Super Admin User
1. Go to **Table Editor** → `users`
2. Click "Insert" → "Insert row"
3. Fill in:
   ```
   company_id: 1 (from step 4.1)
   email: your-email@example.com
   password_hash: (we'll set this via code in next step)
   full_name: Your Name
   role: super_admin
   is_active: true
   ```
4. Click "Save"

### 4.3 Generate Password Hash
We'll create a Python script to hash passwords properly.

For now, you can use this temporary approach in SQL Editor:
```sql
-- Temporary: Set a simple password (we'll improve this)
UPDATE users
SET password_hash = crypt('YourPassword123!', gen_salt('bf'))
WHERE email = 'your-email@example.com';
```

**Note:** We'll implement proper password hashing with bcrypt in the authentication module.

---

## Step 5: Test Connection (5 minutes)

### 5.1 Install Python Dependencies
```powershell
cd C:\FRCNC_Local\Thiago\1strev\backend
pip install supabase python-dotenv bcrypt
```

### 5.2 Test Connection Script
Create `backend/test_connection.py`:
```python
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('../config/.env.local')

supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_KEY')

try:
    supabase = create_client(supabase_url, supabase_key)

    # Test query
    result = supabase.table('companies').select('*').execute()

    print("[OK] Connection successful!")
    print(f"Found {len(result.data)} companies")
    for company in result.data:
        print(f"  - {company['display_name']} ({company['company_code']})")

except Exception as e:
    print(f"[ERROR] Connection failed: {e}")
```

### 5.3 Run Test
```powershell
cd C:\FRCNC_Local\Thiago\1strev\backend
python test_connection.py
```

Expected output:
```
[OK] Connection successful!
Found 1 companies
  - Admin (ADMIN)
```

---

## Step 6: Configure Row-Level Security (Already Done!)

The `DATABASE_SCHEMA.sql` already includes RLS policies for all tables.

### Verify RLS is Active
1. Go to **Table Editor** → any table (e.g., `fuel_purchases`)
2. Click on table → **Policies** tab
3. Should see policy: `purchases_company_isolation`

### How RLS Works
- Regular users can only see data where `company_id` matches their company
- Super admins (role='super_admin') can see ALL data
- Enforced at database level (can't be bypassed)

---

## Step 7: Create Development Company (5 minutes)

### 7.1 Add Test Company
1. Go to **Table Editor** → `companies`
2. Insert new row:
   ```
   company_code: TEST001
   company_name: Test Fuel Company
   display_name: Test Company
   status: active
   ```
3. Note the `id` (probably 2)

### 7.2 Add Test Users
1. Go to **Table Editor** → `users`
2. Insert 3 users:
   ```
   User 1:
   company_id: 2
   email: user1@testcompany.com
   full_name: Test User 1
   role: user

   User 2:
   company_id: 2
   email: user2@testcompany.com
   full_name: Test User 2
   role: user

   User 3:
   company_id: 2
   email: user3@testcompany.com
   full_name: Test User 3
   role: user
   ```

### 7.3 Set Passwords
Use SQL Editor:
```sql
UPDATE users
SET password_hash = crypt('TestPass123!', gen_salt('bf'))
WHERE company_id = 2;
```

---

## Verification Checklist

After completing all steps, verify:

- [ ] Supabase project created and active
- [ ] All 10 tables exist in database
- [ ] RLS policies enabled on all tables
- [ ] Storage bucket `erp-reports` created
- [ ] Super admin account created
- [ ] Test company with 3 users created
- [ ] Connection test successful
- [ ] API credentials saved in `.env.local`

---

## Next Steps

Once Phase 1 setup is complete:

1. **Week 2:** Build FIFO engine and data pipeline
2. **Week 3:** Build React dashboard
3. **Week 4:** Build admin panel
4. **Week 5:** Deploy to production

---

## Troubleshooting

### "Connection failed"
- Check `.env.local` has correct URL and keys
- Use SERVICE_ROLE key for backend (not anon key)
- Verify Supabase project is active

### "Permission denied" on table
- Check RLS policies are created
- Verify user has correct role
- Check company_id matches

### "Bucket not found"
- Go to Storage → Create `erp-reports` bucket
- Verify name spelling matches exactly

### Python import errors
- Run: `pip install supabase python-dotenv bcrypt openpyxl`
- Make sure you're in correct directory

---

**Phase 1 Complete! Ready for Phase 2.** 🎉

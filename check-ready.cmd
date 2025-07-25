@echo off
echo ════════════════════════════════════════
echo 🔍 Verifying .env.local variables...
echo ════════════════════════════════════════
type .env.local
echo.

echo ════════════════════════════════════════
echo 📁 Checking important project files...
echo ════════════════════════════════════════

if exist "package.json" (
  echo ✅ Found: package.json
) else (
  echo ❌ Missing: package.json
)

if exist "app\api\dashboard-data\route.ts" (
  echo ✅ Found: route.ts (dashboard-data API)
) else (
  echo ❌ Missing: route.ts (dashboard-data API)
)

if exist "supabaseClient.ts" (
  echo ✅ Found: supabaseClient.ts
) else (
  echo ❌ Missing: supabaseClient.ts
)

echo.
echo ════════════════════════════════════════
echo 📦 Checking installed packages...
echo ════════════════════════════════════════
call npm list @supabase/supabase-js
echo.

echo ════════════════════════════════════════
echo 🚀 Starting dev server...
echo ════════════════════════════════════════
call npm run dev
pause

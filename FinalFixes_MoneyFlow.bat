@echo off
setlocal enabledelayedexpansion

REM ------------------ VERIFY GIT & FILE STRUCTURE ------------------
if not exist .git (
  echo ❌ Error: You are not in a Git repository. Abort.
  exit /b 1
)

REM ------------------ 1. FIX SIGNUP REDIRECT -----------------------
if exist app\signup\page.tsx (
  echo ✅ Updating signup redirect to /pricing...
  type app\signup\page.tsx | findstr /v /c:"/dashboard" > app\signup\page.tmp
  type app\signup\page.tsx | findstr /c:"/dashboard" >> app\signup\page.tmp
  powershell -Command "(Get-Content 'app/signup/page.tmp') -replace '/dashboard','/pricing' | Set-Content 'app/signup/page.tsx'"
  del app\signup\page.tmp
) else (
  echo ⚠️ Warning: app\signup\page.tsx not found
)

REM ------------------ 2. FIX THANK-YOU DELAY -----------------------
if exist app\thank-you\page.tsx (
  echo ✅ Updating thank-you redirect delay to 5000ms...
  powershell -Command "(Get-Content 'app/thank-you/page.tsx') -replace '2000','5000' | Set-Content 'app/thank-you/page.tsx'"
) else (
  echo ⚠️ Warning: app\thank-you\page.tsx not found
)

REM ------------------ 3. SECURE DASHBOARD QUERY --------------------
if exist app\dashboard\page.tsx (
  echo ✅ Securing Supabase dashboard query with user_id filter...
  powershell -Command "(Get-Content 'app/dashboard/page.tsx') -replace \".select\\('\\*'\\)\", \".select('*').eq('user_id', user.id')\" | Set-Content 'app/dashboard/page.tsx'"
) else (
  echo ⚠️ Warning: app\dashboard\page.tsx not found
)

REM ------------------ 4. GIT COMMIT & PUSH -------------------------
echo ✅ Committing changes to Git...
git add app\signup\page.tsx app\thank-you\page.tsx app\dashboard\page.tsx
git commit -m "FinalFixes: redirect, delay, user_id filter"
git push origin main

REM ------------------ 5. DEPLOY TO VERCEL --------------------------
echo ✅ Triggering production deployment on Vercel...
vercel --prod --confirm

echo.
echo 🚀 DONE: All fixes applied and deployed to production.
pause

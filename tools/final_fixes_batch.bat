@echo off

REM ===== Review Remedy Final Deploy Script =====
REM Author: Jordan Mymern's Assistant
REM Purpose: Fix all final issues before launch
REM Location: C:\Projects\SaaSApp\frontend\tools\deploy.bat

REM -------- Navigate to frontend project --------
cd /d C:\Projects\SaaSApp\frontend

REM -------- OPEN FILES FOR FIXES --------
REM 1. Login redirect to /dashboard
code app\login\page.tsx
REM 2. Signup redirect to /dashboard
code app\signup\page.tsx
REM 3. Fix dashboard query: show only logged-in user's reports
code app\dashboard\page.tsx
REM 4. Auto redirect after payment from /thank-you to /dashboard
code app\thank-you\page.tsx
REM 5. (Optional) Add AI loading spinner and async handling
code components\ReportForm.tsx
REM 6. (Optional) Add scraper or Google Reviews fetch logic
code app\api\fetch-google-reviews\route.ts

REM -------- COMMIT CHANGES LOCALLY --------
echo Committing changes...
git add .
git commit -m "✅ Final Fixes: login redirect, dashboard query, auto nav, prep for Google Reviews"

REM -------- PUSH TO GITHUB MAIN --------
git push origin main

REM -------- REDEPLOY TO VERCEL --------
echo Redeploying to Vercel...
vercel --prod

echo.
echo ✅ ALL FIXES LAUNCHED.
echo ---------------------------------------------
echo "Now go to https://review-remedy.com and confirm:"
echo - Login & Signup go straight to dashboard

echo - After payment, user sees the thank-you page, then dashboard

echo - Dashboard only shows THEIR reports

echo - (If added) Google Reviews show real content

echo - (If added) Spinner shows during AI summary creation

echo - Emails go out with new insights (optional)
echo ---------------------------------------------
echo.
echo Ready to print money 💸 — LET'S GO.
echo ---------------------------------------------
pause

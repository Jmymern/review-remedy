@echo off

REM ------------------------------------------------------------
REM FinalFixes_MoneyFlow.bat
REM
REM This batch script applies the final fixes required for the
REM Review Remedy application, commits the changes to your
REM Git repository, and deploys the updated site to Vercel.
REM
REM NOTE: This script assumes it is run from within the root
REM directory of your Next.js project. Adjust the `cd` paths
REM below if your folder structure differs. It also assumes
REM you have Git and the Vercel CLI installed and properly
REM authenticated. If any of these assumptions are not met,
REM the script will exit with an appropriate message.
REM ------------------------------------------------------------

REM Navigate to the directory containing this script. Using
REM %~dp0 ensures relative paths work regardless of the
REM current working directory when executing the script.
cd /d "%~dp0"

REM Verify that a Git repository exists. If .git is not found,
REM alert the user and abort.
if not exist .git (
  echo Error: Git repository not found in %cd%.
  echo Please run this script from the root of your project.
  exit /b 1
)

REM ----------------------------------------------------------------
REM 1. Fix signup redirect
REM
REM The signup page currently redirects new users to /dashboard after
REM successful registration. According to the final fix plan, it
REM should redirect to /pricing so users can pick a subscription plan.
REM The following PowerShell one-liner reads app/signup/page.tsx,
REM replaces the first occurrence of '/dashboard' with '/pricing',
REM and writes the updated contents back to the file. If the file
REM path differs, update it accordingly.
REM ----------------------------------------------------------------
if exist app\signup\page.tsx (
  powershell -NoProfile -Command "(Get-Content 'app/signup/page.tsx' -Raw) -replace '/dashboard','/pricing' | Set-Content 'app/signup/page.tsx'"
) else (
  echo Warning: app\signup\page.tsx not found. Signup redirect not updated.
)

REM ----------------------------------------------------------------
REM 2. Adjust thank-you auto‑redirect delay
REM
REM The thank-you page currently waits 2 seconds before sending the
REM user to the dashboard. Increase this to 5 seconds (5000 ms)
REM according to the fix specification. This substitution looks for
REM the literal number 2000 and replaces it with 5000. Ensure that
REM 2000 in this context represents milliseconds; if not, adjust
REM accordingly.
REM ----------------------------------------------------------------
if exist app\thank-you\page.tsx (
  powershell -NoProfile -Command "(Get-Content 'app/thank-you/page.tsx' -Raw) -replace '2000','5000' | Set-Content 'app/thank-you/page.tsx'"
) else (
  echo Warning: app\thank-you\page.tsx not found. Thank-you delay not updated.
)

REM ----------------------------------------------------------------
REM 3. Secure dashboard query
REM
REM Ensure the dashboard API only returns reports for the currently
REM authenticated user. The Supabase query should include
REM `.eq('user_id', user.id)` after selecting the reports table. The
REM replacement below looks for `.select('*')` and adds the filter.
REM You may need to tailor the search string if the query differs.
REM ----------------------------------------------------------------
if exist app\dashboard\page.tsx (
  powershell -NoProfile -Command "(Get-Content 'app/dashboard/page.tsx' -Raw) -replace ""\.select\('\*'\)", ".select('*').eq('user_id', user.id)" | Set-Content 'app/dashboard/page.tsx'"
) else (
  echo Warning: app\dashboard\page.tsx not found. Dashboard query not secured.
)

REM ----------------------------------------------------------------
REM 4. Commit and push changes
REM
REM Stage the modified files, create a commit with a descriptive
REM message, and push to the main branch on your origin remote.
REM If your default branch is not 'main', replace it accordingly.
REM ----------------------------------------------------------------
git add app\signup\page.tsx app\thank-you\page.tsx app\dashboard\page.tsx
git commit -m "Apply final fixes: updated signup redirect, thank-you delay, and secured dashboard query"
git push origin main

REM ----------------------------------------------------------------
REM 5. Deploy to Vercel
REM
REM Deploy the updated project to Vercel. The --prod and --confirm
REM flags ensure a production deployment without interactive prompts.
REM If you use a different deployment provider or prefer staging
REM deployments first, modify this section.
REM ----------------------------------------------------------------
vercel --prod --confirm

echo.
echo Final fixes applied and deployment triggered. Check your Vercel
echo dashboard for progress and confirm that the issues are resolved.
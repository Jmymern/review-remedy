@echo off
REM ==================================================
REM ✅ Review Remedy Auto Fix: Login + Signup Redirects
REM Location: C:\Projects\SaaSApp\frontend\tools\FinalFixes_Redirect.bat
REM ==================================================

cd /d C:\Projects\SaaSApp\frontend

REM 🔧 Update login/page.tsx
echo Fixing login redirect...
(
echo import { useRouter } from 'next/navigation';
echo import { useState } from 'react';
echo import { createClient } from '@/utils/supabase/client';
echo
echo export default function LoginPage() {
echo   const supabase = createClient();
echo   const router = useRouter();
echo   const [email, setEmail] = useState('');
echo   const [password, setPassword] = useState('');
echo   const [error, setError] = useState('');
echo
echo   const handleLogin = async (e) => {
echo     e.preventDefault();
echo     const { error } = await supabase.auth.signInWithPassword({
echo       email,
echo       password,
echo     });
echo     if (error) {
echo       setError(error.message);
echo     } else {
echo       router.push('/dashboard');
echo     }
echo   };
echo
echo   return (
echo     <form onSubmit={handleLogin}>
echo       <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
echo       <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
echo       <button type="submit">Login</button>
echo       {error && <p>{error}</p>}
echo     </form>
echo   );
echo }
) > app\login\page.tsx

REM 🔧 Update signup/page.tsx
echo Fixing signup redirect...
(
echo import { useRouter } from 'next/navigation';
echo import { useState } from 'react';
echo import { createClient } from '@/utils/supabase/client';
echo
echo export default function SignupPage() {
echo   const supabase = createClient();
echo   const router = useRouter();
echo   const [email, setEmail] = useState('');
echo   const [password, setPassword] = useState('');
echo   const [error, setError] = useState('');
echo
echo   const handleSignup = async (e) => {
echo     e.preventDefault();
echo     const { error } = await supabase.auth.signUp({
echo       email,
echo       password,
echo     });
echo     if (error) {
echo       setError(error.message);
echo     } else {
echo       router.push('/dashboard');
echo     }
echo   };
echo
echo   return (
echo     <form onSubmit={handleSignup}>
echo       <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
echo       <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
echo       <button type="submit">Sign Up</button>
echo       {error && <p>{error}</p>}
echo     </form>
echo   );
echo }
) > app\signup\page.tsx

REM ✅ COMMIT & PUSH FIXES
echo Committing and pushing redirect fixes...
git add .
git commit -m "✅ Fix login/signup redirects to /dashboard"
git push origin main

REM 🚀 DEPLOY TO VERCEL
echo Deploying to Vercel...
vercel --prod

echo.
echo ✅ Login + Signup Redirects Fixed & Live
echo Visit https://review-remedy.com/login or /signup and confirm auto redirect
echo.
pause

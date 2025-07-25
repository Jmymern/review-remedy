import 'dotenv/config'; // Load .env
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("🔍 Verifying environment variables...");

if (!url || !key) {
  console.error("❌ Missing Supabase environment variables. Check your .env.local file.");
  console.error("URL:", url);
  console.error("Key present:", !!key);
  process.exit(1);
}

console.log("✅ Environment variables loaded.");

const supabase = createClient(url, key);

console.log("🔌 Connecting to Supabase...");

(async () => {
  try {
    const { data, error } = await supabase.from('reviews').select('*').limit(1);

    if (error) {
      console.error("❌ Supabase error:", error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.warn("⚠️ Supabase connected, but 'reviews' table is empty.");
    } else {
      console.log("✅ Supabase is working. Sample data:");
      console.log(data[0]);
    }

    process.exit(0);
  } catch (err: any) {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  }
})();

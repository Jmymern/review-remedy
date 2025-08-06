import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchReports = async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", user.id)
        .single();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (!profile?.business_id) {
        setError("No business ID found for this user");
        setLoading(false);
        return;
      }

      supabase
        .from("reports")
        .select("id, created_at, summary")
        .eq("business_id", profile.business_id)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) setError(error.message);
          else setReports(data || []);
          setLoading(false);
        });
    };

    fetchReports();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Your AI Reports</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">{new Date(report.created_at).toLocaleDateString()}</p>
              <p className="mt-2">{report.summary}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

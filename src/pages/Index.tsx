import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in and redirect accordingly
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      } else {
        navigate("/auth");
      }
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-subtle">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="h-16 w-16 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow animate-pulse">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
        </div>
        <p className="text-muted-foreground">Loading EchoLead...</p>
      </div>
    </div>
  );
};

export default Index;

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");

      if (code && (state === "gmail_integration" || state === "microsoft365_integration")) {
        try {
          const provider = state === "gmail_integration" ? "gmail" : "microsoft365";
          const { error } = await supabase.functions.invoke("handle-oauth", {
            body: { code, provider },
          });

          if (error) throw error;

          toast({
            title: `${provider === "gmail" ? "Gmail" : "Microsoft 365"} connected`,
            description: `Your ${provider === "gmail" ? "Gmail" : "Microsoft 365"} account has been successfully connected.`,
          });

          navigate("/settings/integrations");
        } catch (error: any) {
          toast({
            title: "Connection failed",
            description: error.message,
            variant: "destructive",
          });
          navigate("/settings/integrations");
        }
      } else {
        navigate("/dashboard");
      }
    };

    handleOAuthCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Processing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
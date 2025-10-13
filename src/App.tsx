import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { AuthGuard } from "./components/AuthGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Campaigns from "./pages/Campaigns";
import Settings from "./pages/Settings";
import Integrations from "./pages/settings/Integrations";
import Billing from "./pages/settings/Billing";
import Team from "./pages/settings/Team";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/*"
            element={
              <AuthGuard>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col">
                      <header className="h-12 flex items-center border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 px-4">
                        <SidebarTrigger />
                      </header>
                      <main className="flex-1 bg-gradient-subtle">
                        <Routes>
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/leads" element={<Leads />} />
                          <Route path="/campaigns" element={<Campaigns />} />
                          <Route path="/settings" element={<Settings />}>
                            <Route index element={<Navigate to="/settings/integrations" replace />} />
                            <Route path="integrations" element={<Integrations />} />
                            <Route path="billing" element={<Billing />} />
                            <Route path="team" element={<Team />} />
                          </Route>
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </main>
                    </div>
                  </div>
                </SidebarProvider>
              </AuthGuard>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

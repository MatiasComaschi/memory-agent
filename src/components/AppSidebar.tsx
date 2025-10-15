import { NavLink } from "react-router-dom";
import {
  Sparkles,
  Users,
  Upload,
  Megaphone,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Import", url: "/import", icon: Upload },
  { title: "Campaigns", url: "/campaigns", icon: Megaphone },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        {/* Logo */}
        <div className="p-4 flex items-center gap-2 border-b">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent group-data-[collapsible=icon]:hidden">
            EchoLead
          </h1>
        </div>

        <SidebarGroup className="pt-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavLink
                    to={item.url}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-md transition-all ${
                        isActive
                          ? "bg-accent text-gray-900 font-medium"
                          : "text-gray-900 hover:bg-accent/50 hover:text-gray-900"
                      }`
                    }
                    style={{ color: '#111827' }}
                  >
                    <item.icon className="h-5 w-5" style={{ color: '#111827' }} />
                    <span style={{ color: '#111827' }}>{item.title}</span>
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

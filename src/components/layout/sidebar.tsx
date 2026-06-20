"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ChevronDown,
  FileText,
  GitBranch,
  LayoutDashboard,
  Link2,
  LogOut,
  Settings,
  Shield,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenant } from "@/lib/tenant/context";
import { useAuth } from "@/lib/auth/context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Menu } from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Cash Forecast", href: "/cash-forecast", icon: Wallet },
  { name: "Financials", href: "/financials", icon: BarChart3 },
  { name: "Sales Pipeline", href: "/sales-pipeline", icon: Target },
  { name: "Operations", href: "/operations", icon: Wrench },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Scenarios", href: "/scenarios", icon: GitBranch },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle },
  { name: "Integrations", href: "/integrations", icon: Link2 },
  { name: "Team", href: "/team", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Admin", href: "/admin", icon: Shield },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isDemoMode } = useAuth();
  const visibleNav = navigation.filter((item) => !(isDemoMode && item.href === "/admin"));

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card lg:flex">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <TrendingUp className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">Growth Command</p>
          <p className="text-xs text-muted-foreground">Center</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {visibleNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const { isDemoMode } = useAuth();
  const visibleNav = navigation.filter((item) => !(isDemoMode && item.href === "/admin"));
  const primaryNav = visibleNav.slice(0, 5);
  const moreNav = visibleNav.slice(5);

  return (
    <nav className="flex items-center gap-1 border-b bg-card p-2 lg:hidden">
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {primaryNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.name}
            </Link>
          );
        })}
      </div>
      {moreNav.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium text-muted-foreground">
            <Menu className="h-3.5 w-3.5" />
            More
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            {moreNav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <DropdownMenuItem key={item.name} asChild>
                  <Link href={item.href} className={cn(isActive && "font-semibold text-primary")}>
                    <item.icon className="mr-2 h-3.5 w-3.5" />
                    {item.name}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  );
}

export function Header() {
  const { organization, user, organizations, switchOrganization } = useTenant();
  const { signOut, isDemoMode } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-8">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{organization.name}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {organizations.map((org) => (
            <DropdownMenuItem key={org.id} onClick={() => switchOrganization(org.id)}>
              {org.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center gap-3">
        {isDemoMode && (
          <span className="hidden rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning sm:inline">
            Demo Mode
          </span>
        )}
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 rounded-lg hover:bg-accent p-1">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs capitalize text-muted-foreground">{user.role.replace("_", " ")}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

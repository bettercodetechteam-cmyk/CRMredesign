import React, { useMemo, useCallback, useEffect, useState } from "react";
// Forced update for stale cache
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Users,
  Phone,
  FileText,
  BarChart2,
  Calendar,
  BookOpen,
  DollarSign,
  Target,
  ClipboardList,
  UserPlus,
  School,
  Building2,
  Bell,
  User,
  TrendingUp,
  Clock,
  Database,
  Activity,
  UserCog,
  CreditCard,
  Crown,
  Layers,
  Package,
  Megaphone,
  UserCheck,
  Shield,
  CheckSquare,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigationLoading } from "@/contexts/NavigationLoadingContext";
import { useApprovalNotifications } from "@/hooks/useApprovalNotifications";
import type { ModulePermission } from "@shared/permissions";
import Logo from "../assets/Zica Zima.jpg";
import QuotaMonitor from "./QuotaMonitor";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function Sidebar({ open, onOpenChange }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { isDirector, permissions } = usePermissions();
  const { pendingCount } = useApprovalNotifications();
  const { startNavigation } = useNavigationLoading();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Check if dialog is open and update state
  useEffect(() => {
    const checkDialog = () => {
      const hasDialogClass = document.body.classList.contains('dialog-open');
      setDialogOpen(hasDialogClass);
    };
    
    // Check initially
    checkDialog();
    
    // Watch for changes using MutationObserver
    const observer = new MutationObserver(() => {
      checkDialog();
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  // Debug logging and mobile body scroll management
  useEffect(() => {
    if (open && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  // Memoize navItems to prevent recreation on every render
  const navItems = useMemo(() => [
    { href: "/", label: "Dashboard", icon: BarChart2, permission: "dashboard" as ModulePermission },
    { href: "/leads", label: "Leads", icon: UserPlus, permission: "leads" as ModulePermission },
    { href: "/students", label: "Students", icon: Users, permission: "students" as ModulePermission },
    { href: "/enhanced-fee-management", label: "Fee Management", icon: DollarSign, permission: "fees" as ModulePermission },
    { href: "/batches", label: "Batches", icon: Layers, permission: "batches" as ModulePermission },
    { href: "/royalty", label: "Royalty", icon: Crown, permission: "fees" as ModulePermission },
    { href: "/expenses", label: "Expenses", icon: CreditCard, permission: "expenses" as ModulePermission },
    { href: "/user-approvals", label: "User Approvals", icon: UserCheck, permission: "user_approvals" as ModulePermission },
    { href: "/access-management", label: "Access Management", icon: Shield, permission: "access_management" as ModulePermission },
    { href: "/staff", label: "Staff Management", icon: UserCog, permission: "staff" as ModulePermission },
    { href: "/tasks", label: "Task Management", icon: CheckSquare, permission: "tasks" as ModulePermission },
    { href: "/academics", label: "Academics", icon: School, permission: "academics" as ModulePermission },
    { href: "/assets", label: "Assets", icon: Package, permission: "assets" as ModulePermission },
    { href: "/promotional-offers", label: "Promotional Offers", icon: Megaphone, permission: "promotional_offers" as ModulePermission },
    { href: "/blogs", label: "Blog Management", icon: FileText, permission: "blogs" as ModulePermission },
    { href: "/profile", label: "Profile", icon: User, permission: "profile" as ModulePermission },
  ], [pendingCount]);

  const filteredNavItems = useMemo(
    () => navItems.filter((item) => permissions.includes(item.permission)),
    [navItems, permissions]
  );

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    }
  }

  return (
    <>
      <TooltipProvider delayDuration={300}>
        {/* Mobile & Desktop Sidebar */}
        <div 
          data-sidebar="true"
          className={cn(
            "fixed top-0 left-0 bottom-0 bg-gradient-to-b from-white via-gray-50/50 to-white border-r border-gray-200/60 shadow-xl backdrop-blur-sm transition-all duration-300 ease-in-out",
            // Width controls
            open ? "w-64" : "w-16 lg:w-20",
            // Z-index: Lower when dialog is open to ensure dialog appears above
            dialogOpen ? "z-30" : (open ? "z-[60]" : "z-50 lg:z-50"),
            // Desktop positioning - always visible on large screens  
            "lg:translate-x-0",
            // Mobile positioning - slide in/out
            // When dialog is open, always hide sidebar
            dialogOpen 
              ? "-translate-x-full opacity-0 pointer-events-none invisible" 
              : (open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"),
            // Add enhanced visual effects
            "hover:shadow-2xl transition-shadow duration-300",
          )}
        >
          {/* Toggle Button - Responsive positioning */}
          {/* Toggle Button - Hidden as per request for always-closed view */}
          {/* <button
            onClick={() => onOpenChange(!open)}
            className={cn(
              "absolute -right-3 top-12 bg-white border border-gray-200 rounded-full p-1.5 hover:bg-gray-50 hover:shadow-md transition-all duration-150 shadow-sm",
              "hidden lg:block xl:block",
              open ? "xl:-right-3" : "xl:-right-2.5"
            )}
            aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          >
            {open ? (
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </button> */}

          {/* Header */}
          <div className="p-2 xs:p-3 sm:p-4 border-b border-gray-200/60">
            <div className={cn("flex items-center", open ? "space-x-2 xs:space-x-3" : "justify-center")}>
              <div className="w-8 h-8 xs:w-10 xs:h-10 rounded-lg overflow-hidden bg-white shadow-sm border border-gray-200 flex-shrink-0">
                <img
                  src={Logo}
                  alt="ZICA Logo"
                  className="object-contain w-full h-full rounded-lg"
                />
              </div>
              {open && (
                <div className="animate-in slide-in-from-left-2 duration-200 min-w-0 flex-1">
                  <h1 className="text-xs xs:text-sm sm:text-base font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent leading-tight truncate">
                    ZICA, PCMC CRM
                  </h1>
                  <p className="text-[10px] xs:text-xs text-gray-500 font-medium mt-0.5 truncate">
                    Animation Institute
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto h-[calc(100vh-140px)] xs:h-[calc(100vh-150px)] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            <nav className="p-2 xs:p-3 sm:p-4 space-y-1 xs:space-y-1.5">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;

                const handleClick = useCallback((e: React.MouseEvent) => {
                  e.preventDefault();
                  if (location.pathname !== item.href) {
                    startNavigation();
                  }
                  navigate(item.href);
                  if (window.innerWidth < 1024) {
                    onOpenChange(false);
                  }
                }, [navigate, item.href, onOpenChange, location.pathname, startNavigation]);

                const linkContent = (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={handleClick}
                    className={cn(
                      "flex items-center rounded-xl text-xs xs:text-sm font-medium transition-all duration-300 group relative overflow-hidden touch-target hover:scale-105",
                      open ? "space-x-2 xs:space-x-3 px-2 xs:px-3 py-2 xs:py-2.5" : "justify-center px-2 py-2.5",
                      isActive
                        ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg hover:shadow-xl"
                        : "text-gray-700 hover:bg-gradient-to-r hover:from-gray-100 hover:to-blue-50 hover:text-gray-900 hover:shadow-md"
                    )}
                  >
                    <div className="relative flex-shrink-0 z-10">
                      <Icon className={cn(
                        "w-4 h-4 xs:w-5 xs:h-5 transition-all duration-300",
                        isActive ? "text-white" : "text-gray-500 group-hover:text-blue-600"
                      )} />
                      {/* Pending signup approval badge */}
                      {item.href === "/user-approvals" && pendingCount > 0 && (
                        <div className={cn(
                          "absolute -top-1 -right-1 bg-red-500 text-white text-[10px] xs:text-xs rounded-full flex items-center justify-center font-bold animate-pulse shadow-lg",
                          open ? "w-4 h-4 xs:w-5 xs:h-5" : "w-3 h-3 xs:w-4 xs:h-4"
                        )}>
                          {pendingCount > 99 ? "99+" : pendingCount}
                        </div>
                      )}
                    </div>
                    {open && (
                      <span className="animate-in slide-in-from-left-2 duration-200 truncate min-w-0 flex-1">
                        {item.label}
                      </span>
                    )}
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl pointer-events-none" aria-hidden />
                    )}
                  </Link>
                );

                // Show tooltip only when sidebar is collapsed
                if (!open) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        {linkContent}
                      </TooltipTrigger>
                      <TooltipContent 
                        side="right" 
                        align="center"
                        className="bg-gradient-to-r from-gray-900 to-gray-800 text-white border-gray-700 shadow-xl rounded-xl px-4 py-2.5 font-medium text-sm"
                        sideOffset={10}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return linkContent;
              })}
            </nav>
          </div>

          {/* User Info - full when expanded, icon-only when collapsed */}
          {userProfile && (
            <>
              {!open ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="border-t border-gray-200/60 p-2 flex justify-center">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        <span>{userProfile.firstName?.charAt(0) || userProfile.email?.charAt(0) || 'U'}</span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center" className="bg-gradient-to-r from-gray-900 to-gray-800 text-white border-gray-700 shadow-xl rounded-xl px-4 py-2.5 font-medium text-sm" sideOffset={10}>
                    <div className="flex flex-col gap-0.5">
                      <span>{userProfile.firstName} {userProfile.lastName}</span>
                      <span className="text-gray-400 text-xs capitalize">{userProfile.role?.replace('_', ' ')}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="p-2 xs:p-3 sm:p-4 border-t border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-blue-50/50">
                  <div className="flex items-center space-x-2 xs:space-x-3">
                    <div className="w-7 h-7 xs:w-8 xs:h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs xs:text-sm font-semibold">
                        {userProfile.firstName?.charAt(0) || userProfile.email?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs xs:text-sm font-medium text-gray-900 truncate">
                        {userProfile.firstName} {userProfile.lastName}
                      </p>
                      <p className="text-[10px] xs:text-xs text-gray-500 capitalize truncate">
                        {userProfile.role?.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </TooltipProvider>

      {/* Quota Monitor - Only show for directors and centre heads */}
      {isDirector && (
        <div className="p-4 border-t border-gray-200">
          <QuotaMonitor compact={true} />
        </div>
      )}

      {/* Mobile Overlay - Only shows on mobile when sidebar is open and no dialog is open */}
      {open && !dialogOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => {
            onOpenChange(false);
          }}
          aria-hidden="true"
          style={{
            // Ensure overlay is always properly positioned on mobile
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 55,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)'
          }}
        />
      )}
    </>
  );
}
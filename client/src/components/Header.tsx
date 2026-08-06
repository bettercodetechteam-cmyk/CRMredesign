import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Menu, Bell, User, LogOut, Settings, HelpCircle, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { TaskNotificationBell } from "@/components/tasks/TaskNotificationBell";

interface HeaderProps {
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
}

export default function Header({ sidebarOpen, onSidebarOpenChange }: HeaderProps) {
  const { userProfile, signOut } = useAuth();
  const navigate = useAppNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <header className={`fixed top-0 right-0 z-[70] bg-white/95 backdrop-blur-md border-b border-gray-200/60 transition-all duration-300 ease-in-out shadow-sm hover:shadow-md ${
      sidebarOpen ? 'lg:left-64 xl:left-64' : 'lg:left-20 xl:left-20'
    } left-0`}>
      <div className="flex items-center justify-between px-3 xs:px-4 sm:px-6 lg:px-8 py-1.5 xs:py-2 sm:py-2.5">
        {/* Debug info - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed top-16 left-2 bg-red-100 text-red-800 p-2 rounded text-xs z-[70] lg:hidden">
            <div>Sidebar: {sidebarOpen ? 'OPEN' : 'CLOSED'}</div>
            <div>Screen: {typeof window !== 'undefined' ? window.innerWidth : 'N/A'}px</div>
          </div>
        )}
        
        {/* Left side - Mobile menu button and title */}
        <div className="flex items-center space-x-2 xs:space-x-3 sm:space-x-4 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              console.log('🍔 Hamburger menu clicked, current sidebar state:', sidebarOpen);
              console.log('📱 Current window width:', window.innerWidth);
              console.log('📱 Is mobile device:', window.innerWidth < 1024);
              onSidebarOpenChange(!sidebarOpen);
              console.log('🍔 Hamburger menu clicked, new sidebar state will be:', !sidebarOpen);
              
              // Force feedback for mobile testing
              if (window.innerWidth < 1024) {
                console.log('📱 Mobile hamburger interaction detected');
                // Add haptic feedback on mobile devices that support it
                if ('vibrate' in navigator) {
                  navigator.vibrate(50);
                }
              }
            }}
            className={cn(
              "lg:hidden p-2 rounded-lg transition-all duration-200 touch-target hover:scale-105 shadow-sm hover:shadow-md",
              sidebarOpen 
                ? "bg-blue-100 hover:bg-blue-200 text-blue-600 ring-2 ring-blue-300" 
                : "hover:bg-gray-100 active:bg-gray-200 ring-1 ring-gray-200 hover:ring-gray-300"
            )}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <Menu className={cn(
              "w-5 h-5 transition-all duration-200",
              sidebarOpen ? "rotate-90 text-blue-600" : "hover:rotate-90"
            )} />
          </Button>
          
          {/* Mobile title - responsive sizing */}
          <div className="lg:hidden min-w-0 flex-1">
            <h1 className="text-base xs:text-lg sm:text-xl font-semibold text-gray-900 truncate">
              ZICA CRM
            </h1>
          </div>
          
          {/* Desktop title - shown when sidebar is collapsed */}
          <div className="hidden lg:block">
            {!sidebarOpen && (
              <h1 className="text-lg xl:text-xl font-semibold text-gray-900">
                ZICA CRM
              </h1>
            )}
          </div>
        </div>

        {/* Right side - Notifications & User Menu */}
        <div className="flex items-center space-x-2 xs:space-x-3 flex-shrink-0">
          <TaskNotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center space-x-2 xs:space-x-3 p-2 xs:p-3 hover:bg-gray-100 rounded-lg transition-colors touch-target"
              >
                <div className="w-8 h-8 xs:w-9 xs:h-9 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm flex-shrink-0">
                  {userProfile?.firstName?.charAt(0) || userProfile?.lastName?.charAt(0) || "U"}
                </div>
                <div className="hidden xs:block text-left min-w-0">
                  <span className="text-sm font-medium text-gray-900 block truncate max-w-[100px] sm:max-w-[120px]">
                    {userProfile?.firstName} {userProfile?.lastName}
                  </span>
                  <span className="text-xs text-gray-500 capitalize block truncate max-w-[100px] sm:max-w-[120px]">
                    {userProfile?.role?.replace('_', ' ')}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 xs:w-64 sm:w-72">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {userProfile?.firstName} {userProfile?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{userProfile?.email}</p>
                  <p className="text-xs text-gray-500 capitalize">{userProfile?.role?.replace('_', ' ')}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => navigate("/profile")}
                className="cursor-pointer hover:bg-gray-50 focus:bg-gray-50"
              >
                <User className="w-4 h-4 mr-3" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => navigate("/settings")}
                className="cursor-pointer hover:bg-gray-50 focus:bg-gray-50"
              >
                <Settings className="w-4 h-4 mr-3" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleSignOut} 
                className="text-red-600 cursor-pointer hover:bg-red-50 focus:bg-red-50"
              >
                <LogOut className="w-4 h-4 mr-3" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
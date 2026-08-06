import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, EyeOff, Lock } from "lucide-react";
import { StaffMember } from "@/lib/types";

interface PasswordViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMember: StaffMember | null;
  onPasswordReset: (staff: StaffMember) => void;
}

export default function PasswordViewDialog({
  open,
  onOpenChange,
  staffMember,
  onPasswordReset
}: PasswordViewDialogProps) {
  const [showPassword, setShowPassword] = useState(false);

  if (!staffMember) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Staff Password</DialogTitle>
          <DialogDescription>
            View password for {staffMember.firstName} {staffMember.lastName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Password:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <div className="mt-2">
              {showPassword ? (
                <code className="text-sm bg-background px-2 py-1 rounded">
                  {staffMember.password || 'Password not available'}
                </code>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Click to reveal password
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                onPasswordReset(staffMember);
                onOpenChange(false);
              }}
            >
              <Lock className="w-4 h-4 mr-2" />
              Reset Password
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

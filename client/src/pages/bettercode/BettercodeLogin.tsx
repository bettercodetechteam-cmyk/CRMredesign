import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import NotificationPopup from "@/components/NotificationPopup";
import bettercodeLogo from "@/assets/abettercode logo updated.png";

export default function BettercodeLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info" | "warning";
    title: string;
    message: string;
    isVisible: boolean;
  }>({
    type: "info",
    title: "",
    message: "",
    isVisible: false,
  });

  const navigate = useNavigate();
  const { signIn } = useAuth();

  const showNotification = (
    type: "success" | "error" | "info" | "warning",
    title: string,
    message: string
  ) => {
    setNotification({ type, title, message, isVisible: true });
  };

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, isVisible: false }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    try {
      await signIn(email, password);
      showNotification("success", "Welcome", "Signed in to Bettercode");
      setTimeout(() => navigate("/bettercode/dashboard"), 800);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Invalid email or password";
      showNotification("error", "Sign in failed", message);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col overflow-hidden relative">
      <NotificationPopup
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
        autoClose={true}
        autoCloseDelay={5000}
      />

      {/* Logo top left on all Bettercode pages */}
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-black/90 backdrop-blur-sm shrink-0">
        <div className="flex items-center px-4 sm:px-6 h-14">
          <img
            src={bettercodeLogo}
            alt="a-bettercode"
            className="h-9 w-auto object-contain"
          />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xs sm:max-w-md space-y-4 relative z-10">
          <div className="text-center space-y-3">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Bettercode
            </h1>
            <p className="text-neutral-400 text-sm mt-1">
              Sign in to access your dashboard
            </p>
          </div>

          <div className="bg-neutral-900/80 backdrop-blur-sm rounded-2xl border border-neutral-700/50 shadow-xl overflow-hidden">
            <div className="px-5 sm:px-6 py-5 sm:py-6">
              <h2 className="text-lg font-semibold text-white mb-1">
                Welcome back
              </h2>
              <p className="text-neutral-400 text-sm mb-5">
                Sign in to access your dashboard
              </p>

              <form onSubmit={handleLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="bettercode-email"
                    className="text-sm font-medium text-neutral-300"
                  >
                  Email
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      id="bettercode-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="pl-10 h-10 bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500 focus:border-orange-500 focus:ring-orange-500/20 rounded-lg"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="bettercode-password"
                    className="text-sm font-medium text-neutral-300"
                  >
                    Password
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 group-focus-within:text-orange-500 transition-colors" />
                    <Input
                      id="bettercode-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pl-10 pr-10 h-10 bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500 focus:border-orange-500 focus:ring-orange-500/20 rounded-lg"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 p-1 rounded"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSigningIn}
                  className="w-full h-10 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg border-0 shadow-lg"
                >
                  {isSigningIn ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-neutral-500">
                Use the same credentials as ZICA CRM
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-neutral-600">
            © Bettercode. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

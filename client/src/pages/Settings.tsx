import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Loading from "@/components/ui/loading";
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield, 
  Building, 
  Palette,
  Save,
  Download,
  Upload,
  Database,
  Mail,
  Phone,
  Globe
} from "lucide-react";
import FirebaseStatus from "@/components/FirebaseStatus";

interface CentreSettings {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo: string;
  timezone: string;
  currency: string;
  language: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  feeReminders: boolean;
  assignmentDue: boolean;
  marketingEmails: boolean;
}

interface SystemSettings {
  backupFrequency: string;
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordExpiry: number;
  twoFactorAuth: boolean;
  maintenanceMode: boolean;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState("centre");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: centreSettings, isLoading: centreLoading } = useQuery<CentreSettings>({
    queryKey: ['/api/settings/centre'],
  });

  const { data: notificationSettings, isLoading: notificationLoading } = useQuery<NotificationSettings>({
    queryKey: ['/api/settings/notifications'],
  });

  const { data: systemSettings, isLoading: systemLoading } = useQuery<SystemSettings>({
    queryKey: ['/api/settings/system'],
  });

  const { register: registerCentre, handleSubmit: handleCentreSubmit, setValue: setCentreValue } = useForm<CentreSettings>();
  const { register: registerNotification, handleSubmit: handleNotificationSubmit, setValue: setNotificationValue, watch: watchNotification } = useForm<NotificationSettings>();
  const { register: registerSystem, handleSubmit: handleSystemSubmit, setValue: setSystemValue, watch: watchSystem } = useForm<SystemSettings>();

  const updateCentreMutation = useMutation({
    mutationFn: (data: CentreSettings) => apiRequest("PUT", "/api/settings/centre", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/centre'] });
      toast({ title: "Success", description: "Centre settings updated successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update centre settings", variant: "destructive" });
    }
  });

  const updateNotificationMutation = useMutation({
    mutationFn: (data: NotificationSettings) => apiRequest("PUT", "/api/settings/notifications", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/notifications'] });
      toast({ title: "Success", description: "Notification settings updated successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update notification settings", variant: "destructive" });
    }
  });

  const updateSystemMutation = useMutation({
    mutationFn: (data: SystemSettings) => apiRequest("PUT", "/api/settings/system", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/system'] });
      toast({ title: "Success", description: "System settings updated successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update system settings", variant: "destructive" });
    }
  });

  const exportSettings = () => {
    const settingsData = {
      centre: centreSettings,
      notifications: notificationSettings,
      system: systemSettings,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(settingsData, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `settings-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({ title: "Success", description: "Settings exported successfully!" });
  };

  const tabs = [
    { id: "centre", label: "Centre Info", icon: Building },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "system", label: "System", icon: Shield },
    { id: "backup", label: "Backup", icon: Database }
  ];

  if (centreLoading || notificationLoading || systemLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="md" color="primary" text="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your application settings and preferences</p>
        </div>
        <Button onClick={exportSettings} variant="outline" className="w-full sm:w-auto">
          <Download className="w-4 h-4 mr-2" />
          Export Settings
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Settings Navigation */}
        <div className="lg:w-64">
          <Card>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg transition-colors ${
                        activeTab === tab.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          {activeTab === "centre" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building className="w-5 h-5" />
                  <span>Centre Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCentreSubmit((data) => updateCentreMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Centre Name</Label>
                      <Input 
                        id="name" 
                        {...registerCentre("name")} 
                        defaultValue={centreSettings?.name}
                        placeholder="Zica, PCMC Animation Institute"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input 
                        id="phone" 
                        {...registerCentre("phone")} 
                        defaultValue={centreSettings?.phone}
                        placeholder="+91 9876543210"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        {...registerCentre("email")} 
                        defaultValue={centreSettings?.email}
                        placeholder="info@zicapcmc.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input 
                        id="website" 
                        {...registerCentre("website")} 
                        defaultValue={centreSettings?.website}
                        placeholder="https://zicapcmc.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea 
                      id="address" 
                      {...registerCentre("address")} 
                      defaultValue={centreSettings?.address}
                      placeholder="Complete address with city, state, and pincode"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select onValueChange={(value) => setCentreValue("timezone", value)} defaultValue={centreSettings?.timezone}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                          <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select onValueChange={(value) => setCentreValue("currency", value)} defaultValue={centreSettings?.currency}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                          <SelectItem value="USD">US Dollar ($)</SelectItem>
                          <SelectItem value="EUR">Euro (€)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <Select onValueChange={(value) => setCentreValue("language", value)} defaultValue={centreSettings?.language}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="hi">Hindi</SelectItem>
                          <SelectItem value="mr">Marathi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button type="submit" disabled={updateCentreMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Centre Settings
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="w-5 h-5" />
                  <span>Notification Preferences</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleNotificationSubmit((data) => updateNotificationMutation.mutate(data))} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Communication Channels</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Email Notifications</Label>
                          <p className="text-sm text-gray-600">Receive notifications via email</p>
                        </div>
                        <Switch 
                          defaultChecked={notificationSettings?.emailNotifications}
                          onCheckedChange={(checked) => setNotificationValue("emailNotifications", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>SMS Notifications</Label>
                          <p className="text-sm text-gray-600">Receive notifications via SMS</p>
                        </div>
                        <Switch 
                          defaultChecked={notificationSettings?.smsNotifications}
                          onCheckedChange={(checked) => setNotificationValue("smsNotifications", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Push Notifications</Label>
                          <p className="text-sm text-gray-600">Receive browser push notifications</p>
                        </div>
                        <Switch 
                          defaultChecked={notificationSettings?.pushNotifications}
                          onCheckedChange={(checked) => setNotificationValue("pushNotifications", checked)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Event Notifications</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Fee Reminders</Label>
                          <p className="text-sm text-gray-600">Notify about pending fee payments</p>
                        </div>
                        <Switch 
                          defaultChecked={notificationSettings?.feeReminders}
                          onCheckedChange={(checked) => setNotificationValue("feeReminders", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Assignment Due</Label>
                          <p className="text-sm text-gray-600">Notify about upcoming assignment deadlines</p>
                        </div>
                        <Switch 
                          defaultChecked={notificationSettings?.assignmentDue}
                          onCheckedChange={(checked) => setNotificationValue("assignmentDue", checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Marketing Emails</Label>
                          <p className="text-sm text-gray-600">Receive promotional and marketing emails</p>
                        </div>
                        <Switch 
                          defaultChecked={notificationSettings?.marketingEmails}
                          onCheckedChange={(checked) => setNotificationValue("marketingEmails", checked)}
                        />
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={updateNotificationMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Notification Settings
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {activeTab === "system" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>System Configuration</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSystemSubmit((data) => updateSystemMutation.mutate(data))} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Security Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                        <Input 
                          id="sessionTimeout" 
                          type="number" 
                          {...registerSystem("sessionTimeout")} 
                          defaultValue={systemSettings?.sessionTimeout}
                          placeholder="30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                        <Input 
                          id="maxLoginAttempts" 
                          type="number" 
                          {...registerSystem("maxLoginAttempts")} 
                          defaultValue={systemSettings?.maxLoginAttempts}
                          placeholder="5"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="passwordExpiry">Password Expiry (days)</Label>
                      <Input 
                        id="passwordExpiry" 
                        type="number" 
                        {...registerSystem("passwordExpiry")} 
                        defaultValue={systemSettings?.passwordExpiry}
                        placeholder="90"
                        className="max-w-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Two-Factor Authentication</Label>
                        <p className="text-sm text-gray-600">Require 2FA for all user accounts</p>
                      </div>
                      <Switch 
                        defaultChecked={systemSettings?.twoFactorAuth}
                        onCheckedChange={(checked) => setSystemValue("twoFactorAuth", checked)}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Backup & Maintenance</h3>
                    <div className="space-y-2">
                      <Label htmlFor="backupFrequency">Backup Frequency</Label>
                      <Select onValueChange={(value) => setSystemValue("backupFrequency", value)} defaultValue={systemSettings?.backupFrequency}>
                        <SelectTrigger className="max-w-xs">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Maintenance Mode</Label>
                        <p className="text-sm text-gray-600">Enable maintenance mode for system updates</p>
                      </div>
                      <Switch 
                        defaultChecked={systemSettings?.maintenanceMode}
                        onCheckedChange={(checked) => setSystemValue("maintenanceMode", checked)}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={updateSystemMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    Save System Settings
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {activeTab === "backup" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="w-5 h-5" />
                  <span>Backup & Restore</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Data Backup</h3>
                  <p className="text-gray-600">Export your application data and settings for backup purposes.</p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button onClick={exportSettings} variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Export Settings
                    </Button>

                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Data Restore</h3>
                  <p className="text-gray-600">Restore settings and data from a previously exported backup file.</p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      Import Settings
                    </Button>
                    <Button variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      Import Data
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Automatic Backups</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Last Backup</span>
                      <span className="text-sm text-gray-600">2 hours ago</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Next Backup</span>
                      <span className="text-sm text-gray-600">In 22 hours</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Backup Status</span>
                      <span className="text-sm text-green-600">Active</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
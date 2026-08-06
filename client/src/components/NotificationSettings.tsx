import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { notificationService, NotificationSettings } from '@/lib/notificationService';
import { 
  Bell, 
  Settings, 
  Clock, 
  Calendar,
  MessageSquare,
  Phone,
  AlertTriangle,
  CheckCircle,
  Info,
  Save,
  RefreshCw,
  Trash2,
  Plus,
  Edit,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Zap,
  Shield,
  User,
  Mail,
  Smartphone
} from 'lucide-react';

const NotificationSettingsComponent = () => {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (!userProfile?.centreId || !userProfile?.uid) return;

    notificationService.init(userProfile.centreId, userProfile.uid);

    const unsubscribe = notificationService.subscribeToSettings((settings) => {
      setSettings(settings);
    });

    return () => {
      unsubscribe();
    };
  }, [userProfile?.centreId, userProfile?.uid]);

  const handleSettingChange = async (key: keyof NotificationSettings, value: any) => {
    if (!settings) return;

    try {
      setLoading(true);
      const updatedSettings = { ...settings, [key]: value };
      await notificationService.updateSettings(updatedSettings);
      
      toast({
        title: "Settings updated",
        description: "Notification settings have been updated successfully",
      });
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast({
        title: "Error",
        description: "Failed to update notification settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationTypeChange = async (type: keyof NotificationSettings['notificationTypes'], enabled: boolean) => {
    if (!settings) return;

    const updatedNotificationTypes = {
      ...settings.notificationTypes,
      [type]: enabled
    };

    await handleSettingChange('notificationTypes', updatedNotificationTypes);
  };

  const handleQuietHoursChange = async (key: keyof NotificationSettings['quietHours'], value: any) => {
    if (!settings) return;

    const updatedQuietHours = {
      ...settings.quietHours,
      [key]: value
    };

    await handleSettingChange('quietHours', updatedQuietHours);
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
        <span className="ml-3 text-gray-600">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Notification Settings</h2>
            <p className="text-sm text-gray-600">
              Configure how and when you receive notifications
            </p>
          </div>
        </div>
        <Button
          onClick={() => setActiveTab('general')}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          <Save className="w-4 h-4 mr-2" />
          Save All
        </Button>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="types">Types</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-purple-600" />
                General Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Notifications */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Enable Notifications</Label>
                  <p className="text-sm text-gray-600">
                    Turn all notifications on or off
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(enabled) => handleSettingChange('enabled', enabled)}
                  disabled={loading}
                />
              </div>

              {/* Sound Notifications */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Sound Alerts</Label>
                  <p className="text-sm text-gray-600">
                    Play sound when notifications arrive
                  </p>
                </div>
                <Switch
                  checked={settings.sound}
                  onCheckedChange={(sound) => handleSettingChange('sound', sound)}
                  disabled={loading}
                />
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Timezone</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(timezone) => handleSettingChange('timezone', timezone)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                    <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="space-y-6">
          {/* Notification Channels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Notification Channels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Browser Notifications */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Browser Notifications</Label>
                  <p className="text-sm text-gray-600">
                    Show notifications in your browser
                  </p>
                </div>
                <Switch
                  checked={settings.browserNotifications}
                  onCheckedChange={(enabled) => handleSettingChange('browserNotifications', enabled)}
                  disabled={loading}
                />
              </div>

              {/* Email Notifications */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Email Notifications</Label>
                  <p className="text-sm text-gray-600">
                    Send notifications via email
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(enabled) => handleSettingChange('emailNotifications', enabled)}
                  disabled={loading}
                />
              </div>

              {/* SMS Notifications */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">SMS Notifications</Label>
                  <p className="text-sm text-gray-600">
                    Send notifications via SMS
                  </p>
                </div>
                <Switch
                  checked={settings.smsNotifications}
                  onCheckedChange={(enabled) => handleSettingChange('smsNotifications', enabled)}
                  disabled={loading}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          {/* Schedule Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-600" />
                Schedule Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Reminder Frequency */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Reminder Frequency</Label>
                <Select
                  value={settings.reminderFrequency}
                  onValueChange={(frequency) => handleSettingChange('reminderFrequency', frequency)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reminder Time */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Reminder Time</Label>
                <Input
                  type="time"
                  value={settings.reminderTime}
                  onChange={(e) => handleSettingChange('reminderTime', e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Quiet Hours */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Quiet Hours</Label>
                    <p className="text-sm text-gray-600">
                      Pause notifications during specific hours
                    </p>
                  </div>
                  <Switch
                    checked={settings.quietHours.enabled}
                    onCheckedChange={(enabled) => handleQuietHoursChange('enabled', enabled)}
                    disabled={loading}
                  />
                </div>

                {settings.quietHours.enabled && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Start Time</Label>
                      <Input
                        type="time"
                        value={settings.quietHours.start}
                        onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">End Time</Label>
                      <Input
                        type="time"
                        value={settings.quietHours.end}
                        onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-6">
          {/* Notification Types */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                Notification Types
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Reminders */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Reminders</Label>
                  <p className="text-sm text-gray-600">
                    Follow-up reminders and scheduled tasks
                  </p>
                </div>
                <Switch
                  checked={settings.notificationTypes.reminders}
                  onCheckedChange={(enabled) => handleNotificationTypeChange('reminders', enabled)}
                  disabled={loading}
                />
              </div>

              {/* Alerts */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Alerts</Label>
                  <p className="text-sm text-gray-600">
                    Important alerts and warnings
                  </p>
                </div>
                <Switch
                  checked={settings.notificationTypes.alerts}
                  onCheckedChange={(enabled) => handleNotificationTypeChange('alerts', enabled)}
                  disabled={loading}
                />
              </div>

              {/* System */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">System</Label>
                  <p className="text-sm text-gray-600">
                    System updates and maintenance
                  </p>
                </div>
                <Switch
                  checked={settings.notificationTypes.system}
                  onCheckedChange={(enabled) => handleNotificationTypeChange('system', enabled)}
                  disabled={loading}
                />
              </div>

              {/* Payments */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Payments</Label>
                  <p className="text-sm text-gray-600">
                    Payment reminders and receipts
                  </p>
                </div>
                <Switch
                  checked={settings.notificationTypes.payments}
                  onCheckedChange={(enabled) => handleNotificationTypeChange('payments', enabled)}
                  disabled={loading}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Tasks</Label>
                  <p className="text-sm text-gray-600">
                    Task assignments, deadlines, and approvals
                  </p>
                </div>
                <Switch
                  checked={settings.notificationTypes.tasks ?? true}
                  onCheckedChange={(enabled) => handleNotificationTypeChange('tasks', enabled)}
                  disabled={loading}
                />
              </div>

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status Indicator */}
      <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm text-green-700 font-medium">
          Settings are automatically saved
        </span>
      </div>
    </div>
  );
};

export default NotificationSettingsComponent; 
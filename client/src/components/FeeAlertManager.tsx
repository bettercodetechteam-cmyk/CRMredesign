import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Bell, Phone, CheckCircle, XCircle, AlertTriangle, MessageCircle, Smartphone } from 'lucide-react';
import { smsService } from '@/lib/smsService';
import { useToast } from '@/hooks/use-toast';

interface FeeAlert {
  id: string;
  studentName: string;
  phoneNumber: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'sent' | 'failed';
  message: string;
  sentAt?: string;
  provider?: string;
  channel?: 'whatsapp' | 'sms' | 'email';
}

interface FeeAlertManagerProps {
  students: any[];
  onAlertSent?: (alert: FeeAlert) => void;
}

export default function FeeAlertManager({ students, onAlertSent }: FeeAlertManagerProps) {
  const [alerts, setAlerts] = useState<FeeAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [smsStatus, setSmsStatus] = useState<any>(null);
  const [preferredChannel, setPreferredChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const { toast } = useToast();

  // Filter students with pending fees
  const studentsWithPendingFees = (students || []).filter(student => {
    const balance = parseFloat(student.feesBalance || '0');
    return balance > 0 && student.phone;
  });

  useEffect(() => {
    checkSMSStatus();
  }, []);

  const checkSMSStatus = async () => {
    try {
      const status = await smsService.checkSMSStatus();
      setSmsStatus(status);
    } catch (error) {
      console.error('Failed to check messaging status:', error);
    }
  };

  const generateFeeAlerts = () => {
    const newAlerts: FeeAlert[] = studentsWithPendingFees.map(student => {
      const balance = parseFloat(student.feesBalance || '0');
      const message = preferredChannel === 'whatsapp' 
        ? smsService.generateWhatsAppFeeReminder(student)
        : smsService.generateFeeReminder(student);
      
      return {
        id: `alert_${student.id}_${Date.now()}`,
        studentName: `${student.firstName} ${student.lastName}`,
        phoneNumber: student.phone,
        amount: balance,
        dueDate: student.dueDate || 'Not specified',
        status: 'pending',
        message,
        channel: preferredChannel
      };
    });

    setAlerts(newAlerts);
    toast({
      title: "Fee Alerts Generated",
      description: `${newAlerts.length} ${preferredChannel} alerts ready to send`,
    });
  };

  const sendSingleAlert = async (alert: FeeAlert) => {
    try {
      setLoading(true);
      
      const response = await smsService.sendSMS({
        phoneNumber: alert.phoneNumber,
        message: alert.message,
        studentName: alert.studentName,
        channel: alert.channel || preferredChannel
      });

      const updatedAlert = {
        ...alert,
        status: response.success ? 'sent' : 'failed',
        sentAt: new Date().toISOString(),
        provider: response.notification?.provider || 'bettercode',
        channel: response.notification?.channel || alert.channel
      };

      setAlerts(prev => prev.map(a => a.id === alert.id ? updatedAlert : a));
      
      if (response.success) {
        const channel = updatedAlert.channel || 'message';
        toast({
          title: `${channel.toUpperCase()} Sent Successfully`,
          description: `Fee reminder sent to ${alert.studentName} via ${channel}`,
        });
        onAlertSent?.(updatedAlert);
      } else {
        toast({
          title: "Message Failed",
          description: `Failed to send to ${alert.studentName}: ${response.message}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error sending alert:', error);
      toast({
        title: "Error",
        description: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const sendAllAlerts = async () => {
    if (alerts.length === 0) {
      toast({
        title: "No Alerts",
        description: "Generate fee alerts first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setSendingProgress(0);

    const pendingAlerts = alerts.filter(alert => alert.status === 'pending');
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingAlerts.length; i++) {
      const alert = pendingAlerts[i];
      
      try {
        const response = await smsService.sendSMS({
          phoneNumber: alert.phoneNumber,
          message: alert.message,
          studentName: alert.studentName,
          channel: alert.channel || preferredChannel
        });

        const updatedAlert = {
          ...alert,
          status: response.success ? 'sent' : 'failed',
          sentAt: new Date().toISOString(),
          provider: response.notification?.provider || 'bettercode',
          channel: response.notification?.channel || alert.channel
        };

        setAlerts(prev => prev.map(a => a.id === alert.id ? updatedAlert : a));
        
        if (response.success) {
          successCount++;
          onAlertSent?.(updatedAlert);
        } else {
          failCount++;
        }

        // Update progress
        setSendingProgress(((i + 1) / pendingAlerts.length) * 100);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error sending alert to ${alert.studentName}:`, error);
        failCount++;
        
        const updatedAlert = {
          ...alert,
          status: 'failed',
          sentAt: new Date().toISOString()
        };
        
        setAlerts(prev => prev.map(a => a.id === alert.id ? updatedAlert : a));
      }
    }

    setLoading(false);
    setSendingProgress(0);

    const channel = preferredChannel === 'whatsapp' ? 'WhatsApp' : 'SMS';
    toast({
      title: `Bulk ${channel} Complete`,
      description: `Sent: ${successCount}, Failed: ${failCount}`,
      variant: failCount > 0 ? "destructive" : "default"
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getChannelIcon = (channel?: string) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageCircle className="w-4 h-4 text-green-600" />;
      case 'sms':
        return <Smartphone className="w-4 h-4 text-blue-600" />;
      default:
        return <MessageCircle className="w-4 h-4 text-green-600" />;
    }
  };

  const getChannelColor = (channel?: string) => {
    switch (channel) {
      case 'whatsapp':
        return 'bg-green-100 text-green-800';
      case 'sms':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Messaging Status */}
      {smsStatus && (
        <Alert className={smsStatus.configured ? "border-green-200" : "border-red-200"}>
          <MessageCircle className="h-4 w-4" />
          <AlertDescription>
            {preferredChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} Service: {smsStatus.configured ? 'Configured' : 'Not Configured'} 
            {smsStatus.configured && ` (${smsStatus.providers.join(', ')})`}
          </AlertDescription>
        </Alert>
      )}

      {/* Channel Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Messaging Channel
          </CardTitle>
          <CardDescription>
            Choose your preferred messaging channel for fee reminders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={preferredChannel === 'whatsapp' ? 'default' : 'outline'}
              onClick={() => setPreferredChannel('whatsapp')}
              className="flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp (Recommended)
            </Button>
            <Button
              variant={preferredChannel === 'sms' ? 'default' : 'outline'}
              onClick={() => setPreferredChannel('sms')}
              className="flex items-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              SMS (Fallback)
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {preferredChannel === 'whatsapp' 
              ? 'WhatsApp offers better delivery rates and is free for students'
              : 'SMS is a reliable fallback option'
            }
          </p>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Fee Alert Summary
          </CardTitle>
          <CardDescription>
            Manage fee reminders for students with pending payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{studentsWithPendingFees.length}</div>
              <div className="text-sm text-gray-600">Students with Pending Fees</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {alerts.filter(a => a.status === 'sent').length}
              </div>
              <div className="text-sm text-gray-600">{preferredChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {alerts.filter(a => a.status === 'failed').length}
              </div>
              <div className="text-sm text-gray-600">Failed Alerts</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={generateFeeAlerts}
              disabled={studentsWithPendingFees.length === 0}
              variant="outline"
            >
              Generate {preferredChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} Alerts ({studentsWithPendingFees.length})
            </Button>
            <Button 
              onClick={sendAllAlerts}
              disabled={alerts.length === 0 || loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Sending...' : `Send All ${preferredChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} Alerts (${alerts.filter(a => a.status === 'pending').length})`}
            </Button>
          </div>

          {loading && sendingProgress > 0 && (
            <div className="mt-4">
              <Progress value={sendingProgress} className="w-full" />
              <p className="text-sm text-gray-600 mt-2">
                Sending {preferredChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} alerts... {Math.round(sendingProgress)}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts List */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fee Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(alert.status)}
                      <span className="font-medium">{alert.studentName}</span>
                      <Badge className={getStatusColor(alert.status)}>
                        {alert.status}
                      </Badge>
                      <Badge className={getChannelColor(alert.channel)}>
                        {getChannelIcon(alert.channel)}
                        <span className="ml-1">{alert.channel || preferredChannel}</span>
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      ₹{alert.amount.toLocaleString()} • {alert.phoneNumber}
                    </div>
                    {alert.provider && (
                      <div className="text-xs text-gray-500 mt-1">
                        Provider: {alert.provider}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {alert.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => sendSingleAlert(alert)}
                        disabled={loading}
                      >
                        Send
                      </Button>
                    )}
                    {alert.status === 'sent' && (
                      <div className="text-xs text-green-600">
                        Sent at {new Date(alert.sentAt!).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 
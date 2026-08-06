import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dataSyncService } from '@/lib/dataSyncService';
import { sourceManagerEvents } from '@/lib/sourceManager';
import { 
  Calendar as CalendarIcon,
  User, 
  TrendingUp, 
  TrendingDown, 
  Plus,
  RefreshCw,
  List,
  BarChart3,
  CalendarDays,
  Phone,
  Mail,
  Edit,
  Trash2,
  Eye,
  Search,
  Filter,
  Calendar,
  Clock,
  Target,
  Zap,
  Users,
  Building,
  GraduationCap,
  Briefcase,
  Globe,
  Activity,
  Settings,
  CheckCircle,
  AlertCircle,
  Star
} from 'lucide-react';
import LeadsCalendar from './LeadsCalendar';

interface Lead {
  id: string;
  name?: string;
  leadName?: string;
  phone?: string;
  contact?: string;
  contact1?: string;
  email?: string;
  emailId?: string;
  status: string;
  source: string;
  assignedTo?: string;
  followUpDate?: string | Date;
  followUpType?: 'call' | 'visit' | 'meeting' | 'admission';
  followUpNotes?: string;
  visitDate?: string | Date;
  callDate?: string | Date;
  admissionDate?: string | Date;
  notes?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt: string | Date;
  updatedAt: string | Date;
  type?: 'lead' | 'admission';
  courseInterest?: string;
  reminderDate?: string | Date;
  enquiryDate?: string | Date;
  course?: string;
  education?: string;
  cityArea?: string;
  counselorName?: string;
  remark?: string;
  feedbackCallRemarks?: string;
  centreHeadRemarks?: string;
}

interface LeadsCalendarViewProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onDateClick: (date: Date) => void;
  onStatusUpdate: (leadId: string, newStatus: string) => void;
  onLeadEdit: (lead: Lead) => void;
  onLeadDelete: (leadId: string) => void;
  onAddLead: () => void;
  onUpdateLead: (leadId: string, updates: Partial<Lead>) => void;
}

const LeadsCalendarView: React.FC<LeadsCalendarViewProps> = ({
  leads,
  onLeadClick,
  onDateClick,
  onStatusUpdate,
  onLeadEdit,
  onLeadDelete,
  onAddLead,
  onUpdateLead
}) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Subscribe to data sync events for real-time updates
  useEffect(() => {
    const unsubscribeLead = dataSyncService.subscribe('lead', (event) => {
      console.log('📅 LeadsCalendarView: Lead sync event received:', event);
      // Trigger refresh when lead data changes
      if (event.action === 'updated' || event.action === 'deleted') {
        setRefreshTrigger(prev => prev + 1);
      }
    });

    const unsubscribeStatus = dataSyncService.subscribe('status', (event) => {
      console.log('📅 LeadsCalendarView: Status sync event received:', event);
      // Trigger refresh when status changes
      if (event.action === 'updated') {
        setRefreshTrigger(prev => prev + 1);
      }
    });

    const unsubscribeCalendar = dataSyncService.subscribe('calendar', (event) => {
      console.log('📅 LeadsCalendarView: Calendar sync event received:', event);
      // Trigger refresh when calendar data changes
      if (event.action === 'updated') {
        setRefreshTrigger(prev => prev + 1);
      }
    });

    const unsubscribeSource = sourceManagerEvents.subscribe((event) => {
      console.log('📅 LeadsCalendarView: Source update received:', event.detail);
      // Trigger refresh when a new source is added
      if (event.detail.newSource) {
        setRefreshTrigger(prev => prev + 1);
      }
    });

    return () => {
      unsubscribeLead();
      unsubscribeStatus();
      unsubscribeCalendar();
      unsubscribeSource();
    };
  }, []);

  // Filtered leads based on search and filters
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = searchTerm === '' || 
        (lead.name || lead.leadName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.phone || lead.contact || '').includes(searchTerm) ||
        (lead.email || lead.emailId || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
      
      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [leads, searchTerm, statusFilter, sourceFilter]);

  // Handle date selection
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateClick(date);
  };

  // Get unique sources for filter
  const uniqueSources = useMemo(() => {
    const sources = [...new Set(leads.map(lead => lead.source))].filter(Boolean);
    return sources.sort();
  }, [leads]);

  // Get unique statuses for filter
  const uniqueStatuses = useMemo(() => {
    const statuses = [...new Set(leads.map(lead => lead.status))].filter(Boolean);
    return statuses.sort();
  }, [leads]);

  return (
    <div className="space-y-6">
      {/* Main Content - Calendar Only */}
      <Card className="shadow-sm border border-slate-200 bg-white rounded-xl overflow-hidden calendar-container">
        <CardContent className="p-0">
          {/* Calendar Component */}
          <LeadsCalendar
            leads={filteredLeads}
            onLeadClick={onLeadClick}
            onDateClick={handleDateClick}
            onStatusUpdate={onStatusUpdate}
            onLeadEdit={onLeadEdit}
            onLeadDelete={onLeadDelete}
            onAddLead={onAddLead}
            onUpdateLead={onUpdateLead}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadsCalendarView; 
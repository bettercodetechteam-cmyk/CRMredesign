import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Phone,
  Mail,
  Calendar,
  User,
  BookOpen,
  MapPin,
  Building,
  Plus,
  RefreshCw,
  Users
} from 'lucide-react';

interface Lead {
  id: string;
  name?: string;
  leadName?: string;
  phone?: string;
  contact?: string;
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

interface LeadsTableViewProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onStatusUpdate: (leadId: string, newStatus: string) => void;
  onLeadEdit: (lead: Lead) => void;
  onLeadDelete: (leadId: string) => void;
  onAddLead: () => void;
  onUpdateLead: (leadId: string, updates: Partial<Lead>) => void;
}

const LeadsTableView: React.FC<LeadsTableViewProps> = ({
  leads,
  onLeadClick,
  onStatusUpdate,
  onLeadEdit,
  onLeadDelete,
  onAddLead,
  onUpdateLead
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');

  // Filter leads based on search and filters
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = searchTerm === '' || 
        (lead.leadName && lead.leadName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.contact && lead.contact.includes(searchTerm)) ||
        (lead.emailId && lead.emailId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.course && lead.course.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
      const matchesCourse = courseFilter === 'all' || lead.course === courseFilter;

      return matchesSearch && matchesStatus && matchesSource && matchesCourse;
    });
  }, [leads, searchTerm, statusFilter, sourceFilter, courseFilter]);

  // Get unique values for filters
  const uniqueStatuses = useMemo(() => {
    const statuses = [...new Set(leads.map(lead => lead.status))];
    return statuses.filter(Boolean);
  }, [leads]);

  const uniqueSources = useMemo(() => {
    const sources = [...new Set(leads.map(lead => lead.source))];
    return sources.filter(Boolean);
  }, [leads]);

  const uniqueCourses = useMemo(() => {
    const courses = [...new Set(leads.map(lead => lead.course))];
    return courses.filter((c): c is string => !!c);
  }, [leads]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      "Admission Done": "bg-green-600 text-white",
      "Cold Lead": "bg-blue-600 text-white",
      "Hot Lead": "bg-red-600 text-white",
      "Not Interested": "bg-gray-700 text-white",
      "Visited": "bg-teal-600 text-white",
      "Placement": "bg-emerald-600 text-white",
      "Not Contacted": "bg-slate-600 text-white",
      "Job Seeker": "bg-indigo-600 text-white",
      "Converted": "bg-green-600 text-white",
      "Done": "bg-green-600 text-white",
      "Other": "bg-violet-500 text-white",
  "New": "bg-violet-500 text-white",
      "Contacted": "bg-blue-500 text-white",
      "Interested": "bg-amber-600 text-white",
      "Warm Lead": "bg-orange-600 text-white",
      "Lost": "bg-gray-600 text-white",
    };
    return colors[status] || "bg-gray-600 text-white";
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'high': 'bg-red-100 text-red-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'low': 'bg-green-100 text-green-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return '-';
    try {
      const d = new Date(date);
      return d.toLocaleDateString();
    } catch (error) {
      return '-';
    }
  };

  const safeRender = (value: any) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }
    return value.toString().trim() || "-";
  };

  return (
    <div className="space-y-6">
      {/* Table View Header */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Table View</h2>
                <p className="text-sm text-gray-600">View and manage leads in table format</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setSourceFilter('all');
                  setCourseFilter('all');
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Clear Filters
              </Button>
              <Button
                onClick={onAddLead}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
              >
                <Plus className="w-4 h-4" />
                Add Lead
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {uniqueStatuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {uniqueSources.map(source => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {uniqueCourses.map(course => (
                  <SelectItem key={course} value={course}>{course}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="text-sm text-gray-500 flex items-center justify-center">
              {filteredLeads.length} of {leads.length} leads
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold sticky left-0 z-20 bg-gray-50 w-[250px] min-w-[250px] max-w-[250px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Lead Information</TableHead>
                  <TableHead className="font-semibold sticky left-[250px] z-20 bg-gray-50 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Contact</TableHead>
                  <TableHead className="font-semibold min-w-[200px]">Course & Source</TableHead>
                  <TableHead className="font-semibold min-w-[150px]">Status</TableHead>
                  <TableHead className="font-semibold min-w-[180px]">Follow-up</TableHead>
                  <TableHead className="font-semibold min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length > 0 ? (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id} className="group hover:bg-gray-50 cursor-pointer" onClick={() => onLeadClick(lead)}>
                      <TableCell className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 w-[250px] min-w-[250px] max-w-[250px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {(lead.leadName || lead.name || 'L').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {safeRender(lead.leadName || lead.name)}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {safeRender(lead.counselorName === "Gaurav" ? "NC" : lead.counselorName)}
                            </div>
                            {lead.priority && (
                              <Badge className={`text-xs ${getPriorityColor(lead.priority)}`}>
                                {lead.priority} priority
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="sticky left-[250px] z-10 bg-white group-hover:bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {safeRender(lead.contact || lead.phone)}
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="w-3 h-3 text-gray-400" />
                            {safeRender(lead.emailId || lead.email)}
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {safeRender(lead.cityArea)}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <BookOpen className="w-3 h-3 text-gray-400" />
                            {safeRender(lead.course)}
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Building className="w-3 h-3 text-gray-400" />
                            {safeRender(lead.source)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(lead.enquiryDate)}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge className={getStatusColor(lead.status)}>
                          {lead.status === "Converted (Admission Done)" ? "Admission Done" : lead.status}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {formatDate(lead.followUpDate)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {lead.followUpType && `${lead.followUpType}`}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLeadClick(lead);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLeadEdit(lead);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLeadDelete(lead.id);
                            }}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="text-gray-500">
                        <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium mb-2">No leads found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadsTableView;

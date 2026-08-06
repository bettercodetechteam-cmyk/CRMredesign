import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Settings, 
  Database, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  BarChart3,
  RefreshCw,
  FileText,
  Target,
  Calendar
} from "lucide-react";
import { 
  cleanAllLeadsForCentre, 
  cleanLeadsWithCriteria, 
  validateAllLeadsForCentre, 
  getCleaningStatistics,
  type BulkCleaningResult 
} from "@/lib/bulkDataCleaningService";
import { LEAD_SOURCES, COURSES, MODULAR_PROGRAMS, LEAD_STATUSES } from "@/lib/leadDataCleaningService";

interface DataCleaningPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DataCleaningPanel({ open, onOpenChange }: DataCleaningPanelProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'clean' | 'validate' | 'stats'>('clean');
  const [cleaningResult, setCleaningResult] = useState<BulkCleaningResult | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  
  // Cleaning criteria state
  const [criteria, setCriteria] = useState({
    source: '',
    course: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  });

  const handleBulkClean = async () => {
    if (!userProfile?.centreId) {
      toast({
        title: "Error",
        description: "Centre ID not found",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await cleanAllLeadsForCentre(userProfile.centreId);
      setCleaningResult(result);
      
      toast({
        title: "Bulk Cleaning Completed",
        description: `Updated ${result.totalUpdated} leads out of ${result.totalProcessed} processed`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to perform bulk cleaning",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTargetedClean = async () => {
    if (!userProfile?.centreId) {
      toast({
        title: "Error",
        description: "Centre ID not found",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const cleanCriteria = {
        source: criteria.source || undefined,
        course: criteria.course || undefined,
        status: criteria.status || undefined,
        dateFrom: criteria.dateFrom ? new Date(criteria.dateFrom) : undefined,
        dateTo: criteria.dateTo ? new Date(criteria.dateTo) : undefined
      };

      const result = await cleanLeadsWithCriteria(userProfile.centreId, cleanCriteria);
      setCleaningResult(result);
      
      toast({
        title: "Targeted Cleaning Completed",
        description: `Updated ${result.totalUpdated} leads out of ${result.totalProcessed} processed`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to perform targeted cleaning",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!userProfile?.centreId) {
      toast({
        title: "Error",
        description: "Centre ID not found",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await validateAllLeadsForCentre(userProfile.centreId);
      setValidationResult(result);
      
      toast({
        title: "Validation Completed",
        description: `${result.validLeads} valid leads, ${result.invalidLeads} invalid leads`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to validate leads",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetStatistics = async () => {
    if (!userProfile?.centreId) {
      toast({
        title: "Error",
        description: "Centre ID not found",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await getCleaningStatistics(userProfile.centreId);
      setStatistics(result);
      
      toast({
        title: "Statistics Generated",
        description: `Analyzed ${result.totalLeads} leads`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate statistics",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const allCourses = [...COURSES, ...MODULAR_PROGRAMS];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            Data Cleaning & Classification
          </DialogTitle>
          <DialogDescription>
            Clean and standardize lead data according to CRM standards
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <Button
            variant={activeTab === 'clean' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('clean')}
            className="flex-1"
          >
            <Database className="w-4 h-4 mr-2" />
            Clean Data
          </Button>
          <Button
            variant={activeTab === 'validate' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('validate')}
            className="flex-1"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Validate
          </Button>
          <Button
            variant={activeTab === 'stats' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('stats')}
            className="flex-1"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Statistics
          </Button>
        </div>

        {/* Clean Data Tab */}
        {activeTab === 'clean' && (
          <div className="space-y-6">
            {/* Bulk Clean All */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-green-600" />
                  Bulk Clean All Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Clean and standardize all leads in your centre according to CRM standards.
                </p>
                <Button 
                  onClick={handleBulkClean} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cleaning...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Clean All Leads
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Targeted Clean */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  Targeted Cleaning
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Clean leads based on specific criteria.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="source-filter">Source</Label>
                    <Select value={criteria.source} onValueChange={(value) => setCriteria({...criteria, source: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Sources</SelectItem>
                        {LEAD_SOURCES.map((source) => (
                          <SelectItem key={source} value={source}>{source}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="course-filter">Course</Label>
                    <Select value={criteria.course} onValueChange={(value) => setCriteria({...criteria, course: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Courses</SelectItem>
                        {allCourses.map((course) => (
                          <SelectItem key={course} value={course}>{course}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="status-filter">Status</Label>
                    <Select value={criteria.status} onValueChange={(value) => setCriteria({...criteria, status: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Statuses</SelectItem>
                        {LEAD_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="date-from">Date From</Label>
                    <Input
                      id="date-from"
                      type="date"
                      value={criteria.dateFrom}
                      onChange={(e) => setCriteria({...criteria, dateFrom: e.target.value})}
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleTargetedClean} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cleaning...
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4 mr-2" />
                      Clean Selected Leads
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Cleaning Results */}
            {cleaningResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    Cleaning Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{cleaningResult.totalProcessed}</div>
                      <div className="text-sm text-gray-600">Total Processed</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{cleaningResult.totalUpdated}</div>
                      <div className="text-sm text-gray-600">Updated</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{cleaningResult.totalErrors}</div>
                      <div className="text-sm text-gray-600">Errors</div>
                    </div>
                  </div>
                  
                  {Object.keys(cleaningResult.changes.sources).length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Source Changes:</h4>
                      <div className="space-y-1">
                        {Object.entries(cleaningResult.changes.sources).map(([change, count]) => (
                          <div key={change} className="text-sm text-gray-600">
                            {change}: {count} leads
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {Object.keys(cleaningResult.changes.courses).length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Course Changes:</h4>
                      <div className="space-y-1">
                        {Object.entries(cleaningResult.changes.courses).map(([change, count]) => (
                          <div key={change} className="text-sm text-gray-600">
                            {change}: {count} leads
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {Object.keys(cleaningResult.changes.statuses).length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Status Changes:</h4>
                      <div className="space-y-1">
                        {Object.entries(cleaningResult.changes.statuses).map(([change, count]) => (
                          <div key={change} className="text-sm text-gray-600">
                            {change}: {count} leads
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {cleaningResult.errors.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2 text-red-600">Errors:</h4>
                      <div className="space-y-1">
                        {cleaningResult.errors.map((error, index) => (
                          <div key={index} className="text-sm text-red-600">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Validate Tab */}
        {activeTab === 'validate' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Validate Lead Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Check all leads for data quality and compliance with CRM standards.
                </p>
                <Button 
                  onClick={handleValidate} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Validate All Leads
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Validation Results */}
            {validationResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    Validation Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{validationResult.totalLeads}</div>
                      <div className="text-sm text-gray-600">Total Leads</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{validationResult.validLeads}</div>
                      <div className="text-sm text-gray-600">Valid</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{validationResult.invalidLeads}</div>
                      <div className="text-sm text-gray-600">Invalid</div>
                    </div>
                  </div>
                  
                  {Object.keys(validationResult.validationErrors).length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-red-600">Validation Errors:</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {Object.entries(validationResult.validationErrors).map(([leadId, errors]) => (
                          <div key={leadId} className="p-2 bg-red-50 rounded border">
                            <div className="font-medium text-sm">Lead ID: {leadId}</div>
                            <ul className="text-sm text-red-600 mt-1">
                              {(errors as string[]).map((error, index) => (
                                <li key={index}>• {error}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  Data Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Get detailed statistics about your lead data and identify areas for improvement.
                </p>
                <Button 
                  onClick={handleGetStatistics} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Generate Statistics
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Statistics Results */}
            {statistics && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">{statistics.totalLeads}</div>
                      <div className="text-sm text-gray-600">Total Leads</div>
                    </div>
                  </CardContent>
                </Card>

                {statistics.nonStandardSources.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-orange-600">Non-Standard Sources</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {statistics.nonStandardSources.map((source: string) => (
                          <div key={source} className="flex justify-between items-center p-2 bg-orange-50 rounded">
                            <span className="font-medium">{source}</span>
                            <span className="text-sm text-gray-600">{statistics.sourceDistribution[source]} leads</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {statistics.nonStandardCourses.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-orange-600">Non-Standard Courses</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {statistics.nonStandardCourses.map((course: string) => (
                          <div key={course} className="flex justify-between items-center p-2 bg-orange-50 rounded">
                            <span className="font-medium">{course}</span>
                            <span className="text-sm text-gray-600">{statistics.courseDistribution[course]} leads</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {statistics.nonStandardStatuses.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-orange-600">Non-Standard Statuses</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {statistics.nonStandardStatuses.map((status: string) => (
                          <div key={status} className="flex justify-between items-center p-2 bg-orange-50 rounded">
                            <span className="font-medium">{status}</span>
                            <span className="text-sm text-gray-600">{statistics.statusDistribution[status]} leads</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

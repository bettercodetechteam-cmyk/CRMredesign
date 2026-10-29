import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { openCredentialLoginWindow } from '@/lib/firebase';

interface TestUser {
  email: string;
  password: string;
  role: string;
  description: string;
}

const staffUsers: TestUser[] = [
  {
    email: 'gauravkarewar724@gmail.com',
    password: 'Gaurav31@',
    role: 'director',
    description: 'Full system access - can view all features'
  },
  {
    email: 'academic.head@example.com',
    password: 'AcademicHead#2026',
    role: 'academic_head',
    description: 'Creates and publishes syllabi, and opens the coordinator report'
  },
  {
    email: 'centre.head@example.com',
    password: 'CentreHead#2026',
    role: 'centre_head',
    description: 'Pins a syllabus to a batch and schedules topics'
  },
  {
    email: 'faculty@example.com',
    password: 'Faculty#2026',
    role: 'faculty',
    description: 'Faculty Teacher · Updates lessons for assigned batches'
  },
  {
    email: 'faculty2@example.com',
    password: 'Faculty#2026',
    role: 'faculty',
    description: 'Ananya Deshmukh · Second teacher login'
  },
];

const studentParentPairs: { student: TestUser; parent: TestUser }[] = [
  {
    student: { email: 'student@example.com', password: 'Student#2026', role: 'student', description: 'Aarav Mehta · Game Art Design' },
    parent: { email: 'parent@example.com', password: 'Parent#2026', role: 'parent', description: 'Parent of Aarav Mehta' },
  },
  {
    student: { email: 'student2@example.com', password: 'Student#2026', role: 'student', description: 'Diya Shah · Digital Marketing' },
    parent: { email: 'parent2@example.com', password: 'Parent#2026', role: 'parent', description: 'Parent of Diya Shah' },
  },
  {
    student: { email: 'student3@example.com', password: 'Student#2026', role: 'student', description: 'Kabir Joshi · Game Art Design' },
    parent: { email: 'parent3@example.com', password: 'Parent#2026', role: 'parent', description: 'Parent of Kabir Joshi' },
  },
];

export default function TestCredentials() {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  const openLoginWindow = (email: string, password: string) => {
    try {
      openCredentialLoginWindow(email, password);
    } catch (error) {
      toast({
        title: 'Tab blocked',
        description: error instanceof Error ? error.message : 'Allow pop-ups for this site, then try again.',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: "Copied!",
        description: `${field} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
      director: 'bg-purple-100 text-purple-800',
      academic_head: 'bg-indigo-100 text-indigo-800',
      centre_head: 'bg-blue-100 text-blue-800',
      faculty: 'bg-green-100 text-green-800',
      parent: 'bg-amber-100 text-amber-800',
      bdm: 'bg-orange-100 text-orange-800',
      accounts: 'bg-teal-100 text-teal-800',
      marketing: 'bg-pink-100 text-pink-800',
      student: 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const credentialCard = (user: TestUser) => (
    <Card key={user.email} className="hover:shadow-lg transition-shadow h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg capitalize">{user.role.replace('_', ' ')}</CardTitle>
          <Badge className={getRoleColor(user.role)}>
            {user.role}
          </Badge>
        </div>
        <CardDescription>{user.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
          <div className="flex items-center space-x-2">
            <code className="flex-1 min-w-0 break-all bg-gray-100 px-3 py-2 rounded text-sm font-mono">
              {user.email}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(user.email, `${user.email}-email`)}
              className="flex-shrink-0"
            >
              {copiedField === `${user.email}-email` ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Password</label>
          <div className="flex items-center space-x-2">
            <code className="flex-1 min-w-0 break-all bg-gray-100 px-3 py-2 rounded text-sm font-mono">
              {user.password}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(user.password, `${user.email}-password`)}
              className="flex-shrink-0"
            >
              {copiedField === `${user.email}-password` ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        <Button
          className="w-full"
          onClick={() => openLoginWindow(user.email, user.password)}
        >
          Open login tab
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Credentials</h1>
          <p className="text-gray-600">Use these credentials to test the authentication system</p>
        </div>

        {/* Warning */}
        <Card className="mb-8 border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-yellow-800">Important Notice</h3>
                <p className="text-yellow-700 text-sm mt-1">
                  These are test credentials for the Syllabus Tracker project only.
                  Do not use these in production.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staffUsers.map((user) => credentialCard(user))}
        </div>

        <div className="mt-8 space-y-4">
          {studentParentPairs.map((pair) => (
            <div key={pair.student.email} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {credentialCard(pair.student)}
              {credentialCard(pair.parent)}
            </div>
          ))}
        </div>

        {/* Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>How to Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">1. Regular Login</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  <li>Go to the login page</li>
                  <li>Use any of the test credentials above</li>
                  <li>Click "Open login tab" on a role</li>
                  <li>That role's login page opens in a new tab</li>
                  <li>Click "Sign In" in that window</li>
                </ol>
              </div>

            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Testing Features</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                <li><strong>Role-based access:</strong> Each user sees different features in the sidebar</li>
                <li><strong>Data isolation:</strong> Users can only access their center's data</li>
                <li><strong>Lead management:</strong> Test creating and editing leads</li>
                <li><strong>Password reset:</strong> Use "Forgot Password?" to test OTP flow</li>
                <li><strong>User profile:</strong> Check the user info displayed in the sidebar</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

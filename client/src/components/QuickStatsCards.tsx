import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  Calendar, 
  MessageSquare, 
  GraduationCap, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  Users,
  MapPin,
  Bell,
  Star,
  Zap
} from 'lucide-react';

interface QuickStatsCardsProps {
  followUps: number;
  calls: number;
  visits: number;
  admissions: number;
  todayTasks: number;
  highPriority: number;
  onCardClick?: (type: string) => void;
}

export default function QuickStatsCards({
  followUps,
  calls,
  visits,
  admissions,
  todayTasks,
  highPriority,
  onCardClick
}: QuickStatsCardsProps) {
  const cards = [
    {
      id: 'followups',
      title: 'Follow-ups',
      value: followUps,
      icon: MessageSquare,
      gradient: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      borderColor: 'border-purple-200',
      description: 'Pending follow-ups'
    },
    {
      id: 'calls',
      title: 'Calls',
      value: calls,
      icon: Phone,
      gradient: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      description: 'Today\'s calls'
    },
    {
      id: 'visits',
      title: 'Visits',
      value: visits,
      icon: MapPin,
      gradient: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      borderColor: 'border-green-200',
      description: 'Scheduled visits'
    },
    {
      id: 'admissions',
      title: 'Admissions',
      value: admissions,
      icon: GraduationCap,
      gradient: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
      borderColor: 'border-indigo-200',
      description: 'New admissions'
    },
    {
      id: 'today',
      title: 'Today',
      value: todayTasks,
      icon: Clock,
      gradient: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      borderColor: 'border-orange-200',
      description: 'Today\'s tasks'
    },
    {
      id: 'highPriority',
      title: 'High Priority',
      value: highPriority,
      icon: AlertTriangle,
      gradient: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
      borderColor: 'border-red-200',
      description: 'Urgent items'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card 
            key={card.id}
            className={`
              group relative overflow-hidden cursor-pointer
              hover:shadow-xl transition-all duration-300 
              transform hover:-translate-y-1 hover:scale-105
              border-0 shadow-lg
              ${card.borderColor}
            `}
            onClick={() => onCardClick?.(card.id)}
          >
            <div className={`
              absolute inset-0 bg-gradient-to-br ${card.gradient} 
              opacity-0 group-hover:opacity-10 transition-opacity duration-300
            `} />
            
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center
                  ${card.bgColor} group-hover:bg-white/20 transition-colors duration-300
                `}>
                  <Icon className={`w-5 h-5 ${card.textColor} group-hover:text-white transition-colors duration-300`} />
                </div>
                {card.id === 'highPriority' && card.value > 0 && (
                  <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                    <Star className="w-3 h-3 mr-1" />
                    Urgent
                  </Badge>
                )}
              </div>
              
              <div className="space-y-1">
                <p className="text-2xl font-bold text-gray-900 group-hover:text-white transition-colors duration-300">
                  {card.value}
                </p>
                <p className="text-sm font-medium text-gray-600 group-hover:text-white/90 transition-colors duration-300">
                  {card.title}
                </p>
                <p className="text-xs text-gray-500 group-hover:text-white/70 transition-colors duration-300">
                  {card.description}
                </p>
              </div>
              
              {/* Hover effect overlay */}
              <div className={`
                absolute inset-0 bg-gradient-to-br ${card.gradient} 
                opacity-0 group-hover:opacity-100 transition-opacity duration-300
                rounded-lg
              `} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Alternative compact version for smaller screens
export function CompactStatsCards({
  followUps,
  calls,
  visits,
  admissions,
  todayTasks,
  highPriority,
  onCardClick
}: QuickStatsCardsProps) {
  const cards = [
    { id: 'followups', title: 'Follow-ups', value: followUps, icon: MessageSquare, color: 'purple' },
    { id: 'calls', title: 'Calls', value: calls, icon: Phone, color: 'blue' },
    { id: 'visits', title: 'Visits', value: visits, icon: MapPin, color: 'green' },
    { id: 'admissions', title: 'Admissions', value: admissions, icon: GraduationCap, color: 'indigo' },
    { id: 'today', title: 'Today', value: todayTasks, icon: Clock, color: 'orange' },
    { id: 'highPriority', title: 'Priority', value: highPriority, icon: AlertTriangle, color: 'red' }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      purple: 'bg-purple-500 text-white',
      blue: 'bg-blue-500 text-white',
      green: 'bg-green-500 text-white',
      indigo: 'bg-indigo-500 text-white',
      orange: 'bg-orange-500 text-white',
      red: 'bg-red-500 text-white'
    };
    return colors[color as keyof typeof colors] || 'bg-gray-500 text-white';
  };

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card 
            key={card.id}
            className="group cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-105 border-0"
            onClick={() => onCardClick?.(card.id)}
          >
            <CardContent className="p-3 text-center">
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2
                ${getColorClasses(card.color)}
              `}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-lg font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-600 font-medium">{card.title}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Mini version for very compact display
export function MiniStatsCards({
  followUps,
  calls,
  visits,
  admissions,
  todayTasks,
  highPriority,
  onCardClick
}: QuickStatsCardsProps) {
  const stats = [
    { id: 'followups', value: followUps, icon: MessageSquare, color: 'purple' },
    { id: 'calls', value: calls, icon: Phone, color: 'blue' },
    { id: 'visits', value: visits, icon: MapPin, color: 'green' },
    { id: 'admissions', value: admissions, icon: GraduationCap, color: 'indigo' },
    { id: 'today', value: todayTasks, icon: Clock, color: 'orange' },
    { id: 'highPriority', value: highPriority, icon: AlertTriangle, color: 'red' }
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.id}
            className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onCardClick?.(stat.id)}
          >
            <Icon className={`w-4 h-4 text-${stat.color}-500`} />
            <span className="font-semibold text-gray-900">{stat.value}</span>
          </div>
        );
      })}
    </div>
  );
} 
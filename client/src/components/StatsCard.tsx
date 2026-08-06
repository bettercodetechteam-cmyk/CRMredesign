import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  color?: string;
  className?: string;
  subtitle?: string;
}

const colorMap: { [key: string]: string } = {
  total: "bg-blue-500",
  new: "bg-green-500",
  cold: "bg-cyan-600",
  warm: "bg-orange-500",
  hot: "bg-red-500",
  notInterested: "bg-gray-500",
  fake: "bg-purple-500",
  dropped: "bg-rose-500",
  done: "bg-emerald-500",
  instagram: "bg-pink-500",
  facebook: "bg-blue-600",
  justDial: "bg-yellow-500",
  mis: "bg-indigo-500",
  hoarding: "bg-teal-500",
  pamphlet: "bg-lime-500",
  radioAd: "bg-violet-500"
};

export default function StatsCard({ title, value, color, className, subtitle }: StatsCardProps) {
  const bgColor = color || colorMap[title.toLowerCase().replace(/\s+/g, '')] || "bg-gray-500";

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-200 hover:shadow-lg",
      className
    )}>
      <div className={cn(
        "absolute top-0 left-0 w-1 h-full",
        bgColor
      )} />
      <div className="p-4 pl-6">
        <h3 className="text-sm font-medium text-gray-600 uppercase">{title}</h3>
        <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && (
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        )}
      </div>
    </Card>
  );
}

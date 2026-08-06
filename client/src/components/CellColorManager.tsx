import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Palette, Settings, Save, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ColorScheme {
  [key: string]: {
    backgroundColor: string;
    textColor: string;
    borderColor?: string;
  };
}

interface CellColorManagerProps {
  onColorSchemeChange: (scheme: ColorScheme) => void;
  currentScheme: ColorScheme;
}

const defaultColorScheme: ColorScheme = {
  "Other": { backgroundColor: "#ede9fe", textColor: "#5b21b6" },
  "New": { backgroundColor: "#ede9fe", textColor: "#5b21b6" },
  "Cold Lead": { backgroundColor: "#bfdbfe", textColor: "#1e3a8a" },
  "Warm Lead": { backgroundColor: "#fed7aa", textColor: "#ea580c" },
  "Hot Lead": { backgroundColor: "#fecaca", textColor: "#dc2626" },
  "Not Interested": { backgroundColor: "#f3f4f6", textColor: "#374151" },
  "Fake": { backgroundColor: "#fce7f3", textColor: "#be185d" },
  "Dropped": { backgroundColor: "#fef3c7", textColor: "#d97706" },
  "Admission Done": { backgroundColor: "#dcfce7", textColor: "#16a34a" },
  "Converted": { backgroundColor: "#dcfce7", textColor: "#16a34a" },
  "Done": { backgroundColor: "#dcfce7", textColor: "#16a34a" },
  "Lost": { backgroundColor: "#f3f4f6", textColor: "#374151" },
  "Interested": { backgroundColor: "#dcfce7", textColor: "#16a34a" },
  "Contacted": { backgroundColor: "#dbeafe", textColor: "#1e40af" },
  "Visit Scheduled": { backgroundColor: "#e0e7ff", textColor: "#4338ca" },
  "Visit Completed": { backgroundColor: "#ccfbf1", textColor: "#0f766e" },
  "Call Made": { backgroundColor: "#dcfce7", textColor: "#16a34a" },
  "Call Not Received": { backgroundColor: "#fecaca", textColor: "#dc2626" },
  "Follow-up Scheduled": { backgroundColor: "#f3e8ff", textColor: "#7c3aed" },
  "Follow-up Completed": { backgroundColor: "#dcfce7", textColor: "#16a34a" },
  "Enquiry": { backgroundColor: "#fef3c7", textColor: "#d97706" },
  "Qualified": { backgroundColor: "#dcfce7", textColor: "#16a34a" },
  "Proposal Sent": { backgroundColor: "#e0e7ff", textColor: "#4338ca" },
  "Negotiation": { backgroundColor: "#fed7aa", textColor: "#ea580c" },
  "Closed Won": { backgroundColor: "#dcfce7", textColor: "#16a34a" },
  "Closed Lost": { backgroundColor: "#fecaca", textColor: "#dc2626" },
};

const predefinedColors = [
  { name: "Blue", bg: "#dbeafe", text: "#1e40af" },
  { name: "Green", bg: "#dcfce7", text: "#16a34a" },
  { name: "Red", bg: "#fecaca", text: "#dc2626" },
  { name: "Orange", bg: "#fed7aa", text: "#ea580c" },
  { name: "Purple", bg: "#f3e8ff", text: "#7c3aed" },
  { name: "Pink", bg: "#fce7f3", text: "#be185d" },
  { name: "Yellow", bg: "#fef3c7", text: "#d97706" },
  { name: "Gray", bg: "#f3f4f6", text: "#374151" },
  { name: "Teal", bg: "#ccfbf1", text: "#0f766e" },
  { name: "Indigo", bg: "#e0e7ff", text: "#4338ca" },
];

export default function CellColorManager({ onColorSchemeChange, currentScheme }: CellColorManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localScheme, setLocalScheme] = useState<ColorScheme>(currentScheme);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [customColor, setCustomColor] = useState({ backgroundColor: "#ffffff", textColor: "#000000" });
  const { toast } = useToast();

  useEffect(() => {
    setLocalScheme(currentScheme);
  }, [currentScheme]);

  const handleColorChange = (status: string, backgroundColor: string, textColor: string) => {
    setLocalScheme(prev => ({
      ...prev,
      [status]: { backgroundColor, textColor }
    }));
  };

  const handleSave = () => {
    onColorSchemeChange(localScheme);
    toast({
      title: "Color scheme saved",
      description: "Your custom color scheme has been applied to the table.",
    });
    setIsOpen(false);
  };

  const handleReset = () => {
    setLocalScheme(defaultColorScheme);
    onColorSchemeChange(defaultColorScheme);
    toast({
      title: "Color scheme reset",
      description: "Colors have been reset to default values.",
    });
  };

  const handleApplyPredefined = (status: string, colorName: string) => {
    const color = predefinedColors.find(c => c.name === colorName);
    if (color) {
      handleColorChange(status, color.bg, color.text);
    }
  };

  const statuses = Object.keys(defaultColorScheme);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="px-3 sm:px-4 py-2 sm:py-2.5 h-9 sm:h-10 lg:h-11 border-gray-200 hover:bg-gray-50">
                <Palette className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Cell Colors</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Cell Color Management
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status-based Color Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status-based Colors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {statuses.map((status) => (
                  <div key={status} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">{status}</Label>
                      <Badge 
                        style={{
                          backgroundColor: localScheme[status]?.backgroundColor || defaultColorScheme[status]?.backgroundColor,
                          color: localScheme[status]?.textColor || defaultColorScheme[status]?.textColor,
                        }}
                        className="border"
                      >
                        {status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Background Color</Label>
                      <Input
                        type="color"
                        value={localScheme[status]?.backgroundColor || defaultColorScheme[status]?.backgroundColor}
                        onChange={(e) => handleColorChange(status, e.target.value, localScheme[status]?.textColor || defaultColorScheme[status]?.textColor)}
                        className="h-10"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Text Color</Label>
                      <Input
                        type="color"
                        value={localScheme[status]?.textColor || defaultColorScheme[status]?.textColor}
                        onChange={(e) => handleColorChange(status, localScheme[status]?.backgroundColor || defaultColorScheme[status]?.backgroundColor, e.target.value)}
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Quick Presets</Label>
                      <div className="flex flex-wrap gap-1">
                        {predefinedColors.slice(0, 5).map((color) => (
                          <button
                            key={color.name}
                            onClick={() => handleApplyPredefined(status, color.name)}
                            className="w-6 h-6 rounded border-2 border-gray-300 hover:border-gray-400 transition-colors"
                            style={{ backgroundColor: color.bg }}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Custom Cell Coloring */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Custom Cell Coloring</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Status</Label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="">Choose a status...</option>
                      {statuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Custom Color Preview</Label>
                    <div className="flex gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Background</Label>
                        <Input
                          type="color"
                          value={customColor.backgroundColor}
                          onChange={(e) => setCustomColor(prev => ({ ...prev, backgroundColor: e.target.value }))}
                          className="h-8 w-16"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Text</Label>
                        <Input
                          type="color"
                          value={customColor.textColor}
                          onChange={(e) => setCustomColor(prev => ({ ...prev, textColor: e.target.value }))}
                          className="h-8 w-16"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {selectedStatus && (
                  <div className="flex items-center gap-4">
                    <Badge 
                      style={{
                        backgroundColor: customColor.backgroundColor,
                        color: customColor.textColor,
                      }}
                      className="border"
                    >
                      {selectedStatus}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (selectedStatus) {
                          handleColorChange(selectedStatus, customColor.backgroundColor, customColor.textColor);
                          toast({
                            title: "Color applied",
                            description: `Custom color applied to ${selectedStatus}`,
                          });
                        }
                      }}
                    >
                      Apply Color
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Reset to Default
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="gap-2">
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
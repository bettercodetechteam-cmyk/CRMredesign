import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Printer, Download, Eye, FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { ReceiptTemplate, ReceiptData } from '@/components/receipts/ReceiptTemplate';
// @ts-ignore
import { useReactToPrint } from 'react-to-print';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { resolveOrGenerateReceiptNumber, isZicaReceiptLayout } from '@/lib/receiptCounterService';
import { db } from '@/lib/firebase';

interface ManualReceiptGeneratorProps {
  onBack?: () => void;
  brand: 'Zica' | 'AIGT' | 'ZICA' | 'BETTERCODE';
}

export default function ManualReceiptGenerator({ onBack, brand }: ManualReceiptGeneratorProps) {
  const { toast } = useToast();
  const componentRef = useRef<HTMLDivElement>(null);

  // Initialize form state
  const [formData, setFormData] = useState<ReceiptData>({
    studentName: '',
    course: '',
    contactNumber: '',
    receiptNumber: '',
    date: '', // Receipt date must come from fee record (Fees Paid Date only); no default
    paymentMode: 'Cash',
    chequeNumber: '',
    totalInstallments: 0,
    totalCourseFees: 0,
    balanceDue: 0,
    amountPaid: 0,
    cgst: 0,
    sgst: 0,
    grossTotal: 0,
    zicaBettercode: brand,
    remarks: '',
  });
  const [category, setCategory] = useState<'ZICA' | 'Non-ZICA'>('ZICA');

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => {
      const updated = { ...prev };
      
      if (type === 'number') {
        const numValue = parseFloat(value) || 0;
        
        // Handle special calculations for financial fields
        if (name === 'amountPaid') {
            updated.amountPaid = numValue;
            // Recalculate GST
            // Gross Total = Amount Paid (inclusive of GST)
            // Taxable = Amount Paid / 1.18
            const taxable = numValue / 1.18;
            const gstAmount = numValue - taxable;
            updated.cgst = gstAmount / 2;
            updated.sgst = gstAmount / 2;
            updated.grossTotal = numValue;
        } else if (name === 'totalCourseFees') {
            updated.totalCourseFees = numValue;
        } else if (name === 'balanceDue') {
            updated.balanceDue = numValue;
        } else if (name === 'totalInstallments') {
            updated.totalInstallments = parseInt(value) || 0;
        } else {
            (updated as any)[name] = numValue;
        }
      } else {
        (updated as any)[name] = value;
      }
      
      return updated;
    });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Receipt_${formData.receiptNumber || 'Draft'}`,
    onAfterPrint: () => {
        toast({
            title: "Printed Successfully",
            description: "The receipt has been sent to the printer.",
        });
    }
  });

  const handleDownload = () => {
    // Trigger print which allows 'Save as PDF'
    handlePrint();
  };

  const receiptLayoutContext = {
    zicaBettercode: brand,
    zicaSubCategory: category === 'Non-ZICA' ? 'Non-ZICA' : '',
  };
  const showZicaLayout = isZicaReceiptLayout(receiptLayoutContext);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <h2 className="text-2xl font-bold text-gray-900">
            Generate {brand} Receipt
          </h2>
        </div>
        
        <div className="flex gap-2">
           <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Eye className="w-4 h-4"/>
                    Preview
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogTitle className="sr-only">Receipt Preview</DialogTitle>
                <div className="flex justify-center p-4 bg-gray-100">
                     <ReceiptTemplate 
                        data={{ ...formData, date: formData.date || '-' }} 
                        isZica={showZicaLayout} 
                        // We don't pass ref here, only for key hidden instance we print
                    />
                </div>
            </DialogContent>
           </Dialog>

          <Button onClick={handleDownload} variant="secondary" className="gap-2">
            <Download className="w-4 h-4" />
            Download
          </Button>
          
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Receipt Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Receipt Number</Label>
                <Input 
                  name="receiptNumber" 
                  value={formData.receiptNumber || ''} 
                  onChange={handleChange} 
                  placeholder="e.g. REC-001"
                />
              </div>
            </div>

            {brand === 'ZICA' && (
              <div className="space-y-2 border-b pb-4">
                <Label className="text-blue-700 font-semibold">ZICA Category</Label>
                <Select 
                  value={category} 
                  onValueChange={(val: 'ZICA' | 'Non-ZICA') => setCategory(val)}
                >
                  <SelectTrigger className="bg-blue-50 border-blue-200">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZICA">ZICA (ZICA Prefix)</SelectItem>
                    <SelectItem value="Non-ZICA">Non-Zica (BTC Prefix)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-gray-500 italic">
                  * Determines if the receipt uses ZICA or Bettercode (BTC) branding.
                </p>
              </div>
            )}


            <div className="space-y-2">
              <Label>Student Name</Label>
              <Input 
                name="studentName" 
                value={formData.studentName || ''} 
                onChange={handleChange} 
                placeholder="Enter full name"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label>Course/Module</Label>
                <Input 
                    name="course" 
                    value={formData.course || ''} 
                    onChange={handleChange} 
                    placeholder="Enter course name"
                />
                </div>

                <div className="space-y-2">
                <Label>Contact Number</Label>
                <Input 
                    name="contactNumber" 
                    value={formData.contactNumber || ''} 
                    onChange={handleChange} 
                    placeholder="Mobile number"
                />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Payment Mode</Label>
                    <Select 
                        value={formData.paymentMode || 'Cash'} 
                        onValueChange={(val) => handleSelectChange('paymentMode', val)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Cheque">Cheque</SelectItem>
                            <SelectItem value="UPI">UPI</SelectItem>
                            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                            <SelectItem value="Card">Card</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {formData.paymentMode === 'Cheque' && (
                    <div className="space-y-2">
                        <Label>Cheque/DD No.</Label>
                        <Input 
                            name="chequeNumber" 
                            value={formData.chequeNumber || ''} 
                            onChange={handleChange} 
                            placeholder="Cheque details"
                        />
                    </div>
                )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label>Total Installments</Label>
                    <Input 
                        type="number"
                        name="totalInstallments" 
                        value={formData.totalInstallments || 0} 
                        onChange={handleChange} 
                    />
                </div>
            </div>

            <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold mb-3">Financials</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Total Course Fees</Label>
                        <Input 
                            type="number"
                            name="totalCourseFees" 
                            value={formData.totalCourseFees || 0} 
                            onChange={handleChange} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Balance Due</Label>
                        <Input 
                            type="number"
                            name="balanceDue" 
                            value={formData.balanceDue || 0} 
                            onChange={handleChange} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Amount Paid (Gross)</Label>
                        <Input 
                            type="number"
                            name="amountPaid" 
                            value={formData.amountPaid || 0} 
                            onChange={handleChange} 
                        />
                         <p className="text-xs text-muted-foreground">
                            Includes 18% GST (auto-calculated)
                         </p>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-4 bg-muted/50 p-3 rounded-md text-sm">
                    <div>
                        <span className="text-muted-foreground">CGST (9%):</span>
                        <div className="font-medium">{formData.cgst.toFixed(2)}</div>
                    </div>
                    <div>
                        <span className="text-muted-foreground">SGST (9%):</span>
                        <div className="font-medium">{formData.sgst.toFixed(2)}</div>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Gross Total:</span>
                        <div className="font-bold">{formData.grossTotal.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input 
                name="remarks" 
                value={formData.remarks || ''} 
                onChange={handleChange} 
                placeholder="Optional remarks"
              />
            </div>
          </CardContent>
        </Card>

        {/* Live Preview Section (Hidden off-screen for printing) */}
        <div style={{ position: 'absolute', left: -9999, top: -9999 }}>
           <ReceiptTemplate 
                ref={componentRef}
                data={{ ...formData, date: formData.date || '-' }} 
                isZica={showZicaLayout} 
            />
        </div>
        
        {/* Visual Preview on Screen */}
        <div className="hidden lg:block overflow-hidden border rounded-lg shadow-sm bg-gray-50 flex items-center justify-center p-4">
            <div className="scale-75 origin-top">
                 <ReceiptTemplate 
                    data={{ ...formData, date: formData.date || '-' }} 
                    isZica={showZicaLayout} 
                />
            </div>
        </div>
      </div>
    </div>
  );
}

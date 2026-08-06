const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');

const configs = [
  {
    fileMatch: 'Expenses.tsx',
    varName: 'filteredExpenses',
    mapTargets: ['filteredExpenses.map((expense) => ('],
    tableHeads: [
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-4 pl-6">Amount</TableHead>', key: 'amount' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-4">Description</TableHead>', key: 'description' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-4">Category</TableHead>', key: 'category' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-4">Payment Mode</TableHead>', key: 'paymentMode' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-4">Paid By</TableHead>', key: 'paidBy' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-4">Date</TableHead>', key: 'expenseDate' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-4">Reimbursement</TableHead>', key: 'isReimbursement' },
    ]
  },
  {
    fileMatch: 'Students.tsx',
    varName: 'currentStudents',
    mapTargets: ['currentStudents.map((student: any, idx: number) => ('],
    tableHeads: [
      { replaceStr: '<TableHead className="w-[64px] min-w-[64px] sticky left-0 z-40 font-semibold text-slate-700 py-3 text-xs sm:text-sm bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">Sr No.</TableHead>', key: 'srNo', origClass: "w-[64px] min-w-[64px] sticky left-0 z-40 font-semibold text-slate-700 py-3 text-xs sm:text-sm bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]" },
      { replaceStr: '<TableHead className="min-w-[200px] sticky left-[64px] z-40 font-semibold text-slate-700 py-3 text-xs sm:text-sm bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Student Name</TableHead>', key: 'firstName', origClass: "min-w-[200px] sticky left-[64px] z-40 font-semibold text-slate-700 py-3 text-xs sm:text-sm bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" },
      { replaceStr: '<TableHead className="min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm">Contact</TableHead>', key: 'phone', origClass: "min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm">Date of Admission</TableHead>', key: 'admissionDate', origClass: "min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="min-w-[100px] font-semibold text-slate-700 py-3 text-xs sm:text-sm">Business</TableHead>', key: 'zicaZima', origClass: "min-w-[100px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm">Fees Structure</TableHead>', key: 'feesStructure', origClass: "min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm">Course</TableHead>', key: 'course', origClass: "min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="min-w-[100px] font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center">Duration</TableHead>', key: 'courseDuration', origClass: "min-w-[100px] font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" },
      { replaceStr: '<TableHead className="min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm">Start Date</TableHead>', key: 'courseStartDate', origClass: "min-w-[150px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="min-w-[120px] text-right font-semibold text-slate-700 py-3 text-xs sm:text-sm">Actual Fees</TableHead>', key: 'actualFees', origClass: "min-w-[120px] text-right font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="min-w-[120px] text-right font-semibold text-slate-700 py-3 text-xs sm:text-sm">Discounted</TableHead>', key: 'discountedFees', origClass: "min-w-[120px] text-right font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="min-w-[120px] text-right font-semibold text-slate-700 py-3 text-xs sm:text-sm">Paid Fees</TableHead>', key: 'feesPaid', origClass: "min-w-[120px] text-right font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="min-w-[120px] font-semibold text-slate-700 py-3 text-xs sm:text-sm">Paid Date</TableHead>', key: 'feesPaidDate', origClass: "min-w-[120px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="min-w-[120px] text-right font-semibold text-slate-700 py-3 text-xs sm:text-sm">Balance</TableHead>', key: 'feesBalance', origClass: "min-w-[120px] text-right font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="min-w-[120px] font-semibold text-slate-700 py-3 text-xs sm:text-sm">Payment Mode</TableHead>', key: 'paymentMode', origClass: "min-w-[120px] font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="min-w-[100px] font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center">Inst. Total</TableHead>', key: 'noOfInstallments', origClass: "min-w-[100px] font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" },
      { replaceStr: '<TableHead className="min-w-[100px] font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center">Inst. Paid</TableHead>', key: 'installmentsPaid', origClass: "min-w-[100px] font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" },
    ]
  },
  {
    fileMatch: 'Batches.tsx',
    varName: 'filteredBatches',
    mapTargets: ['filteredBatches.map((batch) => ('],
    tableHeads: [
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Display Name</TableHead>', key: 'name' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Course</TableHead>', key: 'course' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Status</TableHead>', key: 'status' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Capacity</TableHead>', key: 'capacity' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Duration</TableHead>', key: 'startDate' },
    ]
  },
  {
    fileMatch: 'FeeManagement.tsx',
    varName: 'filteredRecords',
    mapTargets: ['filteredRecords.map((record) => ('],
    tableHeads: [
      { replaceStr: '<TableHead className="sticky left-0 z-50 bg-slate-50 w-16 min-w-[64px] font-semibold text-slate-700 py-3 text-xs sm:text-sm border-r border-slate-200">Sr No</TableHead>', key: 'srNo', origClass: "sticky left-0 z-50 bg-slate-50 w-16 min-w-[64px] font-semibold text-slate-700 py-3 text-xs sm:text-sm border-r border-slate-200" },
      { replaceStr: '<TableHead className="sticky left-[64px] z-50 bg-slate-50 min-w-[180px] font-semibold text-slate-700 py-3 text-xs sm:text-sm border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Student Name</TableHead>', key: 'studentName', origClass: "sticky left-[64px] z-50 bg-slate-50 min-w-[180px] font-semibold text-slate-700 py-3 text-xs sm:text-sm border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Contact Number</TableHead>', key: 'phone', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Fees Structure</TableHead>', key: 'feesStructure', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right">Actual Fees</TableHead>', key: 'actualFees', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right">Fees Paid</TableHead>', key: 'feesPaid', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right">Fees Balance</TableHead>', key: 'feesBalance', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Fees Paid Date</TableHead>', key: 'feesPaidDate', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Payment Mode</TableHead>', key: 'paymentMode', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Due Date</TableHead>', key: 'dueDate', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Next Installment</TableHead>', key: 'nextInstallment', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center">Month</TableHead>', key: 'month', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center">Year</TableHead>', key: 'year', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" },
    ]
  },
  {
    fileMatch: 'EnhancedFeeManagement.tsx',
    varName: 'filteredRecords',
    mapTargets: ['filteredRecords.map((record) => ('],
    tableHeads: [
      { replaceStr: '<TableHead className="sticky left-0 z-50 bg-slate-50 w-16 min-w-[64px] font-semibold text-slate-700 py-3 text-xs sm:text-sm border-r border-slate-200">Sr No</TableHead>', key: 'srNo', origClass: "sticky left-0 z-50 bg-slate-50 w-16 min-w-[64px] font-semibold text-slate-700 py-3 text-xs sm:text-sm border-r border-slate-200" },
      { replaceStr: '<TableHead className="sticky left-[64px] z-50 bg-slate-50 min-w-[180px] font-semibold text-slate-700 py-3 text-xs sm:text-sm border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Student Name</TableHead>', key: 'studentName', origClass: "sticky left-[64px] z-50 bg-slate-50 min-w-[180px] font-semibold text-slate-700 py-3 text-xs sm:text-sm border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Source</TableHead>', key: 'source', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Parents Contact</TableHead>', key: 'parentsContact', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Contact Number</TableHead>', key: 'phone', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Admission Month</TableHead>', key: 'admissionMonth', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Date of Admission</TableHead>', key: 'admissionDate', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">ZICA/BETTERCODE</TableHead>', key: 'zicaZima', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Course</TableHead>', key: 'course', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Course Duration</TableHead>', key: 'courseDuration', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Course Start Date</TableHead>', key: 'courseStartDate', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right">Actual Fees</TableHead>', key: 'actualFees', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right">Discounted Fees</TableHead>', key: 'discountedFees', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right">Fees Paid</TableHead>', key: 'feesPaid', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right">Fees Balance</TableHead>', key: 'feesBalance', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Fees Paid Date</TableHead>', key: 'feesPaidDate', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm">Payment Mode</TableHead>', key: 'paymentMode', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm" },
      { replaceStr: '<TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center">No. of Installments</TableHead>', key: 'noOfInstallments', origClass: "font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" },
    ]
  },
  {
    fileMatch: 'Leads.tsx',
    varName: 'filteredEnquiries',
    mapTargets: ['filteredEnquiries.map((enquiry) => ('],
    tableHeads: [
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Date</TableHead>', key: 'createdAt', origClass: 'font-semibold text-slate-700' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Lead ID</TableHead>', key: 'leadId', origClass: 'font-semibold text-slate-700' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Name</TableHead>', key: 'name', origClass: 'font-semibold text-slate-700' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Phone & Email</TableHead>', key: 'phone', origClass: 'font-semibold text-slate-700' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Course(s)</TableHead>', key: 'course', origClass: 'font-semibold text-slate-700' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Source</TableHead>', key: 'source', origClass: 'font-semibold text-slate-700' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Status</TableHead>', key: 'status', origClass: 'font-semibold text-slate-700' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Lead Score</TableHead>', key: 'leadScore', origClass: 'font-semibold text-slate-700' },
      { replaceStr: '<TableHead className="font-semibold text-slate-700">Next Follow-up</TableHead>', key: 'followUpDate', origClass: 'font-semibold text-slate-700' },
    ]
  }
];

configs.forEach(config => {
  const filePath = path.join(pagesDir, config.fileMatch);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipped ${config.fileMatch} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Add imports
  if (!content.includes('useTableSort') && content.includes('<TableHead')) {
    const importMatch = content.match(/import\s+{([^}]*)}\s+from\s+["']@\/components\/ui\/table["'];/);
    if (importMatch) {
      if (!content.includes('SortableTableHead')) {
        content = content.replace(
          /import\s+{([^}]*)}\s+from\s+["']@\/components\/ui\/table["'];/,
          `import { ${importMatch[1]} } from "@/components/ui/table";\nimport { useTableSort } from "@/hooks/useTableSort";\nimport { SortableTableHead } from "@/components/ui/sortable-table-head";`
        );
        changed = true;
      }
    }
  }

  // Add hook definition. We can inject it right before the mapping targeting.
  if (changed && config.mapTargets && content.includes(config.mapTargets[0])) {
    const hookInject = `\n  const { sortedData, requestSort, sortConfig } = useTableSort(${config.varName});\n`;
    
    // We want to place the hook before the return statement of the component.
    // It's safer to just inject it right before `return (` where the main render happens, but there are multiple returns.
    // Let's just use regex to find the `return (` that is nearest to the mapping.
    
    // As a simple hack, just place the hook inside the function that renders. Or right after the variable definition.
    const varDefRegex = new RegExp(`const ${config.varName} = [^;]*;`, 's');
    content = content.replace(varDefRegex, `$&${hookInject}`);

    // Replace the exact maps
    config.mapTargets.forEach(target => {
      content = content.replace(
        target,
        target.replace(config.varName, 'sortedData')
      );
    });

    // Replace table heads
    config.tableHeads.forEach(head => {
      // Find the label from the replaceStr
      const labelMatch = head.replaceStr.match(/>([^<]+)<\/TableHead>/);
      const label = labelMatch ? labelMatch[1] : '';
      
      const newElem = head.origClass ? 
        `<SortableTableHead className="${head.origClass}" sortConfig={sortConfig} sortKey="${head.key}" requestSort={requestSort}>${label}</SortableTableHead>` :
        `<SortableTableHead sortConfig={sortConfig} sortKey="${head.key}" requestSort={requestSort}>${label}</SortableTableHead>`;
        
      content = content.replace(head.replaceStr, newElem);
      
      // Also try regex for more flexible match
      if (head.origClass) {
        // e.g., <TableHead className="font-semibold text-slate-700 py-4 pl-6">Amount</TableHead>
        const regex = new RegExp(`<TableHead[^>]*>${label}</TableHead>`);
        content = content.replace(regex, `<SortableTableHead className="${head.origClass}" sortConfig={sortConfig} sortKey="${head.key}" requestSort={requestSort}>${label}</SortableTableHead>`);
      } else {
        const regex = new RegExp(`<TableHead[^>]*>${label}</TableHead>`);
        content = content.replace(regex, `<SortableTableHead className="font-semibold text-slate-700" sortConfig={sortConfig} sortKey="${head.key}" requestSort={requestSort}>${label}</SortableTableHead>`);
      }
    });
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${config.fileMatch}`);
  }
});

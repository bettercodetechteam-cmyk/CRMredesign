import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Trash2, Check, X, Package, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Loading from "@/components/ui/loading";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Asset {
  id: string;
  itemName: string;
  count: number;
  category: string;
  centreId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const CATEGORIES = [
  "Furniture",
  "Electronics & IT Equipment",
  "Appliances & Utilities",
  "Decor & Display",
  "Branding & Signage",
  "Stationery & Learning Materials",
  "Cleaning & Utility",
  "Health & Safety"
];

export default function Assets() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(CATEGORIES[0]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ itemName: "", count: 0 });
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newAssetData, setNewAssetData] = useState({ itemName: "", count: 0 });
  const [searchTerm, setSearchTerm] = useState("");

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const assetsRef = collection(db, 'assets');
      const q = query(assetsRef, orderBy('createdAt', 'asc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Asset[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { itemName: string; count: number; category: string }) => {
      const assetData = {
        ...data,
        centreId: userProfile?.centreId || 'default',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, 'assets'), assetData);
      return { id: docRef.id, ...assetData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setIsAddingMode(false);
      setNewAssetData({ itemName: "", count: 0 });
      toast({ title: "Success", description: "Asset added successfully!" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to add asset", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { itemName: string; count: number } }) => {
      const assetRef = doc(db, 'assets', id);
      const updateData = {
        ...data,
        updatedAt: Timestamp.now(),
      };
      await updateDoc(assetRef, updateData);
      return { id, ...updateData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setEditingId(null);
      toast({ title: "Success", description: "Asset updated successfully!" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update asset", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'assets', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({ title: "Success", description: "Asset deleted successfully!" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to delete asset", variant: "destructive" });
    }
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (items: { itemName: string; count: number; category: string }[]) => {
      const batchPromises = items.map(item => {
        const assetData = {
          ...item,
          centreId: userProfile?.centreId || 'default',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        return addDoc(collection(db, 'assets'), assetData);
      });
      await Promise.all(batchPromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setIsAddingMode(false);
      setNewAssetData({ itemName: "", count: 0 });
      toast({ title: "Success", description: "Assets pasted and added successfully!" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to add assets", variant: "destructive" });
    }
  });

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData('text');
    if (paste.includes('\n')) {
      e.preventDefault();
      const lines = paste.split(/\r?\n/).map(line => line.trim()).filter(line => line);
      
      const newItems = lines.map(line => {
        const parts = line.split('\t');
        let itemName = parts[0];
        let count = 1;
        if (parts.length > 1) {
          const parsedCount = parseInt(parts[1], 10);
          if (!isNaN(parsedCount)) {
            count = parsedCount;
          } else {
            const parsedCountFirst = parseInt(parts[0], 10);
            if (!isNaN(parsedCountFirst)) {
              count = parsedCountFirst;
              itemName = parts[1];
            } else {
               itemName = line;
            }
          }
        }
        return { itemName: itemName.trim(), count, category: activeTab };
      });

      if (newItems.length > 0) {
        if (window.confirm(`Do you want to paste and add ${newItems.length} items?`)) {
          bulkCreateMutation.mutate(newItems);
        }
      }
    }
  };

  const handleSaveEdit = (id: string) => {
    if (!editFormData.itemName.trim()) {
      toast({ title: "Validation Error", description: "Item name cannot be empty", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id, data: editFormData });
  };

  const handleSaveNew = () => {
    if (!newAssetData.itemName.trim()) {
      toast({ title: "Validation Error", description: "Item name cannot be empty", variant: "destructive" });
      return;
    }
    createMutation.mutate({ ...newAssetData, category: activeTab });
  };

  const allCategories = Array.from(new Set([...CATEGORIES, ...assets.map(a => a.category), ...customCategories]));
  const currentCategoryAssets = assets.filter(a => a.category === activeTab && a.itemName.toLowerCase().includes(searchTerm.toLowerCase()));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="md" color="primary" text="Loading assets..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-md">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Assets Management</h1>
              <p className="text-sm text-slate-500">Track and manage inventory across categories</p>
            </div>
          </div>
          <div className="w-full md:w-72">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search assets..." 
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tabs and Content */}
        <Card className="shadow-sm border-slate-200">
          <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setIsAddingMode(false); setEditingId(null); }} className="w-full">
            <div className="px-6 pt-6 border-b border-slate-100 overflow-x-auto hide-scrollbar">
              <TooltipProvider delayDuration={150}>
                <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-slate-100 p-1 mb-2">
                  {allCategories.map(category => (
                    <Tooltip key={category}>
                      <TooltipTrigger asChild>
                        <TabsTrigger 
                          value={category}
                          className={`px-4 whitespace-nowrap transition-colors rounded-sm text-sm font-medium ${activeTab === category ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 bg-transparent'}`}
                        >
                          {category}
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{category}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  
                  {isAddingCategory ? (
                    <div className="flex items-center ml-2 space-x-1">
                      <Input 
                        autoFocus
                        placeholder="New category..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="h-8 w-32 bg-white text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (newCategoryName.trim()) {
                            setCustomCategories([...customCategories, newCategoryName.trim()]);
                            setActiveTab(newCategoryName.trim());
                            setNewCategoryName("");
                            setIsAddingCategory(false);
                          }
                        }
                        if (e.key === 'Escape') {
                          setIsAddingCategory(false);
                          setNewCategoryName("");
                        }
                      }}
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => {
                        if (newCategoryName.trim()) {
                          setCustomCategories([...customCategories, newCategoryName.trim()]);
                          setActiveTab(newCategoryName.trim());
                          setNewCategoryName("");
                          setIsAddingCategory(false);
                        }
                    }}>
                      <Check className="h-4 w-4" />
                    </Button>
                     <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-200" onClick={() => {
                          setIsAddingCategory(false);
                          setNewCategoryName("");
                    }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="ml-2 text-slate-500 hover:bg-transparent hover:text-slate-500 h-8 px-2"
                        onClick={() => setIsAddingCategory(true)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add Category</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </TabsList>
            </TooltipProvider>
            </div>
            
            <div className="p-6">
              <div className="rounded-md border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[50%]">Item Name</TableHead>
                      <TableHead className="w-[25%]">Count</TableHead>
                      <TableHead className="w-[25%] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentCategoryAssets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell>
                          {editingId === asset.id ? (
                            <Input 
                              value={editFormData.itemName}
                              onChange={(e) => setEditFormData({ ...editFormData, itemName: e.target.value })}
                              className="h-8"
                            />
                          ) : (
                            <span className="font-medium text-slate-800">{asset.itemName}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === asset.id ? (
                            <Input 
                              type="number"
                              min="0"
                              value={editFormData.count}
                              onChange={(e) => setEditFormData({ ...editFormData, count: parseInt(e.target.value) || 0 })}
                              className="h-8 w-24"
                            />
                          ) : (
                            <span className="text-slate-600">{asset.count}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingId === asset.id ? (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(asset.id)} className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50">
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => {
                                  setEditingId(asset.id);
                                  setEditFormData({ itemName: asset.itemName, count: asset.count });
                                }} 
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => {
                                  if(confirm("Are you sure you want to delete this asset?")) {
                                    deleteMutation.mutate(asset.id);
                                  }
                                }} 
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Adding new row UI */}
                    {isAddingMode && (
                      <TableRow className="bg-blue-50/50">
                        <TableCell>
                          <Input 
                            autoFocus
                            placeholder="Enter item name"
                            value={newAssetData.itemName}
                            onChange={(e) => setNewAssetData({ ...newAssetData, itemName: e.target.value })}
                            onPaste={handlePaste}
                            className="h-8 bg-white"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveNew();
                              if (e.key === 'Escape') setIsAddingMode(false);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            min="0"
                            value={newAssetData.count === 0 ? '' : newAssetData.count}
                            onChange={(e) => setNewAssetData({ ...newAssetData, count: parseInt(e.target.value) || 0 })}
                            className="h-8 w-24 bg-white"
                            placeholder="Count"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveNew();
                              if (e.key === 'Escape') setIsAddingMode(false);
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={handleSaveNew} className="h-8" disabled={createMutation.isPending}>
                              {createMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setIsAddingMode(false)} className="h-8 bg-white" disabled={createMutation.isPending}>
                              Cancel
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {currentCategoryAssets.length === 0 && !isAddingMode && (
                  <div className="text-center py-8 text-slate-500">
                    No items found in {activeTab}. Click "Add Item" to create one.
                  </div>
                )}
              </div>

              {!isAddingMode && (
                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    className="w-full border-dashed border-2 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => {
                      setIsAddingMode(true);
                      setNewAssetData({ itemName: "", count: 1 });
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Item
                  </Button>
                </div>
              )}
            </div>
            
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Plus, BookOpen, Box, Search, ScanLine, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { BarcodeScanner } from '@/components/ui/BarcodeScanner';

interface InvItem { itemId: string; name: string; category: string; quantity: number; condition: string | null; location: string | null; assignedTo: string | null; notes: string | null; barcode: string | null; }
interface BookItem { bookId: string; title: string; author: string; isbn: string | null; totalQuantity: number; availableQuantity: number; category: string | null; }

const CATEGORIES = ['Furniture', 'Electronics', 'Sports', 'Lab Equipment', 'Stationery', 'Textbooks', 'Other'];

export default function InventoryPage() {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [items, setItems] = useState<InvItem[]>([]);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [iName, setIName] = useState(''); const [iCategory, setICategory] = useState(CATEGORIES[0]);
  const [iQty, setIQty] = useState('1'); const [iCondition, setICondition] = useState('');
  const [iLocation, setILocation] = useState(''); const [iAssigned, setIAssigned] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [iRes, bRes] = await Promise.all([
        fetch('/api/inventory/items', { credentials: 'include' }),
        fetch('/api/library/books', { credentials: 'include' }),
      ]);
      if (iRes.ok) { const j = await iRes.json(); setItems(j.data ?? []); }
      if (bRes.ok) { const j = await bRes.json(); setBooks(j.data ?? []); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const [scanBarcode, setScanBarcode] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  const handleScanForAdd = async (barcode: string) => {
    setScanBarcode(barcode);
    setScanResult(null);
    setScanning(false);
    try {
      const res = await fetch('/api/library/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setScanResult({ exists: true, item: json.data });
        success(`Found existing item: "${json.data.title || json.data.name}"`);
        return;
      }
    } catch {}
    setLookupLoading(true);
    try {
      const upcRes = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
      if (upcRes.ok) {
        const upcJson = await upcRes.json();
        if (upcJson.items?.length > 0) {
          const product = upcJson.items[0];
          setIName(product.title || '');
          const cat = product.category ? product.category.split(' > ')[0] : CATEGORIES[0];
          if (CATEGORIES.includes(cat)) {setICategory(cat);}
          setScanResult({ exists: false, barcode, name: product.title, category: cat });
          success('Product info found! Fill in details and add.');
          return;
        }
      }
    } catch {}
    setScanResult({ exists: false, barcode, name: '', category: '' });
    setIName('');
    setLookupLoading(false);
  };

  const addItem = useCallback(async () => {
    if (!iName.trim() || !iCategory) { error('Enter name and category'); return; }
    try {
      const payload: any = { name: iName.trim(), category: iCategory, quantity: parseInt(iQty) || 1, condition: iCondition.trim() || undefined, location: iLocation.trim() || undefined, assignedTo: iAssigned.trim() || undefined };
      if (scanBarcode) { payload.barcode = scanBarcode; }
      const res = await fetch('/api/inventory/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {throw new Error(json.error || 'Failed');}
      setItems((prev) => [...prev, json.data]);
      setIName(''); setIQty('1'); setICondition(''); setILocation(''); setIAssigned(''); setScanBarcode(''); setScanResult(null);
      success('Item added');
    } catch (err) { error(err instanceof Error ? err.message : 'Failed'); }
  }, [iName, iCategory, iQty, iCondition, iLocation, iAssigned, scanBarcode, success, error]);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const availableBooks = books.reduce((s, b) => s + b.availableQuantity, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory & Library" description="Track school assets, textbooks, and library books" icon={<Package className="h-6 w-6" />} />

      {loading ? (
        <Card><CardContent className="py-12 text-center"><Spinner size="lg" /></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500">Inventory Items</p>
                <p className="text-2xl font-bold text-gray-900">{items.length}</p>
                <p className="text-xs text-gray-500">{totalItems} total units</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500">Library Books</p>
                <p className="text-2xl font-bold text-gray-900">{books.length}</p>
                <p className="text-xs text-gray-500">{availableBooks} available</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500">Categories</p>
                <p className="text-2xl font-bold text-gray-900">{new Set(items.map((i) => i.category)).size}</p>
                <p className="text-xs text-gray-500">asset categories</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500">Books Issued</p>
                <p className="text-2xl font-bold text-gray-900">{books.reduce((s, b) => s + (b.totalQuantity - b.availableQuantity), 0)}</p>
                <p className="text-xs text-gray-500">currently borrowed</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="inventory">
            <TabsList>
              <TabsTrigger value="inventory"><Box className="h-4 w-4 mr-1" /> School Inventory ({items.length})</TabsTrigger>
              <TabsTrigger value="library"><BookOpen className="h-4 w-4 mr-1" /> Library Books ({books.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="inventory" className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Scan & Add Item</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-gray-500">Scan a barcode to look up product info and pre-fill the add form. If the item already exists in inventory, it will be shown instead.</p>
                  <BarcodeScanner onScan={handleScanForAdd} />
                  {lookupLoading && <p className="text-xs text-blue-600"><Loader2 className="h-3 w-3 inline animate-spin mr-1" />Looking up product database...</p>}
                  {scanResult && !scanResult.exists && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                      <p className="font-medium">Barcode: {scanResult.barcode}</p>
                      {scanResult.name && <p className="text-xs mt-1">Product: {scanResult.name}</p>}
                      <p className="text-xs mt-1">Category: {scanResult.category}</p>
                      <p className="text-xs text-blue-600 mt-1">Fill in details below and add to inventory.</p>
                    </div>
                  )}
                  {scanResult?.exists && scanResult.item && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                      <p className="font-medium">{scanResult.item.title || scanResult.item.name}</p>
                      <p className="text-xs mt-1">Already in inventory</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Add Inventory Item</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap items-end gap-3">
                  <div className="w-56"><label className="block text-xs font-medium text-gray-600 mb-1">Item Name *</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Item name" value={iName} onChange={(e) => setIName(e.target.value)} /></div>
                  <div className="w-36"><label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                    <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={iCategory} onChange={(e) => setICategory(e.target.value)}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="w-16"><label className="block text-xs font-medium text-gray-600 mb-1">Qty</label><input type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={iQty} onChange={(e) => setIQty(e.target.value)} /></div>
                  <div className="w-36"><label className="block text-xs font-medium text-gray-600 mb-1">Condition</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="New/Good/Fair" value={iCondition} onChange={(e) => setICondition(e.target.value)} /></div>
                  <div className="w-40"><label className="block text-xs font-medium text-gray-600 mb-1">Location</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g., Store Room B" value={iLocation} onChange={(e) => setILocation(e.target.value)} /></div>
                  <div className="w-44"><label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Person/Department" value={iAssigned} onChange={(e) => setIAssigned(e.target.value)} /></div>
                  <Button leftIcon={<Plus className="h-4 w-4" />} onClick={addItem}>Add</Button>
                </CardContent>
              </Card>

              {items.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600">Item</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600">Category</th>
                          <th className="px-4 py-2.5 text-right font-medium text-gray-600">Qty</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600">Condition</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600">Location</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600">Assigned To</th>
                          <th className="px-4 py-2.5 text-center font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((item) => (
                          <tr key={item.itemId} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-900">{item.name}</td>
                            <td className="px-4 py-2.5"><Badge variant="default" size="xs">{item.category}</Badge></td>
                            <td className="px-4 py-2.5 text-right font-medium">{item.quantity}</td>
                            <td className="px-4 py-2.5 text-gray-600">{item.condition ?? '-'}</td>
                            <td className="px-4 py-2.5 text-gray-600">{item.location ?? '-'}</td>
                            <td className="px-4 py-2.5 text-gray-600">{item.assignedTo ?? '-'}</td>
                            <td className="px-4 py-2.5 text-center">
                              <button onClick={async () => {
                                const newName = prompt('Item name:', item.name);
                                if (!newName) {return;}
                                try {
                                  const res = await fetch(`/api/inventory/items/${item.itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }), credentials: 'include' });
                                  if (!res.ok) {throw new Error('Failed');}
                                  setItems((prev) => prev.map((i) => i.itemId === item.itemId ? { ...i, name: newName } : i));
                                  success('Item updated');
                                } catch { error('Failed to update'); }
                              }} className="text-blue-600 hover:text-blue-800 mr-2" title="Edit"><Pencil className="h-3.5 w-3.5 inline" /></button>
                              <button onClick={async () => {
                                if (!confirm('Delete this item?')) {return;}
                                try {
                                  const res = await fetch(`/api/inventory/items/${item.itemId}`, { method: 'DELETE', credentials: 'include' });
                                  if (!res.ok) {throw new Error('Failed');}
                                  setItems((prev) => prev.filter((i) => i.itemId !== item.itemId));
                                  success('Item deleted');
                                } catch { error('Failed to delete'); }
                              }} className="text-red-600 hover:text-red-800" title="Delete"><Trash2 className="h-3.5 w-3.5 inline" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
              ) : (
                <Card><CardContent className="py-8 text-center text-sm text-gray-500">No inventory items yet.</CardContent></Card>
              )}
            </TabsContent>

            <TabsContent value="library" className="space-y-4">
              {books.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-600">Title</th>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-600">Author</th>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-600">ISBN</th>
                        <th className="px-4 py-2.5 text-center font-medium text-gray-600">Total</th>
                        <th className="px-4 py-2.5 text-center font-medium text-gray-600">Available</th>
                        <th className="px-4 py-2.5 text-center font-medium text-gray-600">Issued</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {books.map((book) => (
                        <tr key={book.bookId} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-900">{book.title}</td>
                          <td className="px-4 py-2.5 text-gray-600">{book.author}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{book.isbn ?? '-'}</td>
                          <td className="px-4 py-2.5 text-center font-medium">{book.totalQuantity}</td>
                          <td className="px-4 py-2.5 text-center">
                            <Badge variant={book.availableQuantity > 0 ? 'success' : 'error'} size="xs">{book.availableQuantity}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-500">{book.totalQuantity - book.availableQuantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Card><CardContent className="py-8 text-center text-sm text-gray-500">No books in library catalog. Add books via the Library module.</CardContent></Card>
              )}
              <div className="flex gap-2">
                <Button variant="outline" leftIcon={<BookOpen className="h-4 w-4" />} onClick={() => window.location.href = '/library'}>
                  Go to Library Management
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

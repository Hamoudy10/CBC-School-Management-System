'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bus, Route, Users, Plus, MapPin, Phone, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';

interface Vehicle { vehicleId: string; registrationNumber: string; make: string | null; model: string | null; capacity: number; driverName: string | null; driverPhone: string | null; status: string; }
interface Route { routeId: string; name: string; description: string | null; zone: string | null; vehicleName: string | null; }
interface Assignment { assignmentId: string; studentId: string; studentName: string; routeId: string; routeName: string; pickupPoint: string; dropoffPoint: string; fee: number | null; }

export default function TransportPage() {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [vReg, setVReg] = useState(''); const [vCapacity, setVCapacity] = useState('30');
  const [vDriver, setVDriver] = useState(''); const [vPhone, setVPhone] = useState('');
  const [rName, setRName] = useState(''); const [rZone, setRZone] = useState('');
  const [aStudent, setAStudent] = useState(''); const [aRoute, setARoute] = useState('');
  const [aPickup, setAPickup] = useState(''); const [aDropoff, setADropoff] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [vRes, rRes, aRes, sRes] = await Promise.all([
        fetch('/api/transport/vehicles', { credentials: 'include' }),
        fetch('/api/transport/routes', { credentials: 'include' }),
        fetch('/api/transport/assignments', { credentials: 'include' }),
        fetch('/api/students', { credentials: 'include' }),
      ]);
      if (vRes.ok) { const j = await vRes.json(); setVehicles(j.data ?? []); }
      if (rRes.ok) { const j = await rRes.json(); setRoutes(j.data ?? []); }
      if (aRes.ok) { const j = await aRes.json(); setAssignments(j.data ?? []); }
      if (sRes.ok) { const j = await sRes.json(); setStudents(j.data?.data ?? j.data ?? []); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addVehicle = useCallback(async () => {
    if (!vReg.trim() || !vCapacity) { error('Enter registration and capacity'); return; }
    try {
      const res = await fetch('/api/transport/vehicles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationNumber: vReg.trim(), capacity: parseInt(vCapacity), driverName: vDriver.trim() || undefined, driverPhone: vPhone.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setVehicles((prev) => [...prev, json.data]);
      setVReg(''); setVCapacity('30'); setVDriver(''); setVPhone('');
      success('Vehicle added');
    } catch (err) { error(err instanceof Error ? err.message : 'Failed'); }
  }, [vReg, vCapacity, vDriver, vPhone, success, error]);

  const addRoute = useCallback(async () => {
    if (!rName.trim()) { error('Enter route name'); return; }
    try {
      const res = await fetch('/api/transport/routes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: rName.trim(), zone: rZone.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setRoutes((prev) => [...prev, json.data]);
      setRName(''); setRZone('');
      success('Route added');
    } catch (err) { error(err instanceof Error ? err.message : 'Failed'); }
  }, [rName, rZone, success, error]);

  const assign = useCallback(async () => {
    if (!aStudent || !aRoute || !aPickup.trim() || !aDropoff.trim()) { error('Fill all fields'); return; }
    try {
      const res = await fetch('/api/transport/assignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: aStudent, routeId: aRoute, pickupPoint: aPickup.trim(), dropoffPoint: aDropoff.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setAssignments((prev) => [...prev, json.data]);
      setAStudent(''); setARoute(''); setAPickup(''); setADropoff('');
      success('Student assigned');
    } catch (err) { error(err instanceof Error ? err.message : 'Failed'); }
  }, [aStudent, aRoute, aPickup, aDropoff, success, error]);

  return (
    <div className="space-y-6">
      <PageHeader title="Transport Management" description="Manage vehicles, routes, and student transport assignments" icon={<Bus className="h-6 w-6" />} />

      {loading ? (
        <Card><CardContent className="py-12 text-center"><Spinner size="lg" /></CardContent></Card>
      ) : (
        <Tabs defaultValue="vehicles">
          <TabsList>
            <TabsTrigger value="vehicles"><Bus className="h-4 w-4 mr-1" /> Vehicles ({vehicles.length})</TabsTrigger>
            <TabsTrigger value="routes"><Route className="h-4 w-4 mr-1" /> Routes ({routes.length})</TabsTrigger>
            <TabsTrigger value="assignments"><Users className="h-4 w-4 mr-1" /> Assignments ({assignments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Add Vehicle</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="w-52"><label className="block text-xs font-medium text-gray-600 mb-1">Registration *</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g., KCB 123A" value={vReg} onChange={(e) => setVReg(e.target.value)} /></div>
                <div className="w-20"><label className="block text-xs font-medium text-gray-600 mb-1">Capacity</label><input type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={vCapacity} onChange={(e) => setVCapacity(e.target.value)} /></div>
                <div className="w-44"><label className="block text-xs font-medium text-gray-600 mb-1">Driver Name</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Driver name" value={vDriver} onChange={(e) => setVDriver(e.target.value)} /></div>
                <div className="w-40"><label className="block text-xs font-medium text-gray-600 mb-1">Driver Phone</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="07XX XXX XXX" value={vPhone} onChange={(e) => setVPhone(e.target.value)} /></div>
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={addVehicle}>Add</Button>
              </CardContent>
            </Card>
            {vehicles.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {vehicles.map((v) => (
                  <Card key={v.vehicleId}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{v.registrationNumber}</p>
                          <p className="text-xs text-gray-500">{v.make ?? ''} {v.model ?? ''}</p>
                        </div>
                        <Badge variant={v.status === 'active' ? 'success' : v.status === 'maintenance' ? 'warning' : 'default'} size="xs">{v.status}</Badge>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {v.capacity} seats</span>
                        {v.driverName && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {v.driverName}</span>}
                        {v.driverPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {v.driverPhone}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="routes" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Add Route</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]"><label className="block text-xs font-medium text-gray-600 mb-1">Route Name *</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g., Kasarani Route" value={rName} onChange={(e) => setRName(e.target.value)} /></div>
                <div className="w-44"><label className="block text-xs font-medium text-gray-600 mb-1">Zone</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g., Zone A" value={rZone} onChange={(e) => setRZone(e.target.value)} /></div>
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={addRoute}>Add</Button>
              </CardContent>
            </Card>
            {routes.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {routes.map((r) => (
                  <Card key={r.routeId}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{r.name}</p>
                          {r.zone && <Badge variant="default" size="xs">{r.zone}</Badge>}
                        </div>
                        {r.vehicleName && <Badge variant="info" size="xs">{r.vehicleName}</Badge>}
                      </div>
                      {r.description && <p className="mt-1 text-xs text-gray-500">{r.description}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Assign Student to Route</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="w-52"><label className="block text-xs font-medium text-gray-600 mb-1">Student *</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={aStudent} onChange={(e) => setAStudent(e.target.value)}>
                    <option value="">Select student</option>
                    {students.map((s: any) => (
                      <option key={s.studentId ?? s.student_id} value={s.studentId ?? s.student_id}>
                        {s.firstName ?? s.first_name} {s.lastName ?? s.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-44"><label className="block text-xs font-medium text-gray-600 mb-1">Route *</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={aRoute} onChange={(e) => setARoute(e.target.value)}>
                    <option value="">Select route</option>
                    {routes.map((r) => <option key={r.routeId} value={r.routeId}>{r.name}</option>)}
                  </select>
                </div>
                <div className="w-44"><label className="block text-xs font-medium text-gray-600 mb-1">Pickup Point *</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g., Kahawa West" value={aPickup} onChange={(e) => setAPickup(e.target.value)} /></div>
                <div className="w-44"><label className="block text-xs font-medium text-gray-600 mb-1">Drop-off *</label><input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g., School" value={aDropoff} onChange={(e) => setADropoff(e.target.value)} /></div>
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={assign}>Assign</Button>
              </CardContent>
            </Card>
            {assignments.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-600">Student</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-600">Route</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-600">Pickup</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-600">Drop-off</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {assignments.map((a) => (
                      <tr key={a.assignmentId} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{a.studentName}</td>
                        <td className="px-4 py-2.5"><Badge variant="info" size="xs">{a.routeName}</Badge></td>
                        <td className="px-4 py-2.5 text-gray-600"><MapPin className="inline h-3 w-3 mr-1" />{a.pickupPoint}</td>
                        <td className="px-4 py-2.5 text-gray-600"><MapPin className="inline h-3 w-3 mr-1" />{a.dropoffPoint}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

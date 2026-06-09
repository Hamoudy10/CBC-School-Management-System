'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LayoutGrid, Plus, Trash2, Printer, MapPin, Users, Shuffle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';

interface ExamRoom { roomId: string; name: string; capacity: number; building: string | null; floor: string | null; }
interface SeatingAssignment { studentId: string; studentName: string; admissionNumber: string; roomName: string; seatNumber: number; rowNumber: number; columnNumber: number; }
interface RoomChart { room: ExamRoom; columns: number; rows: number; assignments: SeatingAssignment[]; }
interface SeatingChart { plan: any; rooms: RoomChart[]; }

export default function ExamSeatingPage() {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [examSets, setExamSets] = useState<any[]>([]);
  const [chart, setChart] = useState<SeatingChart | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState('30');
  const [newRoomBuilding, setNewRoomBuilding] = useState('');
  const [selectedExamSet, setSelectedExamSet] = useState('');
  const [seatsPerRow, setSeatsPerRow] = useState('4');

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/exams/seating/rooms', { credentials: 'include' });
      if (res.ok) { const json = await res.json(); setRooms(json.data ?? []); }
    } catch {} finally { setLoadingRooms(false); }
  }, []);

  const fetchExamSets = useCallback(async () => {
    try {
      const res = await fetch('/api/exams/sets', { credentials: 'include' });
      if (res.ok) { const json = await res.json(); setExamSets(json.data ?? []); }
    } catch {}
  }, []);

  useEffect(() => { fetchRooms(); fetchExamSets(); }, [fetchRooms, fetchExamSets]);

  const addRoom = useCallback(async () => {
    if (!newRoomName.trim() || !newRoomCapacity) { error('Enter room name and capacity'); return; }
    try {
      const res = await fetch('/api/exams/seating/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName.trim(), capacity: parseInt(newRoomCapacity), building: newRoomBuilding.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setRooms((prev) => [...prev, json.data]);
      setNewRoomName(''); setNewRoomCapacity('30'); setNewRoomBuilding('');
      success('Room added');
    } catch (err) { error(err instanceof Error ? err.message : 'Failed'); }
  }, [newRoomName, newRoomCapacity, newRoomBuilding, success, error]);

  const deleteRoom = useCallback(async (roomId: string) => {
    try {
      await fetch(`/api/exams/seating/rooms/${roomId}`, { method: 'DELETE' });
      setRooms((prev) => prev.filter((r) => r.roomId !== roomId));
      success('Room removed');
    } catch { error('Failed to delete room'); }
  }, [success, error]);

  const generatePlan = useCallback(async () => {
    if (!selectedExamSet) { error('Select an exam set'); return; }
    const selectedRoomIds = rooms.map((r) => r.roomId);
    if (selectedRoomIds.length === 0) { error('Add at least one room'); return; }

    setGenerating(true); setChart(null);
    try {
      const res = await fetch('/api/exams/seating/plans', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examSetId: selectedExamSet, roomIds: selectedRoomIds, seatsPerRow: parseInt(seatsPerRow) || 4, shuffleStudents: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setChart(json.data);
      success('Seating plan generated');
    } catch (err) { error(err instanceof Error ? err.message : 'Failed'); }
    finally { setGenerating(false); }
  }, [selectedExamSet, rooms, seatsPerRow, success, error]);

  const totalSeats = rooms.reduce((sum, r) => sum + r.capacity, 0);
  const filledSeats = chart?.rooms.reduce((sum, r) => sum + r.assignments.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Exam Seating Planner" description="Manage rooms and generate seating arrangements" icon={<LayoutGrid className="h-6 w-6" />} />

      <Tabs defaultValue="rooms">
        <TabsList>
          <TabsTrigger value="rooms"><MapPin className="h-4 w-4 mr-1" /> Exam Rooms ({rooms.length})</TabsTrigger>
          <TabsTrigger value="generate"><Shuffle className="h-4 w-4 mr-1" /> Generate Plan</TabsTrigger>
          {chart && <TabsTrigger value="chart"><LayoutGrid className="h-4 w-4 mr-1" /> Seating Chart</TabsTrigger>}
        </TabsList>

        <TabsContent value="rooms" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Add Exam Room</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Room Name *</label>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g., Hall A, Room 12" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} />
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium text-gray-600 mb-1">Capacity</label>
                <input type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={newRoomCapacity} onChange={(e) => setNewRoomCapacity(e.target.value)} />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Building (optional)</label>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g., Main Block" value={newRoomBuilding} onChange={(e) => setNewRoomBuilding(e.target.value)} />
              </div>
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={addRoom}>Add Room</Button>
            </CardContent>
          </Card>

          {loadingRooms ? (
            <Card><CardContent className="py-8 text-center"><Spinner /></CardContent></Card>
          ) : rooms.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-gray-500">No exam rooms added yet.</CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <Card key={room.roomId}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{room.name}</p>
                        <p className="text-xs text-gray-500">{room.building ?? ''} {room.floor ?? ''}</p>
                      </div>
                      <Badge variant="info" size="sm">{room.capacity} seats</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500">{room.capacity} students max</span>
                    </div>
                    <div className="mt-3">
                      <Button variant="outline" size="sm" leftIcon={<Trash2 className="h-3 w-3" />} onClick={() => deleteRoom(room.roomId)}>
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Generate Seating Plan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Exam Set *</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={selectedExamSet} onChange={(e) => setSelectedExamSet(e.target.value)}>
                    <option value="">Select exam set</option>
                    {examSets.map((es: any) => (
                      <option key={es.exam_set_id ?? es.id} value={es.exam_set_id ?? es.id}>{es.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Seats per Row</label>
                  <input type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={seatsPerRow} onChange={(e) => setSeatsPerRow(e.target.value)} min={2} max={10} />
                </div>
                <div className="flex items-end">
                  <div className="rounded-lg bg-gray-50 p-3 w-full">
                    <p className="text-xs text-gray-500">Total capacity: <strong>{totalSeats}</strong> seats in <strong>{rooms.length}</strong> rooms</p>
                  </div>
                </div>
              </div>
              <Button leftIcon={<Shuffle className="h-4 w-4" />} onClick={generatePlan} loading={generating} disabled={!selectedExamSet || rooms.length === 0}>
                Generate & Shuffle Students
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {chart && (
          <TabsContent value="chart" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <LayoutGrid className="h-5 w-5" />
                  {chart.plan.examSetName} — {chart.plan.className}
                  <Badge variant="info" size="sm">{filledSeats} students</Badge>
                  <Badge variant="info" size="sm">{chart.rooms.length} rooms</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {chart.rooms.map((rc) => (
                  <div key={rc.room.roomId}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">{rc.room.name} <span className="text-gray-500 font-normal">({rc.assignments.length} students, {rc.room.capacity} capacity)</span></h3>
                      <Button variant="outline" size="sm" leftIcon={<Printer className="h-3 w-3" />} onClick={() => window.print()}>Print</Button>
                    </div>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-2 py-1.5 text-left font-medium text-gray-600">Seat</th>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-600">Row</th>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-600">Student</th>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-600">Adm No</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rc.assignments.map((a) => (
                            <tr key={`${a.seatNumber}`} className="hover:bg-gray-50">
                              <td className="px-2 py-1.5 font-medium">{a.seatNumber}</td>
                              <td className="px-2 py-1.5 text-gray-600">{a.rowNumber}-{a.columnNumber}</td>
                              <td className="px-2 py-1.5">{a.studentName}</td>
                              <td className="px-2 py-1.5 text-gray-500">{a.admissionNumber}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                <Button variant="outline" leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
                  Print All Seating Charts
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

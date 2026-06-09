import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AuthUser } from '@/types/auth';
import type { LibraryBook, BorrowingRecord, InventoryItem } from '../types';

export async function listBooks(schoolId: string): Promise<LibraryBook[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('library_books').select('*').eq('school_id', schoolId).order('title');
  return (data ?? []).map(mapBook);
}

export async function createBook(input: any, schoolId: string): Promise<LibraryBook> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('library_books').insert({
    school_id: schoolId, isbn: input.isbn || null, title: input.title, author: input.author,
    publisher: input.publisher || null, year: input.year || null,
    total_quantity: input.totalQuantity ?? 1, available_quantity: input.totalQuantity ?? 1,
    category: input.category || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return mapBook(data);
}

export async function issueBook(input: any, schoolId: string): Promise<BorrowingRecord> {
  const supabase = await createSupabaseServerClient();
  const { data: book } = await supabase.from('library_books').select('available_quantity').eq('book_id', input.bookId).eq('school_id', schoolId).single();
  if (!book || book.available_quantity < 1) throw new Error('No copies available');

  const { data, error } = await supabase.from('library_borrowing').insert({
    school_id: schoolId, book_id: input.bookId, user_id: input.userId,
    borrowed_at: new Date().toISOString(), due_date: input.dueDate,
  }).select('*, library_books!inner(title), users!inner(first_name, last_name)').single();
  if (error) throw new Error(error.message);

  await supabase.from('library_books').update({ available_quantity: book.available_quantity - 1 }).eq('book_id', input.bookId);

  return mapBorrowing(data);
}

export async function returnBook(input: any, schoolId: string): Promise<BorrowingRecord> {
  const supabase = await createSupabaseServerClient();
  const { data: borrow } = await supabase.from('library_borrowing').select('book_id').eq('borrow_id', input.borrowId).eq('school_id', schoolId).single();
  if (!borrow) throw new Error('Borrowing record not found');

  const { data, error } = await supabase.from('library_borrowing').update({
    returned_at: new Date().toISOString(), condition: input.condition || null,
  }).eq('borrow_id', input.borrowId).select('*, library_books!inner(title), users!inner(first_name, last_name)').single();
  if (error) throw new Error(error.message);

  await supabase.rpc('increment_book_available', { p_book_id: borrow.book_id });
  return mapBorrowing(data);
}

export async function listBorrowings(schoolId: string): Promise<BorrowingRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('library_borrowing')
    .select('*, library_books!inner(title), users!inner(first_name, last_name)')
    .eq('school_id', schoolId)
    .order('borrowed_at', { ascending: false });
  return (data ?? []).map(mapBorrowing);
}

export async function listInventory(schoolId: string): Promise<InventoryItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('school_inventory').select('*').eq('school_id', schoolId).order('name');
  return (data ?? []).map(mapInventory);
}

export async function createInventoryItem(input: any, schoolId: string): Promise<InventoryItem> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('school_inventory').insert({
    school_id: schoolId, name: input.name, category: input.category,
    quantity: input.quantity ?? 1, condition: input.condition || null,
    location: input.location || null, assigned_to: input.assignedTo || null,
    notes: input.notes || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return mapInventory(data);
}

function mapBook(r: any): LibraryBook {
  return { bookId: r.book_id, schoolId: r.school_id, isbn: r.isbn ?? null, title: r.title, author: r.author, publisher: r.publisher ?? null, year: r.year ?? null, totalQuantity: r.total_quantity, availableQuantity: r.available_quantity, category: r.category ?? null };
}
function mapBorrowing(r: any): BorrowingRecord {
  const now = new Date();
  const dueDate = new Date(r.due_date);
  const isOverdue = !r.returned_at && dueDate < now;
  return { borrowId: r.borrow_id, schoolId: r.school_id, bookId: r.book_id, bookTitle: r.library_books?.title ?? '', userId: r.user_id, userName: r.users ? `${r.users.first_name} ${r.users.last_name}`.trim() : '', borrowedAt: r.borrowed_at, dueDate: r.due_date, returnedAt: r.returned_at ?? null, condition: r.condition ?? null, status: r.returned_at ? 'returned' : isOverdue ? 'overdue' : 'active' };
}
function mapInventory(r: any): InventoryItem {
  return { itemId: r.item_id, schoolId: r.school_id, name: r.name, category: r.category, quantity: r.quantity, condition: r.condition ?? null, location: r.location ?? null, assignedTo: r.assigned_to ?? null, notes: r.notes ?? null };
}

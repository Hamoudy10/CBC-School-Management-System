import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { LibraryBook, BorrowingRecord, InventoryItem, BookCategory, Reservation, LibraryFine, BookRequest, LibraryDashboardStats } from '../types';

// ─── BOOKS ─────────────────────────────────────────────────

export async function listBooks(schoolId: string): Promise<LibraryBook[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('library_books').select('*').eq('school_id', schoolId).order('title');
  return (data ?? []).map(mapBook);
}

export async function getBook(bookId: string, schoolId: string): Promise<LibraryBook | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('library_books').select('*').eq('book_id', bookId).eq('school_id', schoolId).maybeSingle();
  return data ? mapBook(data) : null;
}

export async function createBook(input: any, schoolId: string): Promise<LibraryBook> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('library_books').insert({
    school_id: schoolId, isbn: input.isbn || null, title: input.title, author: input.author,
    publisher: input.publisher || null, year: input.year || null,
    total_quantity: input.totalQuantity ?? 1, available_quantity: input.totalQuantity ?? 1,
    category: input.category || null, genre: input.genre || null,
    barcode: input.barcode || null, shelf_location: input.shelfLocation || null,
    description: input.description || null, cover_url: input.coverUrl || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return mapBook(data);
}

export async function updateBook(bookId: string, input: any, schoolId: string): Promise<LibraryBook> {
  const supabase = await createSupabaseServerClient();
  const updates: any = {};
  if (input.isbn !== undefined) updates.isbn = input.isbn;
  if (input.title !== undefined) updates.title = input.title;
  if (input.author !== undefined) updates.author = input.author;
  if (input.publisher !== undefined) updates.publisher = input.publisher;
  if (input.year !== undefined) updates.year = input.year;
  if (input.totalQuantity !== undefined) {
    updates.total_quantity = input.totalQuantity;
    const { data: book } = await supabase.from('library_books').select('total_quantity, available_quantity').eq('book_id', bookId).eq('school_id', schoolId).single();
    const diff = input.totalQuantity - (book?.total_quantity ?? 0);
    updates.available_quantity = (book?.available_quantity ?? 0) + diff;
  }
  if (input.category !== undefined) updates.category = input.category;
  if (input.genre !== undefined) updates.genre = input.genre;
  if (input.barcode !== undefined) updates.barcode = input.barcode;
  if (input.shelfLocation !== undefined) updates.shelf_location = input.shelfLocation;
  if (input.description !== undefined) updates.description = input.description;
  if (input.coverUrl !== undefined) updates.cover_url = input.coverUrl;
  const { data, error } = await supabase.from('library_books').update(updates).eq('book_id', bookId).eq('school_id', schoolId).select().single();
  if (error) throw new Error(error.message);
  return mapBook(data);
}

// ─── BORROWING ──────────────────────────────────────────────

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

// ─── INVENTORY ──────────────────────────────────────────────

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
    notes: input.notes || null, barcode: input.barcode || null,
    barcode_format: input.barcodeFormat || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return mapInventory(data);
}

export async function updateInventoryItem(itemId: string, input: any, schoolId: string): Promise<InventoryItem> {
  const supabase = await createSupabaseServerClient();
  const updates: any = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.category !== undefined) updates.category = input.category;
  if (input.quantity !== undefined) updates.quantity = input.quantity;
  if (input.condition !== undefined) updates.condition = input.condition;
  if (input.location !== undefined) updates.location = input.location;
  if (input.assignedTo !== undefined) updates.assigned_to = input.assignedTo;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.barcode !== undefined) updates.barcode = input.barcode;
  if (input.barcodeFormat !== undefined) updates.barcode_format = input.barcodeFormat;
  const { data, error } = await supabase.from('school_inventory').update(updates).eq('item_id', itemId).eq('school_id', schoolId).select().single();
  if (error) throw new Error(error.message);
  return mapInventory(data);
}

export async function deleteInventoryItem(itemId: string, schoolId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('school_inventory').delete().eq('item_id', itemId).eq('school_id', schoolId);
  if (error) throw new Error(error.message);
}

// ─── CATEGORIES ─────────────────────────────────────────────

export async function listCategories(schoolId: string): Promise<BookCategory[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('book_categories').select('*').eq('school_id', schoolId).order('name');
  return (data ?? []).map((r: any) => ({ categoryId: r.category_id, schoolId: r.school_id, name: r.name, description: r.description }));
}

export async function createCategory(input: any, schoolId: string): Promise<BookCategory> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('book_categories').insert({ school_id: schoolId, name: input.name, description: input.description || null }).select().single();
  if (error) throw new Error(error.message);
  return { categoryId: data.category_id, schoolId: data.school_id, name: data.name, description: data.description };
}

export async function deleteCategory(categoryId: string, schoolId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('book_categories').delete().eq('category_id', categoryId).eq('school_id', schoolId);
  if (error) throw new Error(error.message);
}

// ─── RESERVATIONS ───────────────────────────────────────────

export async function listReservations(schoolId: string): Promise<Reservation[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('library_reservations')
    .select('*, library_books!inner(title), users!inner(first_name, last_name)')
    .eq('school_id', schoolId).order('reserved_at', { ascending: false });
  return (data ?? []).map((r: any) => ({
    reservationId: r.reservation_id, schoolId: r.school_id, bookId: r.book_id,
    bookTitle: r.library_books?.title ?? '', userId: r.user_id,
    userName: r.users ? `${r.users.first_name} ${r.users.last_name}`.trim() : '',
    status: r.status, reservedAt: r.reserved_at, expiresAt: r.expires_at,
    fulfilledAt: r.fulfilled_at, notified: r.notified,
  }));
}

export async function createReservation(input: any, schoolId: string): Promise<Reservation> {
  const supabase = await createSupabaseServerClient();
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('library_reservations').insert({
    school_id: schoolId, book_id: input.bookId, user_id: input.userId,
    reserved_at: new Date().toISOString(), expires_at: expiresAt,
  }).select().single();
  if (error) throw new Error(error.message);
  return { reservationId: data.reservation_id, schoolId: data.school_id, bookId: data.book_id, userId: data.user_id, userName: '', bookTitle: '', status: data.status, reservedAt: data.reserved_at, expiresAt: data.expires_at, fulfilledAt: data.fulfilled_at, notified: data.notified };
}

export async function cancelReservation(reservationId: string, schoolId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.from('library_reservations').update({ status: 'cancelled' }).eq('reservation_id', reservationId).eq('school_id', schoolId);
}

// ─── FINES ──────────────────────────────────────────────────

export async function listFines(schoolId: string): Promise<LibraryFine[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('library_fines')
    .select('*, users!inner(first_name, last_name)')
    .eq('school_id', schoolId).order('issued_at', { ascending: false });
  return (data ?? []).map((r: any) => ({
    fineId: r.fine_id, schoolId: r.school_id, borrowId: r.borrow_id,
    userId: r.user_id, userName: r.users ? `${r.users.first_name} ${r.users.last_name}`.trim() : '',
    amount: r.amount, reason: r.reason, status: r.status,
    issuedAt: r.issued_at, paidAt: r.paid_at, waivedBy: r.waived_by,
  }));
}

export async function createFine(input: any, schoolId: string): Promise<LibraryFine> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('library_fines').insert({
    school_id: schoolId, borrow_id: input.borrowId, user_id: input.userId,
    amount: input.amount, reason: input.reason || 'overdue',
  }).select().single();
  if (error) throw new Error(error.message);
  return { fineId: data.fine_id, schoolId: data.school_id, borrowId: data.borrow_id, userId: data.user_id, userName: '', amount: data.amount, reason: data.reason, status: data.status, issuedAt: data.issued_at, paidAt: data.paid_at, waivedBy: data.waived_by };
}

export async function payFine(fineId: string, schoolId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.from('library_fines').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('fine_id', fineId).eq('school_id', schoolId);
}

// ─── BOOK REQUESTS ──────────────────────────────────────────

export async function listBookRequests(schoolId: string): Promise<BookRequest[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('book_requests')
    .select('*, users!inner(first_name, last_name)')
    .eq('school_id', schoolId).order('created_at', { ascending: false });
  return (data ?? []).map((r: any) => ({
    requestId: r.request_id, schoolId: r.school_id, userId: r.user_id,
    userName: r.users ? `${r.users.first_name} ${r.users.last_name}`.trim() : '',
    title: r.title, author: r.author, isbn: r.isbn, reason: r.reason,
    status: r.status, createdAt: r.created_at, updatedAt: r.updated_at, reviewedBy: r.reviewed_by,
  }));
}

export async function createBookRequest(input: any, schoolId: string, userId: string): Promise<BookRequest> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('book_requests').insert({
    school_id: schoolId, user_id: userId, title: input.title,
    author: input.author || null, isbn: input.isbn || null, reason: input.reason || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return { requestId: data.request_id, schoolId: data.school_id, userId: data.user_id, userName: '', title: data.title, author: data.author, isbn: data.isbn, reason: data.reason, status: data.status, createdAt: data.created_at, updatedAt: data.updated_at, reviewedBy: data.reviewed_by };
}

export async function reviewBookRequest(requestId: string, status: string, schoolId: string, reviewedBy: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.from('book_requests').update({ status, updated_at: new Date().toISOString(), reviewed_by: reviewedBy }).eq('request_id', requestId).eq('school_id', schoolId);
}

// ─── DASHBOARD STATS ────────────────────────────────────────

export async function getLibraryDashboardStats(schoolId: string): Promise<LibraryDashboardStats> {
  const supabase = await createSupabaseServerClient();
  const [booksRes, borrowRes, finesRes, requestsRes, popularRes, catRes] = await Promise.all([
    supabase.from('library_books').select('total_quantity, available_quantity').eq('school_id', schoolId),
    supabase.from('library_borrowing').select('due_date, returned_at, book_id, library_books!inner(title)').eq('school_id', schoolId),
    supabase.from('library_fines').select('amount, status').eq('school_id', schoolId),
    supabase.from('book_requests').select('request_id').eq('school_id', schoolId).eq('status', 'pending'),
    supabase.from('library_borrowing').select('book_id, library_books!inner(title)').eq('school_id', schoolId).not('returned_at', 'is', null),
    supabase.from('library_books').select('category').eq('school_id', schoolId),
  ]);

  const books = booksRes.data ?? [];
  const borrowings = borrowRes.data ?? [];
  const fines = finesRes.data ?? [];
  const totalBooks = books.reduce((s, b: any) => s + (b.total_quantity ?? 0), 0);
  const availableBooks = books.reduce((s, b: any) => s + (b.available_quantity ?? 0), 0);
  const now = new Date();
  const overdueBooks = borrowings.filter((b: any) => !b.returned_at && new Date(b.due_date) < now).length;
  const borrowedBooks = borrowings.filter((b: any) => !b.returned_at).length;

  const popularMap = new Map<string, { title: string; count: number }>();
  borrowings.filter((b: any) => b.returned_at).forEach((b: any) => {
    const id = b.book_id;
    const title = b.library_books?.title ?? 'Unknown';
    if (!popularMap.has(id)) popularMap.set(id, { title, count: 0 });
    popularMap.get(id)!.count++;
  });
  const popularBooks = [...popularMap.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  const catMap = new Map<string, number>();
  books.forEach((b: any) => {
    const cat = b.category || 'Uncategorized';
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
  });
  const categoryDistribution = [...catMap.entries()].map(([name, count]) => ({ name, count }));

  return {
    totalBooks, availableBooks, borrowedBooks, overdueBooks,
    activeMembers: new Set(borrowings.map((b: any) => b.user_id)).size,
    pendingFines: fines.filter((f: any) => f.status === 'pending').length,
    totalFinesAmount: fines.filter((f: any) => f.status === 'pending').reduce((s, f: any) => s + (f.amount ?? 0), 0),
    pendingRequests: requestsRes.count ?? 0,
    popularBooks, categoryDistribution,
  };
}

// ─── SCAN ───────────────────────────────────────────────────

export async function findByBarcode(barcode: string, schoolId: string): Promise<InventoryItem | LibraryBook | null> {
  const supabase = await createSupabaseServerClient();
  const { data: inv } = await supabase.from('school_inventory').select('*').eq('barcode', barcode).eq('school_id', schoolId).maybeSingle();
  if (inv) return mapInventory(inv);
  const { data: book } = await supabase.from('library_books').select('*').eq('barcode', barcode).eq('school_id', schoolId).maybeSingle();
  if (book) return mapBook(book);
  return null;
}

// ─── MAPPERS ────────────────────────────────────────────────

function mapBook(r: any): LibraryBook {
  return {
    bookId: r.book_id, schoolId: r.school_id, isbn: r.isbn ?? null,
    title: r.title, author: r.author, publisher: r.publisher ?? null,
    year: r.year ?? null, totalQuantity: r.total_quantity,
    availableQuantity: r.available_quantity, category: r.category ?? null,
    genre: r.genre ?? null, barcode: r.barcode ?? null,
    shelfLocation: r.shelf_location ?? null, description: r.description ?? null,
    coverUrl: r.cover_url ?? null,
  };
}

function mapBorrowing(r: any): BorrowingRecord {
  const now = new Date();
  const dueDate = new Date(r.due_date);
  const isOverdue = !r.returned_at && dueDate < now;
  return {
    borrowId: r.borrow_id, schoolId: r.school_id, bookId: r.book_id,
    bookTitle: r.library_books?.title ?? '',
    userId: r.user_id, userName: r.users ? `${r.users.first_name} ${r.users.last_name}`.trim() : '',
    borrowedAt: r.borrowed_at, dueDate: r.due_date,
    returnedAt: r.returned_at ?? null, condition: r.condition ?? null,
    status: r.returned_at ? 'returned' : isOverdue ? 'overdue' : 'active',
  };
}

function mapInventory(r: any): InventoryItem {
  return {
    itemId: r.item_id, schoolId: r.school_id, name: r.name,
    category: r.category, quantity: r.quantity, condition: r.condition ?? null,
    location: r.location ?? null, assignedTo: r.assigned_to ?? null,
    notes: r.notes ?? null, barcode: r.barcode ?? null,
    barcodeFormat: r.barcode_format ?? null,
  };
}


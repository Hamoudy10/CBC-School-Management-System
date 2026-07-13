export interface LibraryBook {
  bookId: string;
  schoolId: string;
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  year: number | null;
  totalQuantity: number;
  availableQuantity: number;
  category: string | null;
  genre: string | null;
  barcode: string | null;
  shelfLocation: string | null;
  description: string | null;
  coverUrl: string | null;
}

export interface BorrowingRecord {
  borrowId: string;
  schoolId: string;
  bookId: string;
  bookTitle?: string;
  userId: string;
  userName?: string;
  borrowedAt: string;
  dueDate: string;
  returnedAt: string | null;
  condition: string | null;
  status: 'active' | 'returned' | 'overdue';
}

export interface InventoryItem {
  itemId: string;
  schoolId: string;
  name: string;
  category: string;
  quantity: number;
  condition: string | null;
  location: string | null;
  assignedTo: string | null;
  notes: string | null;
  barcode: string | null;
  barcodeFormat: string | null;
}

export interface BookCategory {
  categoryId: string;
  schoolId: string;
  name: string;
  description: string | null;
}

export interface Reservation {
  reservationId: string;
  schoolId: string;
  bookId: string;
  bookTitle?: string;
  userId: string;
  userName?: string;
  status: 'active' | 'fulfilled' | 'cancelled';
  reservedAt: string;
  expiresAt: string;
  fulfilledAt: string | null;
  notified: boolean;
}

export interface LibraryFine {
  fineId: string;
  schoolId: string;
  borrowId: string | null;
  userId: string;
  userName?: string;
  amount: number;
  reason: string;
  status: 'pending' | 'paid' | 'waived';
  issuedAt: string;
  paidAt: string | null;
  waivedBy: string | null;
}

export interface BookRequest {
  requestId: string;
  schoolId: string;
  userId: string;
  userName?: string;
  title: string;
  author: string | null;
  isbn: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'ordered' | 'rejected';
  createdAt: string;
  updatedAt: string | null;
  reviewedBy: string | null;
}

export interface LibraryDashboardStats {
  totalBooks: number;
  availableBooks: number;
  borrowedBooks: number;
  overdueBooks: number;
  activeMembers: number;
  pendingFines: number;
  totalFinesAmount: number;
  pendingRequests: number;
  popularBooks: { title: string; count: number }[];
  categoryDistribution: { name: string; count: number }[];
}

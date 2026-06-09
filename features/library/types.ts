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
}

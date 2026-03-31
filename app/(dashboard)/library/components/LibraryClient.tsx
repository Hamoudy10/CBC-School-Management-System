'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  BookPlus,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils';

type TabType = 'overview' | 'catalog' | 'borrowing' | 'returns';
type VisibleTab = {
  key: TabType;
  label: string;
  allowed: boolean;
};

type BorrowerType = 'student' | 'staff';
type BookCondition = 'good' | 'damaged' | 'lost';

interface LibraryBook {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  shelf: string;
  totalCopies: number;
  description: string;
  createdAt: string;
}

interface BorrowingRecord {
  id: string;
  bookId: string;
  borrowerType: BorrowerType;
  borrowerName: string;
  borrowerReference: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  createdAt: string;
  returnedAt: string | null;
}

interface ReturnRecord {
  id: string;
  borrowingId: string;
  bookId: string;
  returnDate: string;
  condition: BookCondition;
  fineAmount: number;
  notes: string;
  createdAt: string;
}

interface AddBookFormState {
  title: string;
  author: string;
  isbn: string;
  category: string;
  shelf: string;
  totalCopies: string;
  description: string;
}

interface IssueBookFormState {
  bookId: string;
  borrowerType: BorrowerType;
  borrowerName: string;
  borrowerReference: string;
  issueDate: string;
  dueDate: string;
  notes: string;
}

interface ReturnBookFormState {
  borrowingId: string;
  returnDate: string;
  condition: BookCondition;
  fineAmount: string;
  notes: string;
}

interface LibrarySnapshot {
  books: LibraryBook[];
  borrowings: BorrowingRecord[];
  returns: ReturnRecord[];
}

const DEFAULT_BOOK_FORM: AddBookFormState = {
  title: '',
  author: '',
  isbn: '',
  category: '',
  shelf: '',
  totalCopies: '1',
  description: '',
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function createDefaultIssueForm(bookId = ''): IssueBookFormState {
  const today = todayString();
  return {
    bookId,
    borrowerType: 'student',
    borrowerName: '',
    borrowerReference: '',
    issueDate: today,
    dueDate: today,
    notes: '',
  };
}

function createDefaultReturnForm(borrowingId = ''): ReturnBookFormState {
  return {
    borrowingId,
    returnDate: todayString(),
    condition: 'good',
    fineAmount: '0',
    notes: '',
  };
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function parseStoredLibraryState(rawValue: string | null): LibrarySnapshot {
  if (!rawValue) {
    return { books: [], borrowings: [], returns: [] };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<LibrarySnapshot>;
    return {
      books: Array.isArray(parsed.books) ? parsed.books : [],
      borrowings: Array.isArray(parsed.borrowings) ? parsed.borrowings : [],
      returns: Array.isArray(parsed.returns) ? parsed.returns : [],
    };
  } catch {
    return { books: [], borrowings: [], returns: [] };
  }
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function isPastDue(date: string) {
  const today = new Date(`${todayString()}T00:00:00`);
  const dueDate = new Date(`${date}T00:00:00`);
  return dueDate < today;
}

function getBookStatus(availableCopies: number, totalCopies: number) {
  if (totalCopies <= 0) {
    return { label: 'Unavailable', variant: 'error' as const };
  }
  if (availableCopies <= 0) {
    return { label: 'Fully Issued', variant: 'warning' as const };
  }
  return { label: 'Available', variant: 'success' as const };
}

function getBorrowingStatus(record: BorrowingRecord) {
  if (record.returnedAt) {
    return { label: 'Returned', variant: 'success' as const };
  }
  if (isPastDue(record.dueDate)) {
    return { label: 'Overdue', variant: 'error' as const };
  }
  return { label: 'Active', variant: 'info' as const };
}

export function LibraryClient() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [borrowings, setBorrowings] = useState<BorrowingRecord[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');

  const [addBookOpen, setAddBookOpen] = useState(false);
  const [issueBookOpen, setIssueBookOpen] = useState(false);
  const [returnBookOpen, setReturnBookOpen] = useState(false);

  const [bookForm, setBookForm] = useState<AddBookFormState>(DEFAULT_BOOK_FORM);
  const [issueForm, setIssueForm] = useState<IssueBookFormState>(createDefaultIssueForm());
  const [returnForm, setReturnForm] = useState<ReturnBookFormState>(createDefaultReturnForm());

  const [isHydrated, setIsHydrated] = useState(false);

  const { user, checkPermission } = useAuth();
  const { success, error: toastError, info } = useToast();

  const canView = checkPermission('library', 'view');
  const canManage =
    checkPermission('library', 'create') ||
    checkPermission('library', 'update') ||
    checkPermission('library', 'delete');

  const storageKey = useMemo(() => {
    const scope = user?.schoolId ?? user?.id ?? 'default';
    return `school-library:${scope}`;
  }, [user?.id, user?.schoolId]);
  const visibleTabs = useMemo(
    () =>
      ([
        { key: 'overview', label: 'Overview', allowed: canView },
        { key: 'catalog', label: 'Book Catalog', allowed: canView },
        { key: 'borrowing', label: 'Borrowing', allowed: canManage },
        { key: 'returns', label: 'Returns', allowed: canManage },
      ] as VisibleTab[]).filter((tab) => tab.allowed),
    [canView, canManage],
  );

  useEffect(() => {
    if (!visibleTabs.find((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key ?? 'overview');
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    const stored = parseStoredLibraryState(window.localStorage.getItem(storageKey));
    setBooks(stored.books);
    setBorrowings(stored.borrowings);
    setReturns(stored.returns);
    setIsHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        books,
        borrowings,
        returns,
      }),
    );
  }, [books, borrowings, returns, isHydrated, storageKey]);

  const activeBorrowings = useMemo(
    () => borrowings.filter((record) => !record.returnedAt),
    [borrowings],
  );

  const borrowingsByBookId = useMemo(() => {
    return activeBorrowings.reduce<Record<string, number>>((acc, record) => {
      acc[record.bookId] = (acc[record.bookId] ?? 0) + 1;
      return acc;
    }, {});
  }, [activeBorrowings]);

  const booksWithAvailability = useMemo(() => {
    return books.map((book) => {
      const checkedOutCopies = borrowingsByBookId[book.id] ?? 0;
      const availableCopies = Math.max(0, book.totalCopies - checkedOutCopies);
      return {
        ...book,
        checkedOutCopies,
        availableCopies,
      };
    });
  }, [books, borrowingsByBookId]);

  const availableBooks = useMemo(
    () => booksWithAvailability.filter((book) => book.availableCopies > 0),
    [booksWithAvailability],
  );

  const filteredBooks = useMemo(() => {
    const search = normalizeText(catalogSearch);
    if (!search) {
      return booksWithAvailability;
    }

    return booksWithAvailability.filter((book) =>
      [book.title, book.author, book.isbn, book.category, book.shelf]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(search)),
    );
  }, [booksWithAvailability, catalogSearch]);

  const activeBorrowingRows = useMemo(() => {
    return activeBorrowings
      .map((record) => ({
        ...record,
        book: books.find((book) => book.id === record.bookId) ?? null,
      }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [activeBorrowings, books]);

  const returnRows = useMemo(() => {
    return returns
      .map((record) => {
        const borrowing = borrowings.find((item) => item.id === record.borrowingId) ?? null;
        const book = books.find((item) => item.id === record.bookId) ?? null;
        return {
          ...record,
          borrowing,
          book,
        };
      })
      .sort((a, b) => b.returnDate.localeCompare(a.returnDate));
  }, [returns, borrowings, books]);

  const overdueBorrowings = useMemo(
    () => activeBorrowings.filter((record) => isPastDue(record.dueDate)),
    [activeBorrowings],
  );

  const summary = useMemo(() => {
    const totalBooks = books.reduce((sum, book) => sum + book.totalCopies, 0);
    const booksBorrowed = activeBorrowings.length;
    const overdue = overdueBorrowings.length;
    const available = booksWithAvailability.reduce(
      (sum, book) => sum + book.availableCopies,
      0,
    );

    return { totalBooks, booksBorrowed, overdue, available };
  }, [books, activeBorrowings, overdueBorrowings, booksWithAvailability]);

  const recentActivity = useMemo(() => {
    const bookEvents = books.map((book) => ({
      id: `book-${book.id}`,
      timestamp: book.createdAt,
      title: 'Book added',
      description: `${book.title} by ${book.author}`,
    }));
    const issueEvents = borrowings.map((record) => {
      const book = books.find((item) => item.id === record.bookId);
      return {
        id: `issue-${record.id}`,
        timestamp: record.createdAt,
        title: 'Book issued',
        description: `${book?.title ?? 'Book'} issued to ${record.borrowerName}`,
      };
    });
    const returnEvents = returns.map((record) => {
      const book = books.find((item) => item.id === record.bookId);
      const borrowing = borrowings.find((item) => item.id === record.borrowingId);
      return {
        id: `return-${record.id}`,
        timestamp: record.createdAt,
        title: 'Book returned',
        description: `${book?.title ?? 'Book'} returned by ${borrowing?.borrowerName ?? 'borrower'}`,
      };
    });

    return [...bookEvents, ...issueEvents, ...returnEvents]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 6);
  }, [books, borrowings, returns]);

  function openAddBookModal() {
    setActiveTab('catalog');
    setBookForm(DEFAULT_BOOK_FORM);
    setAddBookOpen(true);
  }

  function openIssueBookModal(bookId = '') {
    if (availableBooks.length === 0) {
      setActiveTab('catalog');
      toastError('No available books', 'Add a book or return an issued copy first.');
      return;
    }

    const initialBookId =
      bookId && availableBooks.some((book) => book.id === bookId) ? bookId : '';

    setActiveTab('borrowing');
    setIssueForm(createDefaultIssueForm(initialBookId));
    setIssueBookOpen(true);
  }

  function openReturnBookModal(borrowingId = '') {
    if (activeBorrowings.length === 0) {
      setActiveTab('borrowing');
      toastError('No active borrowings', 'Issue a book before processing a return.');
      return;
    }

    const initialBorrowingId =
      borrowingId && activeBorrowings.some((record) => record.id === borrowingId)
        ? borrowingId
        : activeBorrowings[0]?.id ?? '';

    setActiveTab('returns');
    setReturnForm(createDefaultReturnForm(initialBorrowingId));
    setReturnBookOpen(true);
  }

  function handleAddBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const totalCopies = Number(bookForm.totalCopies);
    if (!bookForm.title.trim() || !bookForm.author.trim()) {
      toastError('Missing details', 'Please provide both the book title and author.');
      return;
    }

    if (!Number.isFinite(totalCopies) || totalCopies < 1) {
      toastError('Invalid copies', 'Total copies must be at least 1.');
      return;
    }

    const newBook: LibraryBook = {
      id: createId('book'),
      title: bookForm.title.trim(),
      author: bookForm.author.trim(),
      isbn: bookForm.isbn.trim(),
      category: bookForm.category.trim(),
      shelf: bookForm.shelf.trim(),
      totalCopies,
      description: bookForm.description.trim(),
      createdAt: new Date().toISOString(),
    };

    setBooks((current) => [newBook, ...current]);
    setAddBookOpen(false);
    setBookForm(DEFAULT_BOOK_FORM);
    success('Book added', `"${newBook.title}" is now in the catalog.`);
  }
  function handleIssueBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedBook = booksWithAvailability.find((book) => book.id === issueForm.bookId);
    if (!selectedBook) {
      toastError('Select a book', 'Choose a book to issue.');
      return;
    }

    if (selectedBook.availableCopies <= 0) {
      toastError('No copies available', 'All copies of this book are already issued.');
      return;
    }

    if (!issueForm.borrowerName.trim()) {
      toastError('Borrower required', 'Please enter the borrower name.');
      return;
    }

    if (!issueForm.issueDate || !issueForm.dueDate) {
      toastError('Dates required', 'Please provide both issue and due dates.');
      return;
    }

    if (issueForm.dueDate < issueForm.issueDate) {
      toastError('Invalid dates', 'The due date cannot be before the issue date.');
      return;
    }

    const newBorrowing: BorrowingRecord = {
      id: createId('borrow'),
      bookId: issueForm.bookId,
      borrowerType: issueForm.borrowerType,
      borrowerName: issueForm.borrowerName.trim(),
      borrowerReference: issueForm.borrowerReference.trim(),
      issueDate: issueForm.issueDate,
      dueDate: issueForm.dueDate,
      notes: issueForm.notes.trim(),
      createdAt: new Date().toISOString(),
      returnedAt: null,
    };

    setBorrowings((current) => [newBorrowing, ...current]);
    setIssueBookOpen(false);
    setIssueForm(createDefaultIssueForm());
    success('Book issued', `"${selectedBook.title}" has been issued successfully.`);
  }

  function handleProcessReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const borrowing = activeBorrowings.find((record) => record.id === returnForm.borrowingId);
    if (!borrowing) {
      toastError('Select a borrowing', 'Choose the borrowing record to close.');
      return;
    }

    if (!returnForm.returnDate) {
      toastError('Return date required', 'Please provide the return date.');
      return;
    }

    if (returnForm.returnDate < borrowing.issueDate) {
      toastError('Invalid return date', 'Return date cannot be before the issue date.');
      return;
    }

    const fineAmount = Number(returnForm.fineAmount || '0');
    if (!Number.isFinite(fineAmount) || fineAmount < 0) {
      toastError('Invalid fine', 'Fine amount must be zero or greater.');
      return;
    }

    const returnRecord: ReturnRecord = {
      id: createId('return'),
      borrowingId: borrowing.id,
      bookId: borrowing.bookId,
      returnDate: returnForm.returnDate,
      condition: returnForm.condition,
      fineAmount,
      notes: returnForm.notes.trim(),
      createdAt: new Date().toISOString(),
    };

    setBorrowings((current) =>
      current.map((record) =>
        record.id === borrowing.id
          ? { ...record, returnedAt: returnForm.returnDate }
          : record,
      ),
    );
    setReturns((current) => [returnRecord, ...current]);
    setReturnBookOpen(false);
    setReturnForm(createDefaultReturnForm());

    const returnedBook = books.find((book) => book.id === borrowing.bookId);
    success(
      'Return processed',
      `"${returnedBook?.title ?? 'Book'}" has been marked as returned.`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && canView && (
        <LibraryOverview
          canManage={canManage}
          recentActivity={recentActivity}
          summary={summary}
          onAddBook={openAddBookModal}
          onIssueBook={() => openIssueBookModal()}
          onProcessReturn={() => openReturnBookModal()}
          onOpenReports={() =>
            info('Live summary', 'The overview cards update automatically as books move.')
          }
        />
      )}

      {activeTab === 'catalog' && canView && (
        <BookCatalog
          canManage={canManage}
          books={filteredBooks}
          search={catalogSearch}
          onSearchChange={setCatalogSearch}
          onAddBook={openAddBookModal}
          onIssueBook={openIssueBookModal}
        />
      )}

      {activeTab === 'borrowing' && canManage && (
        <BorrowingSection
          borrowings={activeBorrowingRows}
          onIssueBook={() => openIssueBookModal()}
          onProcessReturn={openReturnBookModal}
        />
      )}

      {activeTab === 'returns' && canManage && (
        <ReturnsSection
          overdueCount={overdueBorrowings.length}
          returnRows={returnRows}
          onProcessReturn={() => openReturnBookModal()}
        />
      )}

      <Modal open={addBookOpen} onClose={() => setAddBookOpen(false)} size="lg">
        <ModalHeader>
          <ModalTitle>Add Book</ModalTitle>
          <ModalDescription>Register a new book in the library catalog.</ModalDescription>
        </ModalHeader>
        <form onSubmit={handleAddBook}>
          <ModalBody className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Book Title" value={bookForm.title} onChange={(event) => setBookForm((current) => ({ ...current, title: event.target.value }))} required />
              <Input label="Author" value={bookForm.author} onChange={(event) => setBookForm((current) => ({ ...current, author: event.target.value }))} required />
              <Input label="ISBN" value={bookForm.isbn} onChange={(event) => setBookForm((current) => ({ ...current, isbn: event.target.value }))} />
              <Input label="Category" value={bookForm.category} onChange={(event) => setBookForm((current) => ({ ...current, category: event.target.value }))} />
              <Input label="Shelf / Location" value={bookForm.shelf} onChange={(event) => setBookForm((current) => ({ ...current, shelf: event.target.value }))} />
              <Input label="Total Copies" type="number" min="1" value={bookForm.totalCopies} onChange={(event) => setBookForm((current) => ({ ...current, totalCopies: event.target.value }))} required />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <textarea
                rows={4}
                value={bookForm.description}
                onChange={(event) => setBookForm((current) => ({ ...current, description: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" type="button" onClick={() => setAddBookOpen(false)}>Cancel</Button>
            <Button type="submit">Save Book</Button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal open={issueBookOpen} onClose={() => setIssueBookOpen(false)} size="lg">
        <ModalHeader>
          <ModalTitle>Issue Book</ModalTitle>
          <ModalDescription>Assign an available book copy to a borrower.</ModalDescription>
        </ModalHeader>
        <form onSubmit={handleIssueBook}>
          <ModalBody className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Select label="Book" value={issueForm.bookId} onChange={(event) => setIssueForm((current) => ({ ...current, bookId: event.target.value }))} required>
                  <option value="">Select a book</option>
                  {availableBooks.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title} ({book.availableCopies} available)
                    </option>
                  ))}
                </Select>
              </div>

              <Select label="Borrower Type" value={issueForm.borrowerType} onChange={(event) => setIssueForm((current) => ({ ...current, borrowerType: event.target.value as BorrowerType }))}>
                <option value="student">Student</option>
                <option value="staff">Staff</option>
              </Select>
              <Input label="Borrower Name" value={issueForm.borrowerName} onChange={(event) => setIssueForm((current) => ({ ...current, borrowerName: event.target.value }))} required />
              <Input label={issueForm.borrowerType === 'student' ? 'Admission Number' : 'Staff ID'} value={issueForm.borrowerReference} onChange={(event) => setIssueForm((current) => ({ ...current, borrowerReference: event.target.value }))} />
              <div />
              <Input label="Issue Date" type="date" value={issueForm.issueDate} onChange={(event) => setIssueForm((current) => ({ ...current, issueDate: event.target.value }))} required />
              <Input label="Due Date" type="date" value={issueForm.dueDate} onChange={(event) => setIssueForm((current) => ({ ...current, dueDate: event.target.value }))} required />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <textarea
                rows={3}
                value={issueForm.notes}
                onChange={(event) => setIssueForm((current) => ({ ...current, notes: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" type="button" onClick={() => setIssueBookOpen(false)}>Cancel</Button>
            <Button type="submit">Issue Book</Button>
          </ModalFooter>
        </form>
      </Modal>
      <Modal open={returnBookOpen} onClose={() => setReturnBookOpen(false)} size="lg">
        <ModalHeader>
          <ModalTitle>Process Return</ModalTitle>
          <ModalDescription>Close an active borrowing and capture return details.</ModalDescription>
        </ModalHeader>
        <form onSubmit={handleProcessReturn}>
          <ModalBody className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Select label="Borrowing Record" value={returnForm.borrowingId} onChange={(event) => setReturnForm((current) => ({ ...current, borrowingId: event.target.value }))} required>
                  <option value="">Select a borrowing record</option>
                  {activeBorrowingRows.map((record) => (
                    <option key={record.id} value={record.id}>
                      {(record.book?.title ?? 'Book')} - {record.borrowerName}
                    </option>
                  ))}
                </Select>
              </div>

              <Input label="Return Date" type="date" value={returnForm.returnDate} onChange={(event) => setReturnForm((current) => ({ ...current, returnDate: event.target.value }))} required />
              <Select label="Condition" value={returnForm.condition} onChange={(event) => setReturnForm((current) => ({ ...current, condition: event.target.value as BookCondition }))}>
                <option value="good">Good</option>
                <option value="damaged">Damaged</option>
                <option value="lost">Lost</option>
              </Select>
              <Input label="Fine Amount" type="number" min="0" step="0.01" value={returnForm.fineAmount} onChange={(event) => setReturnForm((current) => ({ ...current, fineAmount: event.target.value }))} />
              <div />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <textarea
                rows={3}
                value={returnForm.notes}
                onChange={(event) => setReturnForm((current) => ({ ...current, notes: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" type="button" onClick={() => setReturnBookOpen(false)}>Cancel</Button>
            <Button type="submit">Complete Return</Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}

function LibraryOverview({ canManage, recentActivity, summary, onAddBook, onIssueBook, onProcessReturn, onOpenReports }: { canManage: boolean; recentActivity: Array<{ id: string; timestamp: string; title: string; description: string }>; summary: { totalBooks: number; booksBorrowed: number; overdue: number; available: number }; onAddBook: () => void; onIssueBook: () => void; onProcessReturn: () => void; onOpenReports: () => void; }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Books" value={summary.totalBooks} helper="Inventory count" valueClassName="text-gray-900" />
        <SummaryCard label="Books Borrowed" value={summary.booksBorrowed} helper="Currently checked out" valueClassName="text-gray-900" />
        <SummaryCard label="Overdue" value={summary.overdue} helper="Past return date" valueClassName="text-red-600" />
        <SummaryCard label="Available" value={summary.available} helper="Ready for borrowing" valueClassName="text-green-600" />
      </div>

      {canManage && (
        <Card>
          <div className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <QuickActionButton icon={<BookPlus className="h-5 w-5 text-blue-600" />} title="Add Book" description="Register new book" onClick={onAddBook} />
              <QuickActionButton icon={<BookOpen className="h-5 w-5 text-emerald-600" />} title="Issue Book" description="Lend to student or staff" onClick={onIssueBook} />
              <QuickActionButton icon={<RotateCcw className="h-5 w-5 text-amber-600" />} title="Return Book" description="Process return" onClick={onProcessReturn} />
              <QuickActionButton icon={<BarChart3 className="h-5 w-5 text-violet-600" />} title="Reports" description="View live summary" onClick={onOpenReports} />
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <EmptyState title="No recent activity" description="Library actions will appear here after you add books, issue them, or process returns." />
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
                  <div>
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                  <p className="shrink-0 text-xs text-gray-400">{formatDate(item.timestamp)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}


function BookCatalog({ canManage, books, search, onSearchChange, onAddBook, onIssueBook }: { canManage: boolean; books: Array<LibraryBook & { checkedOutCopies: number; availableCopies: number }>; search: string; onSearchChange: (value: string) => void; onAddBook: () => void; onIssueBook: (bookId?: string) => void; }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Input type="text" placeholder="Search by title, author, ISBN, category..." value={search} onChange={(event) => onSearchChange(event.target.value)} className="w-full sm:w-80" />
        {canManage && <Button onClick={onAddBook}>Add Book</Button>}
      </div>

      {books.length === 0 ? (
        <Card>
          <div className="p-6">
            <EmptyState title="No books in catalog" description="Start building your library catalog by adding books and making them available for borrowing." action={canManage ? { label: 'Add Book', onClick: onAddBook } : undefined} />
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto p-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Author</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ISBN</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Copies</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Available</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  {canManage && <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {books.map((book) => {
                  const status = getBookStatus(book.availableCopies, book.totalCopies);
                  return (
                    <tr key={book.id}>
                      <td className="px-4 py-4"><div><p className="font-medium text-gray-900">{book.title}</p>{book.shelf && <p className="text-xs text-gray-500">Shelf: {book.shelf}</p>}</div></td>
                      <td className="px-4 py-4 text-sm text-gray-600">{book.author}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{book.isbn || '-'}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{book.category || '-'}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{book.totalCopies}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{book.availableCopies}</td>
                      <td className="px-4 py-4"><Badge variant={status.variant}>{status.label}</Badge></td>
                      {canManage && <td className="px-4 py-4 text-right"><Button size="sm" variant="secondary" onClick={() => onIssueBook(book.id)} disabled={book.availableCopies <= 0}>Issue Book</Button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function BorrowingSection({ borrowings, onIssueBook, onProcessReturn }: { borrowings: Array<BorrowingRecord & { book: LibraryBook | null }>; onIssueBook: () => void; onProcessReturn: (borrowingId: string) => void; }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Active Borrowings</h2>
        <Button onClick={onIssueBook}>Issue Book</Button>
      </div>

      {borrowings.length === 0 ? (
        <Card>
          <div className="p-6">
            <EmptyState title="No active borrowings" description="When books are issued to students or staff, active borrowing records will appear here with due dates and status tracking." action={{ label: 'Issue Book', onClick: onIssueBook }} />
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto p-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Book</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Borrower</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Issue Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {borrowings.map((record) => {
                  const status = getBorrowingStatus(record);
                  return (
                    <tr key={record.id}>
                      <td className="px-4 py-4"><div><p className="font-medium text-gray-900">{record.book?.title ?? 'Unknown book'}</p><p className="text-xs text-gray-500">{record.book?.author ?? 'No author'}</p></div></td>
                      <td className="px-4 py-4"><div><p className="text-sm font-medium text-gray-900">{record.borrowerName}</p><p className="text-xs capitalize text-gray-500">{record.borrowerType}{record.borrowerReference ? ` - ${record.borrowerReference}` : ''}</p></div></td>
                      <td className="px-4 py-4 text-sm text-gray-600">{formatDate(record.issueDate)}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{formatDate(record.dueDate)}</td>
                      <td className="px-4 py-4"><Badge variant={status.variant}>{status.label}</Badge></td>
                      <td className="px-4 py-4 text-right"><Button size="sm" variant="secondary" onClick={() => onProcessReturn(record.id)}>Process Return</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function ReturnsSection({ overdueCount, returnRows, onProcessReturn }: { overdueCount: number; returnRows: Array<ReturnRecord & { borrowing: BorrowingRecord | null; book: LibraryBook | null }>; onProcessReturn: () => void; }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Book Returns</h2>
        <Button onClick={onProcessReturn}>Process Return</Button>
      </div>

      <Card>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-medium text-red-800">Overdue Books</h3>
              <p className="text-sm text-red-600">{overdueCount === 0 ? 'No overdue books at this time.' : `${overdueCount} book${overdueCount === 1 ? '' : 's'} currently overdue.`}</p>
            </div>
          </div>
        </div>
      </Card>

      {returnRows.length === 0 ? (
        <Card>
          <div className="p-6">
            <EmptyState title="No return history" description="Completed returns and their records will appear here, including any fines or condition notes." action={{ label: 'Process Return', onClick: onProcessReturn }} />
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto p-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Book</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Borrower</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Return Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Condition</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {returnRows.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-4"><div><p className="font-medium text-gray-900">{record.book?.title ?? 'Unknown book'}</p><p className="text-xs text-gray-500">{record.book?.author ?? 'No author'}</p></div></td>
                    <td className="px-4 py-4 text-sm text-gray-600">{record.borrowing?.borrowerName ?? '-'}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{formatDate(record.returnDate)}</td>
                    <td className="px-4 py-4"><Badge variant={record.condition === 'good' ? 'success' : record.condition === 'damaged' ? 'warning' : 'error'}>{record.condition.charAt(0).toUpperCase() + record.condition.slice(1)}</Badge></td>
                    <td className="px-4 py-4 text-sm text-gray-600">{record.fineAmount > 0 ? record.fineAmount.toFixed(2) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ label, value, helper, valueClassName }: { label: string; value: number; helper: string; valueClassName: string; }) {
  return (
    <Card>
      <div className="p-4">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${valueClassName}`}>{value}</p>
        <p className="mt-1 text-xs text-gray-400">{helper}</p>
      </div>
    </Card>
  );
}

function QuickActionButton({ icon, title, description, onClick }: { icon: ReactNode; title: string; description: string; onClick: () => void; }) {
  return (
    <button className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50" onClick={onClick} type="button">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">{icon}</span>
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </button>
  );
}

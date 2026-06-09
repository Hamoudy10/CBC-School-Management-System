import { z } from 'zod';

export const createBookSchema = z.object({
  isbn: z.string().max(20).optional(),
  title: z.string().min(1).max(300),
  author: z.string().min(1).max(200),
  publisher: z.string().max(200).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  totalQuantity: z.number().int().min(1).max(1000).default(1),
  category: z.string().max(100).optional(),
});

export const issueBookSchema = z.object({
  bookId: z.string().uuid(),
  userId: z.string().uuid(),
  dueDate: z.string(),
});

export const returnBookSchema = z.object({
  borrowId: z.string().uuid(),
  condition: z.string().max(50).optional(),
});

export const createInventoryItemSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  quantity: z.number().int().min(0).default(1),
  condition: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  assignedTo: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateInventoryItemSchema = createInventoryItemSchema.partial();

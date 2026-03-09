// components/ui/index.ts
// ============================================================
// UI Component Library — Barrel Export
// ============================================================

// Button
export { Button, buttonVariants } from "./Button";

// Form Elements
export { Input } from "./Input";
export { Select } from "./Select";

// Badge
export {
  Badge,
  badgeVariants,
  PerformanceBadge,
  StatusBadge,
  FeeStatusBadge,
} from "./Badge";

// Card
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatCard,
} from "./Card";

// Table
export {
  TableWrapper,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableEmpty,
  TableLoading,
} from "./Table";

// Modal
export {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ConfirmDialog,
} from "./Modal";

// Tabs
export { Tabs, TabsList, TabTrigger, TabContent } from "./Tabs";

// Toast
export { ToastProvider, useToast } from "./Toast";
export type { Toast, ToastType } from "./Toast";

// Navigation
export { Breadcrumbs } from "./Breadcrumbs";
export type { BreadcrumbItem, BreadcrumbsProps } from "./Breadcrumbs";

// Loading
export { Spinner, PageLoader, SectionLoader } from "./Spinner";

// Avatar
export { Avatar, AvatarGroup } from "./Avatar";


// app/(dashboard)/exams/page.tsx
'use client';

import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BookOpen,
  Upload,
  Search,
  Filter,
  Plus,
  Calendar,
  FileText,
  Eye,
  ClipboardList,
  Layers,
  RefreshCw,
  X,
  CheckCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  TableLoading,
  TableWrapper,
} from '@/components/ui/Table';
import { Tabs, TabsList, TabTrigger, TabContent } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';
import { useReferenceData } from '@/hooks/useReferenceData';

type ExamType = 'exam' | 'cat' | 'mock' | 'past_paper';

interface ExamRecord {
  examId: string;
  title: string;
  description?: string | null;
  content?: string | null;
  type: ExamType;
  learningAreaId: string;
  learningAreaName?: string | null;
  termId?: string | null;
  termName?: string | null;
  academicYearId?: string | null;
  academicYearName?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

interface ExamSet {
  examSetId: string;
  examId: string;
  examTitle: string;
  examType: ExamType;
  learningAreaName?: string | null;
  classId: string;
  className: string;
  termId: string;
  termName?: string | null;
  academicYearId: string;
  academicYearName?: string | null;
  examDate: string;
  notes?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

const EXAM_TYPES: Array<{ value: ExamType; label: string; description: string }> = [
  { value: 'exam', label: 'Exam Paper', description: 'Full term exam paper' },
  { value: 'cat', label: 'CAT', description: 'Continuous Assessment Test' },
  { value: 'mock', label: 'Mock', description: 'Mock exam paper' },
  { value: 'past_paper', label: 'Past Paper', description: 'Past examination paper' },
];

const EXAM_TYPE_BADGES: Record<
  ExamType,
  { label: string; variant: 'default' | 'success' | 'warning' | 'info' }
> = {
  exam: { label: 'Exam', variant: 'info' },
  cat: { label: 'CAT', variant: 'warning' },
  mock: { label: 'Mock', variant: 'success' },
  past_paper: { label: 'Past Paper', variant: 'default' },
};

const MAX_FILE_SIZE_MB = 20;
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xlsx', 'xls', 'txt'];

function normalizeExam(row: any): ExamRecord {
  return {
    examId: row.examId || row.exam_id || row.id || '',
    title: row.title || '',
    description: row.description ?? null,
    content: row.content ?? null,
    type: row.type || row.exam_type || 'exam',
    learningAreaId: row.learningAreaId || row.learning_area_id || '',
    learningAreaName:
      row.learningAreaName ||
      row.learning_area_name ||
      row.learning_areas?.name ||
      null,
    termId: row.termId || row.term_id || null,
    termName: row.termName || row.term_name || row.terms?.name || null,
    academicYearId: row.academicYearId || row.academic_year_id || null,
    academicYearName:
      row.academicYearName ||
      row.academic_year_name ||
      row.academic_years?.year ||
      null,
    fileUrl: row.fileUrl || row.file_url || null,
    fileName: row.fileName || row.file_name || null,
    fileType: row.fileType || row.file_type || null,
    createdBy: row.createdBy || row.created_by || null,
    updatedAt: row.updatedAt || row.updated_at || null,
    createdAt: row.createdAt || row.created_at || null,
  };
}

function normalizeExamSet(row: any): ExamSet {
  const exam = row.exam || row.exam_bank || {};
  const classRow = row.class || row.classes || {};
  const termRow = row.term || row.terms || {};
  const yearRow = row.year || row.academic_years || {};

  return {
    examSetId: row.examSetId || row.exam_set_id || row.id || '',
    examId: row.examId || row.exam_id || exam.exam_id || '',
    examTitle: row.examTitle || exam.title || '',
    examType: row.examType || exam.exam_type || exam.type || 'exam',
    learningAreaName:
      row.learningAreaName ||
      exam.learning_areas?.name ||
      exam.learning_area_name ||
      null,
    classId: row.classId || row.class_id || classRow.class_id || '',
    className: row.className || classRow.name || '',
    termId: row.termId || row.term_id || termRow.term_id || '',
    termName: row.termName || termRow.name || null,
    academicYearId:
      row.academicYearId ||
      row.academic_year_id ||
      yearRow.academic_year_id ||
      '',
    academicYearName: row.academicYearName || yearRow.year || null,
    examDate: row.examDate || row.exam_date || '',
    notes: row.notes ?? null,
    createdBy: row.createdBy || row.created_by || null,
    updatedAt: row.updatedAt || row.updated_at || null,
    createdAt: row.createdAt || row.created_at || null,
  };
}

function hasContent(exam: ExamRecord) {
  return Boolean(exam.content && exam.content.trim().length > 0);
}

function hasFile(exam: ExamRecord) {
  return Boolean(exam.fileUrl);
}

async function getApiErrorMessage(response: Response, fallback: string) {
  try {
    const json = await response.json();
    return json?.error || json?.message || fallback;
  } catch {
    return fallback;
  }
}

export default function ExamBankPage() {
  const { user, loading, checkPermission } = useAuth();
  const { success, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canViewExams = checkPermission('exams', 'view');
  const canCreateExams = checkPermission('exams', 'create');
  const canUpdateExams = checkPermission('exams', 'update');
  const canDeleteExams = checkPermission('exams', 'delete');
  const {
    classes,
    academicYears,
    activeYear,
    termsByYear,
    learningAreas,
    isLoading: isReferenceLoading,
  } = useReferenceData({
    enabled: Boolean(user),
    includeLearningAreas: true,
  });

  const [activeTab, setActiveTab] = useState('create');
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [examSets, setExamSets] = useState<ExamSet[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [isLoadingSets, setIsLoadingSets] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [filterLearningAreaId, setFilterLearningAreaId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAcademicYearId, setFilterAcademicYearId] = useState('');
  const [filterTermId, setFilterTermId] = useState('');

  const [createForm, setCreateForm] = useState({
    title: '',
    learningAreaId: '',
    type: 'exam' as ExamType,
    academicYearId: '',
    termId: '',
    description: '',
    content: '',
  });
  const [editingExam, setEditingExam] = useState<ExamRecord | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSavingExam, setIsSavingExam] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const [scheduleForm, setScheduleForm] = useState({
    examId: '',
    classId: '',
    academicYearId: '',
    termId: '',
    examDate: '',
    notes: '',
  });
  const [editingExamSet, setEditingExamSet] = useState<ExamSet | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleExam, setScheduleExam] = useState<ExamRecord | null>(null);

  const [previewExam, setPreviewExam] = useState<ExamRecord | null>(null);

  const availableTabs = useMemo(() => {
    const tabs: string[] = [];
    if (canCreateExams) {
      tabs.push('create');
    }
    if (canViewExams) {
      tabs.push('bank');
    }
    if (canCreateExams) {
      tabs.push('schedule');
    }
    return tabs;
  }, [canCreateExams, canViewExams]);

  const createTerms = termsByYear[createForm.academicYearId] || [];
  const scheduleTerms = termsByYear[scheduleForm.academicYearId] || [];
  const selectedScheduleExam =
    scheduleExam ||
    exams.find((exam) => exam.examId === scheduleForm.examId) ||
    null;

  const resetExamFileSelection = useCallback(() => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const resetExamForm = useCallback(
    (yearId?: string, type?: ExamType) => {
      setEditingExam(null);
      setCreateForm({
        title: '',
        learningAreaId: '',
        type: type || 'exam',
        academicYearId: yearId || activeYear?.id || '',
        termId: '',
        description: '',
        content: '',
      });
      resetExamFileSelection();
    },
    [activeYear, resetExamFileSelection],
  );

  const resetScheduleForm = useCallback(
    (yearId?: string) => {
      setEditingExamSet(null);
      setScheduleExam(null);
      setScheduleForm({
        examId: '',
        classId: '',
        academicYearId: yearId || activeYear?.id || '',
        termId: '',
        examDate: '',
        notes: '',
      });
    },
    [activeYear],
  );

  const buildExamQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set('pageSize', '50');

    if (deferredSearchTerm.trim()) {
      params.set('search', deferredSearchTerm.trim());
    }
    if (filterLearningAreaId) {
      params.set('learningAreaId', filterLearningAreaId);
    }
    if (filterType) {
      params.set('type', filterType);
    }
    if (filterAcademicYearId) {
      params.set('academicYearId', filterAcademicYearId);
    }
    if (filterTermId) {
      params.set('termId', filterTermId);
    }

    return params.toString();
  }, [
    deferredSearchTerm,
    filterLearningAreaId,
    filterType,
    filterAcademicYearId,
    filterTermId,
  ]);

  const fetchExams = useCallback(async () => {
    if (!canViewExams) {
      return;
    }

    setIsLoadingExams(true);
    try {
      const query = buildExamQuery();
      const response = await fetch(`/api/exams?${query}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Failed to load exams'));
      }

      const json = await response.json();
      setExams((json.data || []).map(normalizeExam));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load exams';
      toastError('Error', message);
    } finally {
      setIsLoadingExams(false);
    }
  }, [buildExamQuery, canViewExams, toastError]);

  const fetchExamSets = useCallback(async () => {
    if (!canViewExams) {
      return;
    }

    setIsLoadingSets(true);
    try {
      const response = await fetch('/api/exams/sets?pageSize=50', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, 'Failed to load exam schedule'),
        );
      }

      const json = await response.json();
      setExamSets((json.data || []).map(normalizeExamSet));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load exam schedule';
      toastError('Error', message);
    } finally {
      setIsLoadingSets(false);
    }
  }, [canViewExams, toastError]);

  useEffect(() => {
    if (academicYears.length === 0) {
      return;
    }

    const defaultYear = activeYear || academicYears[0];

    setCreateForm((prev) =>
      prev.academicYearId
        ? prev
        : { ...prev, academicYearId: defaultYear?.id || '' },
    );

    setScheduleForm((prev) =>
      prev.academicYearId
        ? prev
        : { ...prev, academicYearId: defaultYear?.id || '' },
    );
  }, [academicYears, activeYear]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] || 'bank');
    }
  }, [availableTabs, activeTab]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  useEffect(() => {
    fetchExamSets();
  }, [fetchExamSets]);

  const handleFileSelect = (selected: File | null) => {
    if (!selected) {
      return;
    }

    const extension = selected.name.split('.').pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      toastError(
        'Unsupported file type',
        'Please upload PDF, Word, Excel, or PowerPoint files.',
      );
      return;
    }

    const fileSizeMb = selected.size / 1024 / 1024;
    if (fileSizeMb > MAX_FILE_SIZE_MB) {
      toastError(
        'File too large',
        `Please upload files smaller than ${MAX_FILE_SIZE_MB}MB.`,
      );
      return;
    }

    setFile(selected);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    handleFileSelect(selectedFile);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const droppedFile = event.dataTransfer.files?.[0] || null;
    handleFileSelect(droppedFile);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const uploadExamFile = useCallback(async (): Promise<string | null> => {
    if (!file) {
      return null;
    }

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'exams');

      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const json = await response.json();
      return json.data?.url || json.url || null;
    } finally {
      setIsUploadingFile(false);
    }
  }, [file]);

  const startNewExam = useCallback(() => {
    resetExamForm(createForm.academicYearId, createForm.type);
    setActiveTab('create');
  }, [createForm.academicYearId, createForm.type, resetExamForm]);

  const startEditingExam = useCallback(
    (exam: ExamRecord) => {
      setEditingExam(exam);
      setCreateForm({
        title: exam.title,
        learningAreaId: exam.learningAreaId,
        type: exam.type,
        academicYearId: exam.academicYearId || activeYear?.id || '',
        termId: exam.termId || '',
        description: exam.description || '',
        content: exam.content || '',
      });
      resetExamFileSelection();
      setActiveTab('create');
    },
    [activeYear, resetExamFileSelection],
  );

  const handleSaveExam = async () => {
    if (!canCreateExams && !canUpdateExams) {
      return;
    }

    if (!createForm.title.trim() || !createForm.learningAreaId) {
      toastError('Missing details', 'Please provide an exam title and subject.');
      return;
    }

    const hasManualContent = createForm.content.trim().length > 0;
    const hasExistingFile = Boolean(editingExam?.fileUrl);
    if (!file && !hasManualContent && !hasExistingFile) {
      toastError('Missing content', 'Upload a file or provide exam content.');
      return;
    }

    setIsSavingExam(true);
    try {
      const fileUrl = await uploadExamFile();
      const method = editingExam ? 'PATCH' : 'POST';
      const endpoint = editingExam ? `/api/exams/${editingExam.examId}` : '/api/exams';

      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title.trim(),
          description: createForm.description.trim() || null,
          content: createForm.content.trim() || null,
          learningAreaId: createForm.learningAreaId,
          type: createForm.type,
          termId: createForm.termId || null,
          academicYearId: createForm.academicYearId || null,
          fileUrl: fileUrl || editingExam?.fileUrl || null,
          fileName: file?.name || editingExam?.fileName || null,
          fileType: file?.type || editingExam?.fileType || null,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            editingExam ? 'Failed to update exam' : 'Failed to save exam',
          ),
        );
      }

      success(
        editingExam ? 'Exam updated' : 'Exam saved',
        editingExam
          ? 'The exam bank entry has been updated.'
          : 'The exam is now available in the exam bank.',
      );

      resetExamForm(createForm.academicYearId, createForm.type);

      await fetchExams();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : editingExam
            ? 'Failed to update exam'
            : 'Failed to save exam';
      toastError('Error', message);
    } finally {
      setIsSavingExam(false);
    }
  };

  const openScheduleModal = (exam: ExamRecord | null) => {
    setEditingExamSet(null);
    setScheduleExam(exam);
    setScheduleForm((prev) => ({
      ...prev,
      examId: exam?.examId || '',
      academicYearId: exam?.academicYearId || prev.academicYearId || '',
      termId: exam?.termId || prev.termId || '',
      classId: '',
      examDate: '',
      notes: '',
    }));
    setScheduleModalOpen(true);
  };

  const startEditingSchedule = useCallback(
    (examSet: ExamSet) => {
      setEditingExamSet(examSet);
      setScheduleExam(null);
      setScheduleForm({
        examId: examSet.examId,
        classId: examSet.classId,
        academicYearId: examSet.academicYearId || activeYear?.id || '',
        termId: examSet.termId || '',
        examDate: examSet.examDate,
        notes: examSet.notes || '',
      });
      setScheduleModalOpen(true);
    },
    [activeYear],
  );

  const handleScheduleExam = async () => {
    if (
      !scheduleForm.examId ||
      !scheduleForm.classId ||
      !scheduleForm.termId ||
      !scheduleForm.examDate
    ) {
      toastError('Missing details', 'Select an exam, class, term, and date.');
      return;
    }

    setIsScheduling(true);
    try {
      const endpoint = editingExamSet
        ? `/api/exams/sets/${editingExamSet.examSetId}`
        : '/api/exams/sets';
      const response = await fetch(endpoint, {
        method: editingExamSet ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: scheduleForm.examId,
          classId: scheduleForm.classId,
          termId: scheduleForm.termId,
          academicYearId: scheduleForm.academicYearId || null,
          examDate: scheduleForm.examDate,
          notes: scheduleForm.notes.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            editingExamSet ? 'Failed to update exam schedule' : 'Failed to schedule exam',
          ),
        );
      }

      success(
        editingExamSet ? 'Schedule updated' : 'Exam scheduled',
        editingExamSet
          ? 'The exam schedule has been updated.'
          : 'Exam schedule has been created.',
      );
      setScheduleModalOpen(false);
      resetScheduleForm(scheduleForm.academicYearId);
      await fetchExamSets();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : editingExamSet
            ? 'Failed to update exam schedule'
            : 'Failed to schedule exam';
      toastError('Error', message);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleDeleteExam = useCallback(
    async (exam: ExamRecord) => {
      if (!canDeleteExams) {
        return;
      }

      const confirmed = window.confirm(
        `Delete "${exam.title}" from the exam bank? This cannot be undone.`,
      );
      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(`/api/exams/${exam.examId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response, 'Failed to delete exam'));
        }

        if (editingExam?.examId === exam.examId) {
          resetExamForm(createForm.academicYearId, createForm.type);
        }

        success('Exam deleted', 'The exam bank entry has been removed.');
        await fetchExams();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete exam';
        toastError('Error', message);
      }
    },
    [
      canDeleteExams,
      createForm.academicYearId,
      createForm.type,
      editingExam,
      fetchExams,
      resetExamForm,
      success,
      toastError,
    ],
  );

  const handleDeleteSchedule = useCallback(
    async (examSet: ExamSet) => {
      if (!canDeleteExams) {
        return;
      }

      const confirmed = window.confirm(
        `Delete the schedule for "${examSet.examTitle}" on ${formatDate(examSet.examDate)}?`,
      );
      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(`/api/exams/sets/${examSet.examSetId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(
            await getApiErrorMessage(response, 'Failed to delete exam schedule'),
          );
        }

        if (editingExamSet?.examSetId === examSet.examSetId) {
          resetScheduleForm(scheduleForm.academicYearId);
        }

        success('Schedule deleted', 'The exam schedule has been removed.');
        await fetchExamSets();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete exam schedule';
        toastError('Error', message);
      }
    },
    [
      canDeleteExams,
      editingExamSet,
      fetchExamSets,
      resetScheduleForm,
      scheduleForm.academicYearId,
      success,
      toastError,
    ],
  );

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterLearningAreaId('');
    setFilterType('');
    setFilterAcademicYearId('');
    setFilterTermId('');
  };

  if (loading || isReferenceLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading exam bank...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!canViewExams && !canCreateExams) {
    return (
      <div className="space-y-6">
        <PageHeader title="Exam Bank" />
        <Alert variant="destructive">
          You do not have access to the exam bank.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Bank"
        description="Create, upload, and schedule exam papers in one place"
        icon={<BookOpen className="h-5 w-5" />}
      >
        <div className="flex flex-wrap items-center gap-2">
          {canCreateExams && (
            <Button
              variant="primary"
              size="sm"
              onClick={startNewExam}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Exam
            </Button>
          )}
          {canViewExams && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab('bank')}
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              View Bank
            </Button>
          )}
          {canCreateExams && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab('schedule')}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Schedule Exams
            </Button>
          )}
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {availableTabs.includes('create') && (
            <TabTrigger value="create">Create or Upload</TabTrigger>
          )}
          {availableTabs.includes('bank') && (
            <TabTrigger value="bank">Exam Bank</TabTrigger>
          )}
          {availableTabs.includes('schedule') && (
            <TabTrigger value="schedule">Set Exams</TabTrigger>
          )}
        </TabsList>

        {availableTabs.includes('create') && (
          <TabContent value="create" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Layers className="h-5 w-5" />
                    {editingExam ? 'Edit Exam Details' : 'Exam Details'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editingExam && (
                    <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          Editing {editingExam.title}
                        </p>
                        <p className="text-xs text-blue-700">
                          Update the exam bank entry, then save your changes.
                        </p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={startNewExam}>
                        Cancel Edit
                      </Button>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">
                        Exam Title
                      </label>
                      <Input
                        value={createForm.title}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        placeholder="e.g. Term 2 Mathematics Exam"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">
                        Subject / Learning Area
                      </label>
                      <Select
                        value={createForm.learningAreaId}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            learningAreaId: e.target.value,
                          }))
                        }
                      >
                        <option value="">Select subject</option>
                        {learningAreas.map((area) => (
                          <option
                            key={area.learningAreaId}
                            value={area.learningAreaId}
                          >
                            {area.name}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">
                        Exam Type
                      </label>
                      <Select
                        value={createForm.type}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            type: e.target.value as ExamType,
                          }))
                        }
                      >
                        {EXAM_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">
                        Academic Year
                      </label>
                      <Select
                        value={createForm.academicYearId}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            academicYearId: e.target.value,
                            termId: '',
                          }))
                        }
                      >
                        <option value="">Select year</option>
                        {academicYears.map((year) => (
                          <option key={year.id} value={year.id}>
                            {year.year}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">
                        Term
                      </label>
                      <Select
                        value={createForm.termId}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            termId: e.target.value,
                          }))
                        }
                        disabled={!createForm.academicYearId}
                      >
                        <option value="">Select term</option>
                        {createTerms.map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Short Description
                    </label>
                    <Input
                      value={createForm.description}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Optional summary for the exam"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Exam Content (optional if uploading file)
                    </label>
                    <textarea
                      rows={6}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={createForm.content}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          content: e.target.value,
                        }))
                      }
                      placeholder="Type or paste the exam content here"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                    <div className="text-sm text-gray-600">
                      <p className="font-medium text-gray-800">
                        {editingExam ? 'Ready to update?' : 'Ready to save?'}
                      </p>
                      <p>
                        {editingExam
                          ? 'Keep the current file or upload a replacement before saving.'
                          : 'Provide a file or typed content, then save to the exam bank.'}
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      onClick={handleSaveExam}
                      loading={isSavingExam || isUploadingFile}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {editingExam ? 'Update Exam' : 'Save Exam'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-5 w-5" />
                    {editingExam ? 'Replace Exam File' : 'Upload Exam File'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingExam?.fileUrl && !file && (
                    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                      <p className="font-medium text-gray-900">
                        Current file: {editingExam.fileName || 'Attached exam file'}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => window.open(editingExam.fileUrl || '', '_blank')}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Open Current File
                      </Button>
                    </div>
                  )}

                  <div
                    className={cn(
                      'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                      isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300',
                    )}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileInputChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.xls,.txt"
                      id="exam-upload"
                    />

                    {!file ? (
                      <label htmlFor="exam-upload" className="cursor-pointer">
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-10 w-10 text-gray-400" />
                          <p className="text-sm text-gray-600">
                            <span className="font-medium text-blue-600">Click to upload</span>{' '}
                            or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">
                            PDF, Word, Excel or PowerPoint (max {MAX_FILE_SIZE_MB}MB)
                          </p>
                        </div>
                      </label>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-10 w-10 text-green-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setFile(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                    <p className="font-medium text-gray-800">Tips</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      <li>Upload past papers, CATs, or mock exams.</li>
                      <li>Match the subject and term so you can locate exams quickly.</li>
                      <li>Save the file before scheduling the exam.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabContent>
        )}

        {availableTabs.includes('bank') && (
          <TabContent value="bank" className="mt-6 space-y-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search exams by title, description, or content..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={filterLearningAreaId}
                      onChange={(e) => setFilterLearningAreaId(e.target.value)}
                      className="w-48"
                    >
                      <option value="">All Subjects</option>
                      {learningAreas.map((area) => (
                        <option
                          key={area.learningAreaId}
                          value={area.learningAreaId}
                        >
                          {area.name}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-40"
                    >
                      <option value="">All Types</option>
                      {EXAM_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={filterAcademicYearId}
                      onChange={(e) => {
                        setFilterAcademicYearId(e.target.value);
                        setFilterTermId('');
                      }}
                      className="w-36"
                    >
                      <option value="">All Years</option>
                      {academicYears.map((year) => (
                        <option key={year.id} value={year.id}>
                          {year.year}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={filterTermId}
                      onChange={(e) => setFilterTermId(e.target.value)}
                      className="w-36"
                      disabled={!filterAcademicYearId}
                    >
                      <option value="">All Terms</option>
                      {(termsByYear[filterAcademicYearId] || []).map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.name}
                        </option>
                      ))}
                    </Select>

                    <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                      <Filter className="mr-2 h-4 w-4" />
                      Clear
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={fetchExams}
                      disabled={isLoadingExams}
                    >
                      <RefreshCw
                        className={cn('mr-2 h-4 w-4', isLoadingExams && 'animate-spin')}
                      />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Term / Year</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingExams ? (
                    <TableLoading colSpan={7} rows={5} />
                  ) : exams.length === 0 ? (
                    <TableEmpty
                      colSpan={7}
                      message="No exams found"
                      description="Upload or create exams to build your exam bank."
                    />
                  ) : (
                    exams.map((exam) => (
                      <TableRow key={exam.examId}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{exam.title}</p>
                            <p className="text-xs text-gray-500">
                              {exam.description || 'No description'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{exam.learningAreaName || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={EXAM_TYPE_BADGES[exam.type].variant}>
                            {EXAM_TYPE_BADGES[exam.type].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{exam.termName || '-'}</p>
                            <p className="text-xs text-gray-500">
                              {exam.academicYearName || '-'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {hasFile(exam) ? (
                            <Badge variant="info">File</Badge>
                          ) : hasContent(exam) ? (
                            <Badge variant="default">Typed</Badge>
                          ) : (
                            <Badge variant="warning">Draft</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {exam.createdAt ? formatDate(exam.createdAt) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {(hasContent(exam) || hasFile(exam)) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPreviewExam(exam)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {hasFile(exam) && exam.fileUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(exam.fileUrl || '', '_blank')}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            )}
                            {canUpdateExams && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditingExam(exam)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canCreateExams && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openScheduleModal(exam)}
                              >
                                Set Exam
                              </Button>
                            )}
                            {canDeleteExams && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteExam(exam)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableWrapper>
          </TabContent>
        )}

        {availableTabs.includes('schedule') && (
          <TabContent value="schedule" className="mt-6 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Exam Schedule</CardTitle>
                <Button variant="primary" size="sm" onClick={() => openScheduleModal(null)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule Exam
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingSets ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner size="lg" />
                  </div>
                ) : examSets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Calendar className="h-10 w-10 text-gray-300" />
                    <p className="mt-3 text-sm text-gray-500">
                      No exams scheduled yet.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-4"
                      onClick={() => openScheduleModal(null)}
                    >
                      Schedule your first exam
                    </Button>
                  </div>
                ) : (
                  <TableWrapper>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Exam</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Term / Year</TableHead>
                          <TableHead>Type</TableHead>
                          {(canUpdateExams || canDeleteExams) && (
                            <TableHead className="text-right">Actions</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {examSets.map((set) => (
                          <TableRow key={set.examSetId}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-gray-900">{set.examTitle}</p>
                                <p className="text-xs text-gray-500">
                                  {set.learningAreaName || '-'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{set.className}</TableCell>
                            <TableCell>{formatDate(set.examDate)}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p>{set.termName || '-'}</p>
                                <p className="text-xs text-gray-500">
                                  {set.academicYearName || '-'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={EXAM_TYPE_BADGES[set.examType].variant}>
                                {EXAM_TYPE_BADGES[set.examType].label}
                              </Badge>
                            </TableCell>
                            {(canUpdateExams || canDeleteExams) && (
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {canUpdateExams && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => startEditingSchedule(set)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canDeleteExams && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteSchedule(set)}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableWrapper>
                )}
              </CardContent>
            </Card>
          </TabContent>
        )}
      </Tabs>

      <Modal
        open={scheduleModalOpen}
        onClose={() => {
          setScheduleModalOpen(false);
          resetScheduleForm(scheduleForm.academicYearId);
        }}
        size="lg"
      >
        <ModalHeader>
          <ModalTitle>{editingExamSet ? 'Edit Exam Schedule' : 'Set Exam'}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {!scheduleExam && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Select Exam</label>
                <Select
                  value={scheduleForm.examId}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      examId: e.target.value,
                    }))
                  }
                >
                  <option value="">Choose exam</option>
                  {exams.map((exam) => (
                    <option key={exam.examId} value={exam.examId}>
                      {exam.title}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {selectedScheduleExam && (
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-900">
                  {selectedScheduleExam.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <Badge variant={EXAM_TYPE_BADGES[selectedScheduleExam.type].variant}>
                    {EXAM_TYPE_BADGES[selectedScheduleExam.type].label}
                  </Badge>
                  <span>{selectedScheduleExam.learningAreaName || 'No subject'}</span>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Class</label>
                <Select
                  value={scheduleForm.classId}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      classId: e.target.value,
                    }))
                  }
                >
                  <option value="">Select class</option>
                  {classes.map((cls) => (
                    <option key={cls.classId} value={cls.classId}>
                      {cls.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Academic Year</label>
                <Select
                  value={scheduleForm.academicYearId}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      academicYearId: e.target.value,
                      termId: '',
                    }))
                  }
                >
                  <option value="">Select year</option>
                  {academicYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.year}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Term</label>
                <Select
                  value={scheduleForm.termId}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      termId: e.target.value,
                    }))
                  }
                  disabled={!scheduleForm.academicYearId}
                >
                  <option value="">Select term</option>
                  {scheduleTerms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Exam Date</label>
                <Input
                  type="date"
                  value={scheduleForm.examDate}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      examDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Notes (optional)</label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={scheduleForm.notes}
                onChange={(e) =>
                  setScheduleForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setScheduleModalOpen(false);
              resetScheduleForm(scheduleForm.academicYearId);
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleScheduleExam} loading={isScheduling}>
            {editingExamSet ? 'Update Schedule' : 'Save Schedule'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={!!previewExam} onClose={() => setPreviewExam(null)} size="lg">
        <ModalHeader>
          <ModalTitle>Exam Preview</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {previewExam && (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold text-gray-900">{previewExam.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <Badge variant={EXAM_TYPE_BADGES[previewExam.type].variant}>
                    {EXAM_TYPE_BADGES[previewExam.type].label}
                  </Badge>
                  <span>{previewExam.learningAreaName || 'No subject'}</span>
                  {previewExam.termName && <span>{previewExam.termName}</span>}
                  {previewExam.academicYearName && (
                    <span>{previewExam.academicYearName}</span>
                  )}
                </div>
              </div>

              {previewExam.description && (
                <p className="text-sm text-gray-600">{previewExam.description}</p>
              )}

              {hasFile(previewExam) && previewExam.fileUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open(previewExam.fileUrl || '', '_blank')}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Open File
                </Button>
              )}

              {hasContent(previewExam) ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap">
                  {previewExam.content}
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  No typed content available for this exam.
                </div>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setPreviewExam(null)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

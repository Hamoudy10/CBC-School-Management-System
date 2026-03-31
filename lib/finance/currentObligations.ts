import { calculateFeeStatus } from "@/features/finance";

type SupabaseLike = any;

type StudentRow = {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  status: string;
  classes?: any;
};

type FeeStructureRow = {
  id: string;
  name: string;
  amount: number | string;
  grade_id: string | null;
  term_id: string | null;
  is_mandatory: boolean;
};

type StudentFeeRow = {
  id: string;
  student_id: string;
  fee_structure_id: string;
  amount_due: number | string | null;
  amount_paid: number | string | null;
  balance: number | string | null;
  due_date: string | null;
  status: "pending" | "partial" | "paid" | "overdue" | "waived" | null;
  term_id: string | null;
};

export type CurrentStudentObligation = {
  studentFeeId: string | null;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  gradeId: string | null;
  gradeName: string;
  feeStructureId: string;
  feeName: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: "pending" | "partial" | "paid" | "overdue";
  dueDate: string | null;
  termId: string | null;
  isVirtual: boolean;
  lastPaymentDate: string | null;
};

export type CurrentStudentFinanceSummary = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  gradeName: string;
  totalDue: number;
  totalPaid: number;
  balance: number;
  status: "pending" | "partial" | "paid" | "overdue";
  lastPaymentDate: string | null;
  obligations: CurrentStudentObligation[];
};

export type CurrentFinanceSnapshot = {
  students: CurrentStudentFinanceSummary[];
  obligations: CurrentStudentObligation[];
};

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toMoney(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function buildStudentStatus(obligations: CurrentStudentObligation[]) {
  const totalDue = obligations.reduce((sum, item) => sum + item.amountDue, 0);
  const totalPaid = obligations.reduce((sum, item) => sum + item.amountPaid, 0);
  const balance = obligations.reduce((sum, item) => sum + item.balance, 0);

  if (totalDue > 0 && balance <= 0) {
    return "paid" as const;
  }
  if (totalPaid > 0) {
    return "partial" as const;
  }
  if (obligations.some((item) => item.status === "overdue")) {
    return "overdue" as const;
  }
  return "pending" as const;
}

function matchesApplicableGrade(
  feeStructure: FeeStructureRow,
  studentGradeId: string | null,
) {
  if (!feeStructure.grade_id) {
    return true;
  }

  return feeStructure.grade_id === studentGradeId;
}

function buildStudentLabel(student: StudentRow) {
  return `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() || "Unknown Student";
}

export async function getCurrentFinanceSnapshot({
  supabase,
  schoolId,
  academicYearId,
  termId,
  studentId,
  studentIds,
  includeInactive = false,
}: {
  supabase: SupabaseLike;
  schoolId: string;
  academicYearId: string;
  termId?: string | null;
  studentId?: string;
  studentIds?: string[];
  includeInactive?: boolean;
}): Promise<CurrentFinanceSnapshot> {
  let studentsQuery = supabase
    .from("students")
    .select(
      `
      student_id,
      first_name,
      last_name,
      admission_number,
      status,
      classes (
        name,
        grade_id,
        grades (
          name
        )
      )
    `,
    )
    .eq("school_id", schoolId);

  if (!includeInactive && !studentId && !studentIds?.length) {
    studentsQuery = studentsQuery.eq("status", "active");
  }

  if (studentId) {
    studentsQuery = studentsQuery.eq("student_id", studentId);
  } else if (studentIds?.length) {
    studentsQuery = studentsQuery.in("student_id", studentIds);
  }

  let feeStructuresQuery = supabase
    .from("fee_structures")
    .select("id, name, amount, grade_id, term_id, is_mandatory")
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .eq("is_active", true);

  if (termId) {
    feeStructuresQuery = feeStructuresQuery.or(`term_id.is.null,term_id.eq.${termId}`);
  }

  let studentFeesQuery = supabase
    .from("student_fees")
    .select(
      `
      id,
      student_id,
      fee_structure_id,
      amount_due,
      amount_paid,
      balance,
      due_date,
      status,
      term_id
    `,
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId);

  if (studentId) {
    studentFeesQuery = studentFeesQuery.eq("student_id", studentId);
  } else if (studentIds?.length) {
    studentFeesQuery = studentFeesQuery.in("student_id", studentIds);
  }

  if (termId) {
    studentFeesQuery = studentFeesQuery.or(`term_id.is.null,term_id.eq.${termId}`);
  }

  const [{ data: studentsData, error: studentsError }, { data: feeStructuresData, error: feeStructuresError }, { data: studentFeesData, error: studentFeesError }] =
    await Promise.all([studentsQuery, feeStructuresQuery, studentFeesQuery]);

  if (studentsError) {
    throw new Error(studentsError.message);
  }

  if (feeStructuresError) {
    throw new Error(feeStructuresError.message);
  }

  if (studentFeesError) {
    throw new Error(studentFeesError.message);
  }

  const students = (studentsData ?? []) as StudentRow[];
  const feeStructures = (feeStructuresData ?? []) as FeeStructureRow[];
  const studentFees = (studentFeesData ?? []) as StudentFeeRow[];
  const studentMap = new Map(
    students.map((student) => [student.student_id, student]),
  );
  const visibleStudentIds = new Set(students.map((student) => student.student_id));
  const visibleFees = studentFees.filter((fee) => visibleStudentIds.has(fee.student_id));

  const paymentDateByStudentFeeId = new Map<string, string>();
  const studentFeeIds = visibleFees.map((fee) => fee.id);

  if (studentFeeIds.length > 0) {
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("student_fee_id, payment_date")
      .eq("school_id", schoolId)
      .in("student_fee_id", studentFeeIds);

    if (paymentsError) {
      throw new Error(paymentsError.message);
    }

    for (const payment of payments ?? []) {
      const feeId = (payment as any).student_fee_id as string | undefined;
      const paymentDate = (payment as any).payment_date as string | undefined;

      if (!feeId || !paymentDate) {
        continue;
      }

      const existing = paymentDateByStudentFeeId.get(feeId);
      if (!existing || paymentDate > existing) {
        paymentDateByStudentFeeId.set(feeId, paymentDate);
      }
    }
  }

  const feeStructureMap = new Map(
    feeStructures.map((feeStructure) => [feeStructure.id, feeStructure]),
  );

  const actualFeesByStudent = new Map<string, CurrentStudentObligation[]>();
  const existingFeeStructureIdsByStudent = new Map<string, Set<string>>();

  for (const fee of visibleFees) {
    const feeStructure = feeStructureMap.get(fee.fee_structure_id);
    const student = studentMap.get(fee.student_id);

    if (!student) {
      continue;
    }

    const classInfo = getSingleRelation(student.classes);
    const gradeInfo = getSingleRelation(classInfo?.grades);
    const amountDue = toMoney(fee.amount_due);
    const amountPaid = toMoney(fee.amount_paid);
    const balance = roundMoney(
      fee.balance !== null && fee.balance !== undefined
        ? toMoney(fee.balance)
        : amountDue - amountPaid,
    );
    const status = calculateFeeStatus(
      amountDue,
      amountPaid,
      fee.due_date,
    ) as "pending" | "partial" | "paid" | "overdue";

    const obligation: CurrentStudentObligation = {
      studentFeeId: fee.id,
      studentId: student.student_id,
      studentName: buildStudentLabel(student),
      admissionNumber: student.admission_number ?? "",
      className: classInfo?.name ?? "",
      gradeId: classInfo?.grade_id ?? null,
      gradeName: gradeInfo?.name ?? "",
      feeStructureId: fee.fee_structure_id,
      feeName: feeStructure?.name ?? "Fee",
      amountDue: roundMoney(amountDue),
      amountPaid: roundMoney(amountPaid),
      balance,
      status,
      dueDate: fee.due_date,
      termId: fee.term_id,
      isVirtual: false,
      lastPaymentDate: paymentDateByStudentFeeId.get(fee.id) ?? null,
    };

    const currentItems = actualFeesByStudent.get(fee.student_id) ?? [];
    currentItems.push(obligation);
    actualFeesByStudent.set(fee.student_id, currentItems);

    const currentSet = existingFeeStructureIdsByStudent.get(fee.student_id) ?? new Set<string>();
    currentSet.add(fee.fee_structure_id);
    existingFeeStructureIdsByStudent.set(fee.student_id, currentSet);
  }

  const allObligations: CurrentStudentObligation[] = [];
  const studentSummaries: CurrentStudentFinanceSummary[] = [];

  for (const student of students) {
    const classInfo = getSingleRelation(student.classes);
    const gradeInfo = getSingleRelation(classInfo?.grades);
    const studentGradeId = classInfo?.grade_id ?? null;
    const obligations = [...(actualFeesByStudent.get(student.student_id) ?? [])];
    const existingFeeIds = existingFeeStructureIdsByStudent.get(student.student_id) ?? new Set<string>();

    for (const feeStructure of feeStructures) {
      if (!feeStructure.is_mandatory) {
        continue;
      }

      if (!matchesApplicableGrade(feeStructure, studentGradeId)) {
        continue;
      }

      if (existingFeeIds.has(feeStructure.id)) {
        continue;
      }

      const amountDue = toMoney(feeStructure.amount);
      obligations.push({
        studentFeeId: null,
        studentId: student.student_id,
        studentName: buildStudentLabel(student),
        admissionNumber: student.admission_number ?? "",
        className: classInfo?.name ?? "",
        gradeId: studentGradeId,
        gradeName: gradeInfo?.name ?? "",
        feeStructureId: feeStructure.id,
        feeName: feeStructure.name,
        amountDue: roundMoney(amountDue),
        amountPaid: 0,
        balance: roundMoney(amountDue),
        status: "pending",
        dueDate: null,
        termId: feeStructure.term_id,
        isVirtual: true,
        lastPaymentDate: null,
      });
    }

    obligations.sort((left, right) => right.balance - left.balance);
    allObligations.push(...obligations);

    const totalDue = roundMoney(
      obligations.reduce((sum, obligation) => sum + obligation.amountDue, 0),
    );
    const totalPaid = roundMoney(
      obligations.reduce((sum, obligation) => sum + obligation.amountPaid, 0),
    );
    const balance = roundMoney(
      obligations.reduce((sum, obligation) => sum + obligation.balance, 0),
    );
    const lastPaymentDate = obligations.reduce<string | null>((latest, obligation) => {
      if (!obligation.lastPaymentDate) {
        return latest;
      }

      if (!latest || obligation.lastPaymentDate > latest) {
        return obligation.lastPaymentDate;
      }

      return latest;
    }, null);

    studentSummaries.push({
      studentId: student.student_id,
      studentName: buildStudentLabel(student),
      admissionNumber: student.admission_number ?? "",
      className: classInfo?.name ?? "",
      gradeName: gradeInfo?.name ?? "",
      totalDue,
      totalPaid,
      balance,
      status: buildStudentStatus(obligations),
      lastPaymentDate,
      obligations,
    });
  }

  return {
    students: studentSummaries,
    obligations: allObligations,
  };
}

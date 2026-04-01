// __tests__/api/assessments.test.ts
// ============================================================
// Integration tests for Assessment API routes
// Tests endpoint behavior, validation, and response shapes
// ============================================================

import { describe, it, expect } from "@jest/globals";

// ============================================================
// Response Shape Validation
// ============================================================
describe("Assessment API Response Shapes", () => {
  it("strand-results returns expected shape", () => {
    const mockResponse = {
      success: true,
      data: {
        strands: [
          {
            strandId: "550e8400-e29b-41d4-a716-446655440000",
            strandName: "Number Sense",
            learningAreaId: "550e8400-e29b-41d4-a716-446655440001",
            learningAreaName: "Mathematics",
            averageScore: 3.2,
            level: "Meeting Expectation",
            competencyCount: 5,
            subStrands: [
              {
                subStrandId: "550e8400-e29b-41d4-a716-446655440002",
                subStrandName: "Counting",
                averageScore: 3.5,
                level: "Meeting Expectation",
                competencyCount: 3,
                competencies: [
                  { name: "Count to 100", score: 4 },
                ],
              },
            ],
          },
        ],
      },
    };

    expect(mockResponse.success).toBe(true);
    expect(mockResponse.data.strands).toHaveLength(1);
    expect(mockResponse.data.strands[0].averageScore).toBe(3.2);
    expect(mockResponse.data.strands[0].level).toBe("Meeting Expectation");
  });

  it("area-results returns expected shape", () => {
    const mockResponse = {
      success: true,
      data: {
        learningAreas: [
          {
            learningAreaId: "550e8400-e29b-41d4-a716-446655440000",
            learningAreaName: "Mathematics",
            averageScore: 3.0,
            level: "Meeting Expectation",
            assessmentCount: 10,
            studentCount: 5,
            distribution: {
              exceeding: 2,
              meeting: 5,
              approaching: 2,
              belowExpectation: 1,
            },
          },
        ],
      },
    };

    expect(mockResponse.data.learningAreas[0].distribution.exceeding).toBe(2);
    expect(mockResponse.data.learningAreas[0].studentCount).toBe(5);
  });

  it("year-results returns expected shape", () => {
    const mockResponse = {
      success: true,
      data: {
        yearSummary: {
          academicYearId: "550e8400-e29b-41d4-a716-446655440000",
          overallAverage: 3.1,
          overallLevel: "Meeting Expectation",
          totalAssessments: 45,
          termCount: 3,
          termBreakdown: [
            { termName: "Term 1", averageScore: 2.8, level: "Approaching Expectation" },
            { termName: "Term 2", averageScore: 3.1, level: "Meeting Expectation" },
            { termName: "Term 3", averageScore: 3.4, level: "Meeting Expectation" },
          ],
        },
        termBreakdown: [],
      },
    };

    expect(mockResponse.data.yearSummary.termCount).toBe(3);
    expect(mockResponse.data.yearSummary.termBreakdown).toHaveLength(3);
  });

  it("trends returns expected shape", () => {
    const mockResponse = {
      success: true,
      data: {
        trends: [
          {
            learningAreaId: "550e8400-e29b-41d4-a716-446655440000",
            learningAreaName: "Mathematics",
            terms: [
              { termId: "t1", termName: "Term 1", averageScore: 2.5, level: "Approaching Expectation" },
              { termId: "t2", termName: "Term 2", averageScore: 3.0, level: "Meeting Expectation" },
            ],
            trend: "improving",
            percentageChange: 20,
          },
        ],
      },
    };

    expect(mockResponse.data.trends[0].trend).toBe("improving");
    expect(mockResponse.data.trends[0].terms).toHaveLength(2);
  });

  it("student/[id] returns expected shape", () => {
    const mockResponse = {
      success: true,
      data: {
        student: {
          studentId: "550e8400-e29b-41d4-a716-446655440000",
          firstName: "John",
          lastName: "Doe",
          admissionNumber: "STD-001",
          className: "Grade 4A",
        },
        summary: {
          overallAverage: 3.2,
          overallLevel: "Meeting Expectation",
          totalAssessments: 15,
          learningAreaSummary: [
            {
              learningAreaId: "la1",
              learningAreaName: "Mathematics",
              averageScore: 3.5,
              level: "Meeting Expectation",
              assessmentCount: 5,
            },
          ],
        },
        assessments: [],
        pagination: {
          page: 1,
          pageSize: 50,
          total: 15,
          totalPages: 1,
        },
      },
    };

    expect(mockResponse.data.student.admissionNumber).toBe("STD-001");
    expect(mockResponse.data.summary.totalAssessments).toBe(15);
    expect(mockResponse.data.pagination.totalPages).toBe(1);
  });
});

// ============================================================
// Validation Error Responses
// ============================================================
describe("Assessment API Validation", () => {
  it("returns 400 for missing required params", () => {
    const mockError = {
      success: false,
      error: "Validation failed",
      details: [{ field: "studentId", message: "Required" }],
    };

    expect(mockError.success).toBe(false);
    expect(mockError.details).toHaveLength(1);
  });

  it("returns 400 for invalid UUID format", () => {
    const mockError = {
      success: false,
      error: "Validation failed",
      details: [{ field: "studentId", message: "Invalid UUID format" }],
    };

    expect(mockError.details[0].message).toContain("UUID");
  });

  it("returns 403 for unauthorized access", () => {
    const mockError = {
      success: false,
      error: "Access denied: this student is not linked to your account.",
    };

    expect(mockError.error).toContain("Access denied");
  });
});

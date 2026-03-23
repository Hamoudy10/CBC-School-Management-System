// app/api/learning-areas/route.ts
// ============================================================
// GET /api/learning-areas - List learning areas
// POST /api/learning-areas - Create learning area
// ============================================================

import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  listLearningAreas,
  createLearningArea,
  getAllCBCHierarchies,
  learningAreaFiltersSchema,
  createLearningAreaSchema,
} from "@/features/academics";

// ============================================================
// GET Handler
// ============================================================
export const GET = withPermission(
  "academics",
  "view",
  async (request, { user }) => {
    const { searchParams } = new URL(request.url);
    const includeHierarchy = searchParams.get("includeHierarchy") === "true";

    if (includeHierarchy) {
      const hierarchies = await getAllCBCHierarchies(user);

      return successResponse(
        hierarchies.map((item) => ({
          learning_area_id: item.learningArea.learningAreaId,
          learningAreaId: item.learningArea.learningAreaId,
          name: item.learningArea.name,
          is_core: item.learningArea.isCore,
          isCore: item.learningArea.isCore,
          strands: item.strands.map((strandEntry) => ({
            strand_id: strandEntry.strand.strandId,
            strandId: strandEntry.strand.strandId,
            name: strandEntry.strand.name,
            sub_strands: strandEntry.subStrands.map((subStrandEntry) => ({
              sub_strand_id: subStrandEntry.subStrand.subStrandId,
              subStrandId: subStrandEntry.subStrand.subStrandId,
              name: subStrandEntry.subStrand.name,
              competencies: subStrandEntry.competencies.map((competency) => ({
                competency_id: competency.competencyId,
                competencyId: competency.competencyId,
                name: competency.name,
                description: competency.description,
              })),
            })),
          })),
        })),
      );
    }

    const validation = validateQuery(searchParams, learningAreaFiltersSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await listLearningAreas(validation.data!, user);

    return successResponse(result.data, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
  },
);

// ============================================================
// POST Handler
// ============================================================
export const POST = withPermission(
  "academics",
  "create",
  async (request, { user }) => {
    const validation = await validateBody(request, createLearningAreaSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await createLearningArea(validation.data!, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return createdResponse({
      learningAreaId: result.id,
      message: result.message,
    });
  },
);

// features/special-needs/index.ts
// Barrel export for special needs module

export {
  NEEDS_TYPE_LABELS,
  type NeedsType,
  type AssessmentAdjustment,
  type SpecialNeed,
  type SpecialNeedFilters,
  type PaginatedResponse,
} from "./types";

export {
  createSpecialNeedSchema,
  updateSpecialNeedSchema,
  specialNeedFiltersSchema,
  type CreateSpecialNeedInput,
  type UpdateSpecialNeedInput,
  type SpecialNeedFiltersInput,
} from "./validators/special-needs.schema";

export {
  listSpecialNeeds,
  getSpecialNeedById,
  createSpecialNeed,
  updateSpecialNeed,
  deleteSpecialNeed,
} from "./services/special-needs.service";

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  count: number;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  data: T[];
}

/**
 * Parses and bounds pagination parameters to protect memory and database performance (PDF Section 7)
 * - Enforces minimum page = 1
 * - Applies defaultLimit (default 20)
 * - Enforces hard ceiling maxLimit (default 100) even when client requests higher
 */
export const parsePagination = (
  query: Record<string, any>,
  defaultLimit = 20,
  maxLimit = 100
): PaginationParams => {
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) page = 1;

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const buildPaginatedResponse = <T>(
  data: T[],
  totalCount: number,
  pagination: PaginationParams
): PaginatedResponse<T> => {
  const totalPages = Math.ceil(totalCount / pagination.limit) || 1;
  return {
    success: true,
    count: data.length,
    totalCount,
    currentPage: pagination.page,
    totalPages,
    hasNextPage: pagination.page < totalPages,
    hasPrevPage: pagination.page > 1,
    data,
  };
};

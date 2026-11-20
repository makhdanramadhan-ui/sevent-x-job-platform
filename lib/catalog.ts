import { ApiError } from './http';
import { canonicalizeCatalogValues } from './catalog-core';

export * from './catalog-core';

export function canonicalizeOrThrow(
  values: readonly string[],
  index: ReadonlyMap<string, string>,
  field: string,
): string[] {
  const result = canonicalizeCatalogValues(values, index);
  if (result.invalid.length > 0) {
    throw new ApiError(
      400,
      'validation_error',
      `Nilai ${field} tidak dikenal: ${result.invalid.join(', ')}. Pilih dari daftar yang tersedia.`,
      { field, invalid: result.invalid },
    );
  }
  return result.values;
}

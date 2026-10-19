// POSIX-space path normalization for declared package members (they are
// POSIX-form rels by construction; win32 path.normalize flips separators
// and would flag every declared path as unsafe).
import { normalize } from 'node:path/posix';
export const posixNormalize = normalize;

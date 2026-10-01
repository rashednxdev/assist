import { CIRCULAR_DOC_TYPES, CIRCULAR_ISSUERS, POLICY_COLLECTIONS, TOOLKIT_KINDS } from '@ibas/shared-constants';

const issuerLabels = new Map<string, string>(CIRCULAR_ISSUERS.map((i) => [i.code, i.label]));
const docTypeLabels = new Map<string, string>(CIRCULAR_DOC_TYPES.map((d) => [d.code, d.label]));
const collectionNames = new Map<string, string>(POLICY_COLLECTIONS.map((c) => [c.code, c.name_en]));
export const issuerLabel = (code: string) => issuerLabels.get(code) ?? code;
export const docTypeLabel = (code: string) => docTypeLabels.get(code) ?? code;
export const collectionName = (code: string) => collectionNames.get(code) ?? code;
const kindLabels = new Map<string, string>(TOOLKIT_KINDS.map((k) => [k.code, k.label]));

export const toolkitKindLabel = (code: string) => kindLabels.get(code) ?? code;

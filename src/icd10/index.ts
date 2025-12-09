/**
 * ICD-10/CPT Module Exports
 *
 * NOTE: These functions require licensing:
 * - ICD-10: UMLS Terminology Services account
 * - CPT: AMA licensing
 */

export {
  searchICD10Codes,
  searchCPTCodes,
  formatICD10Codes,
  formatCPTCodes,
  type ICD10Code,
  type CPTCode,
} from "./lookup.js";

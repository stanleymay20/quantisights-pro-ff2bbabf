// NEW, additive structural-role inference. Does not modify or call the
// legacy `inferSchema` -- it derives roles directly from FieldProfile[].
//
// The one behavior it exists specifically to fix (audit §4.6, phase brief
// item 7): the legacy inferSchema keeps exactly one "date" column and
// force-demotes every other date-like column to a generic "segment",
// losing its time-dimension semantics. This function proposes a
// StructuralRoleProposal for every field independently -- if five columns
// are all date-like (order_date, ship_date, delivery_date, invoice_date,
// payment_date), all five get a date-family role, not just the
// highest-confidence one.
import {
  makeStructuralRoleProposal,
  type StructuralRole,
  type StructuralRoleProposal,
} from "./inference";
import { makeEvidence } from "./evidence";
import type { FieldProfile } from "./field-profile";

const RULE_VERSION = "infer-structural-roles:v1";

const DATE_ROLE_HEADER_HINTS: Array<{ pattern: RegExp; role: StructuralRole }> = [
  { pattern: /(invoice|payment|billing)/i, role: "transaction_date" },
  { pattern: /(order|purchase|sale)/i, role: "transaction_date" },
  { pattern: /(ship|deliver|dispatch|fulfil)/i, role: "event_timestamp" },
  { pattern: /(period|month|quarter|fiscal|reporting)/i, role: "reporting_period" },
];

/** Exported so compat/from-legacy-schema.ts can assign the same date-family role from a header string, without duplicating the pattern list. */
export function proposeDateRoleFromHeader(normalizedHeader: string): StructuralRole {
  for (const hint of DATE_ROLE_HEADER_HINTS) {
    if (hint.pattern.test(normalizedHeader)) return hint.role;
  }
  return "event_timestamp";
}

function proposeDateRole(profile: FieldProfile): StructuralRole {
  return proposeDateRoleFromHeader(profile.normalizedHeader);
}

const DATE_RATE_THRESHOLD = 0.6;
const NUMERIC_RATE_THRESHOLD = 0.6;
const BOOLEAN_RATE_THRESHOLD = 0.85;
const IDENTIFIER_LIKELIHOOD_THRESHOLD = 0.6;

const CURRENCY_HEADER = /(revenue|cost|price|amount|profit|cash|salary|spend|balance|payable|receivable|budget|expense|income)/i;
const UNIT_HEADER = /(unit|uom|measure|qty_unit|weight_unit)/i;
const PRIMARY_KEY_HEADER = /^(id|.*_id|.*_uuid|.*_guid)$/i;
const FOREIGN_KEY_HEADER = /(_id|_no|_number|_ref|_reference)$/i;

/**
 * Derives a StructuralRoleProposal for a single field. Pure function of
 * its FieldProfile -- callers assemble the full-dataset proposal list and
 * are responsible for any cross-field arbitration they want (e.g. "which
 * date is the primary analytical date for a chart default"), which this
 * function deliberately does not decide, so no date field's proposal is
 * ever silently downgraded to a non-date role the way the legacy demotion
 * rule does.
 */
export function inferFieldStructuralRole(profile: FieldProfile): StructuralRoleProposal {
  const evidence = [
    makeEvidence({
      evidenceType: "sample_statistic",
      description: "date-rate over sampled values",
      sourceLocation: { column: profile.originalColumnPosition },
      observedStatistic: `dateRate=${profile.dateRate.toFixed(2)}`,
      ruleOrMethod: RULE_VERSION,
      weight: 0.6,
      stance: profile.dateRate >= DATE_RATE_THRESHOLD ? "supporting" : "neutral",
    }),
    makeEvidence({
      evidenceType: "sample_statistic",
      description: "numeric-rate over sampled values",
      sourceLocation: { column: profile.originalColumnPosition },
      observedStatistic: `numericRate=${profile.numericRate.toFixed(2)}`,
      ruleOrMethod: RULE_VERSION,
      weight: 0.6,
      stance: profile.numericRate >= NUMERIC_RATE_THRESHOLD ? "supporting" : "neutral",
    }),
    makeEvidence({
      evidenceType: "header_pattern",
      description: "normalized header inspected for role hints",
      sourceLocation: { column: profile.originalColumnPosition },
      observedStatistic: `normalizedHeader="${profile.normalizedHeader}"`,
      ruleOrMethod: RULE_VERSION,
      weight: 0.4,
      stance: "neutral",
    }),
  ];

  let role: StructuralRole = "unknown";
  let evidenceScore = 40;
  let reviewRequired = true;

  if (profile.identifierLikelihood >= IDENTIFIER_LIKELIHOOD_THRESHOLD && PRIMARY_KEY_HEADER.test(profile.normalizedHeader)) {
    role = "primary_key_candidate";
    evidenceScore = Math.round(60 + profile.identifierLikelihood * 30);
    reviewRequired = false;
  } else if (profile.identifierLikelihood >= IDENTIFIER_LIKELIHOOD_THRESHOLD && FOREIGN_KEY_HEADER.test(profile.normalizedHeader)) {
    role = "foreign_key_candidate";
    evidenceScore = Math.round(55 + profile.identifierLikelihood * 30);
    reviewRequired = true;
  } else if (profile.dateRate >= DATE_RATE_THRESHOLD) {
    // Every date-like field gets its own proposal -- no single-winner
    // demotion. See module header comment.
    role = proposeDateRole(profile);
    evidenceScore = Math.round(55 + profile.dateRate * 35);
    reviewRequired = profile.dateRate < 0.85;
  } else if (profile.booleanRate >= BOOLEAN_RATE_THRESHOLD) {
    role = "status";
    evidenceScore = Math.round(60 + profile.booleanRate * 30);
    reviewRequired = false;
  } else if (profile.numericRate >= NUMERIC_RATE_THRESHOLD) {
    if (CURRENCY_HEADER.test(profile.normalizedHeader)) {
      role = "currency_field";
      evidenceScore = Math.round(55 + profile.numericRate * 30);
    } else if (UNIT_HEADER.test(profile.normalizedHeader)) {
      role = "unit_field";
      evidenceScore = Math.round(50 + profile.numericRate * 30);
    } else {
      role = "metric";
      evidenceScore = Math.round(50 + profile.numericRate * 30);
    }
    reviewRequired = evidenceScore < 75;
  } else if (profile.nullRate < 0.5 && profile.distinctCount > 1) {
    role = profile.distinctCount <= 50 ? "entity_attribute" : "descriptive_text";
    evidenceScore = 50;
    reviewRequired = true;
  }

  return makeStructuralRoleProposal({
    fieldId: profile.fieldId,
    proposedRole: role,
    evidence,
    contradictoryEvidence: [],
    evidenceScore: Math.min(95, evidenceScore),
    alternativesConsidered: [],
    mappingMethod: RULE_VERSION,
    reviewRequired,
    ruleOrModelVersion: RULE_VERSION,
  });
}

/** Derives structural-role proposals for every field, preserving multiple date fields. */
export function inferStructuralRoles(profiles: FieldProfile[]): StructuralRoleProposal[] {
  return profiles.map(inferFieldStructuralRole);
}

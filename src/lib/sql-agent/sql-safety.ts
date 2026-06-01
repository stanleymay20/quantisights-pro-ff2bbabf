import type { SQLSafetyFlag } from './types'

const DDL_PATTERN = /\b(CREATE|DROP|ALTER|TRUNCATE)\b/i
const DML_PATTERN = /\b(INSERT|UPDATE|DELETE|MERGE|UPSERT)\b/i
const DANGEROUS_FN_PATTERN = /\b(pg_read_file|xp_cmdshell|LOAD_FILE|UTL_FILE)\b/i
const SELECT_STAR_NO_LIMIT = /SELECT\s+\*[^;]*$/i
const MULTIPLE_SEMICOLONS = /;[^;]*;/
const SYSTEM_TABLE_PATTERN = /\b(pg_catalog\.|information_schema\.|sys\.|mysql\.user)\b/i

export function validateSQL(sql: string): SQLSafetyFlag[] {
  const flags: SQLSafetyFlag[] = []

  if (DDL_PATTERN.test(sql)) {
    flags.push({
      severity: 'error',
      rule: 'no-ddl',
      message: 'DDL statements (CREATE, DROP, ALTER, TRUNCATE) are not allowed.',
    })
  }

  if (DML_PATTERN.test(sql)) {
    flags.push({
      severity: 'error',
      rule: 'no-dml',
      message: 'DML write statements (INSERT, UPDATE, DELETE, MERGE, UPSERT) are not allowed.',
    })
  }

  if (DANGEROUS_FN_PATTERN.test(sql)) {
    flags.push({
      severity: 'error',
      rule: 'no-dangerous-functions',
      message: 'Dangerous system functions (pg_read_file, xp_cmdshell, LOAD_FILE, UTL_FILE) are not allowed.',
    })
  }

  // Warn if SELECT * without LIMIT (check case-insensitively, strip trailing whitespace)
  const normalised = sql.replace(/\s+/g, ' ').trim()
  if (/SELECT\s+\*/i.test(normalised) && !/LIMIT\s+\d+/i.test(normalised)) {
    flags.push({
      severity: 'warning',
      rule: 'no-limit-bypass',
      message: 'SELECT * without LIMIT may return excessive rows.',
    })
  }

  // Warn on multiple statements
  const semicolonMatches = (sql.match(/;/g) || []).length
  if (semicolonMatches > 1) {
    flags.push({
      severity: 'warning',
      rule: 'no-semicolon-injection',
      message: 'Multiple statements detected — possible injection risk.',
    })
  }

  if (SYSTEM_TABLE_PATTERN.test(sql)) {
    flags.push({
      severity: 'warning',
      rule: 'no-system-tables',
      message: 'Query references system tables (pg_catalog, information_schema, sys, mysql.user).',
    })
  }

  return flags
}

export function isSQLSafe(sql: string): boolean {
  return !validateSQL(sql).some(f => f.severity === 'error')
}

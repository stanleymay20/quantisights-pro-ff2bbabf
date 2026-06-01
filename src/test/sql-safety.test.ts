import { describe, it, expect } from 'vitest'
import { validateSQL, isSQLSafe } from '@/lib/sql-agent/sql-safety'

describe('sql-safety', () => {
  describe('DDL rejection', () => {
    it('rejects CREATE TABLE', () => {
      const flags = validateSQL('CREATE TABLE foo (id int)')
      expect(flags.some(f => f.severity === 'error' && f.rule === 'no-ddl')).toBe(true)
    })

    it('rejects DROP TABLE', () => {
      const flags = validateSQL('DROP TABLE foo')
      expect(flags.some(f => f.severity === 'error' && f.rule === 'no-ddl')).toBe(true)
    })

    it('rejects ALTER TABLE', () => {
      const flags = validateSQL('ALTER TABLE foo ADD COLUMN bar text')
      expect(flags.some(f => f.severity === 'error' && f.rule === 'no-ddl')).toBe(true)
    })

    it('rejects TRUNCATE', () => {
      const flags = validateSQL('TRUNCATE TABLE foo')
      expect(flags.some(f => f.severity === 'error' && f.rule === 'no-ddl')).toBe(true)
    })
  })

  describe('DML rejection', () => {
    it('rejects INSERT', () => {
      const flags = validateSQL("INSERT INTO foo VALUES (1, 'bar')")
      expect(flags.some(f => f.severity === 'error' && f.rule === 'no-dml')).toBe(true)
    })

    it('rejects UPDATE', () => {
      const flags = validateSQL('UPDATE foo SET bar = 1')
      expect(flags.some(f => f.severity === 'error' && f.rule === 'no-dml')).toBe(true)
    })

    it('rejects DELETE', () => {
      const flags = validateSQL('DELETE FROM foo WHERE id = 1')
      expect(flags.some(f => f.severity === 'error' && f.rule === 'no-dml')).toBe(true)
    })

    it('rejects MERGE', () => {
      const flags = validateSQL('MERGE INTO foo USING bar ON foo.id = bar.id')
      expect(flags.some(f => f.severity === 'error' && f.rule === 'no-dml')).toBe(true)
    })
  })

  describe('dangerous functions', () => {
    it('rejects pg_read_file', () => {
      const flags = validateSQL("SELECT pg_read_file('/etc/passwd')")
      expect(flags.some(f => f.severity === 'error' && f.rule === 'no-dangerous-functions')).toBe(true)
    })

    it('rejects xp_cmdshell', () => {
      const flags = validateSQL("EXEC xp_cmdshell 'dir'")
      expect(flags.some(f => f.severity === 'error' && f.rule === 'no-dangerous-functions')).toBe(true)
    })
  })

  describe('warnings', () => {
    it('warns on SELECT * without LIMIT', () => {
      const flags = validateSQL('SELECT * FROM orders')
      expect(flags.some(f => f.severity === 'warning' && f.rule === 'no-limit-bypass')).toBe(true)
    })

    it('does not warn on SELECT * with LIMIT', () => {
      const flags = validateSQL('SELECT * FROM orders LIMIT 100')
      expect(flags.some(f => f.rule === 'no-limit-bypass')).toBe(false)
    })

    it('warns on multiple semicolons', () => {
      const flags = validateSQL('SELECT 1; SELECT 2;')
      expect(flags.some(f => f.severity === 'warning' && f.rule === 'no-semicolon-injection')).toBe(true)
    })

    it('warns on system table references', () => {
      const flags = validateSQL('SELECT * FROM pg_catalog.pg_tables')
      expect(flags.some(f => f.severity === 'warning' && f.rule === 'no-system-tables')).toBe(true)
    })

    it('warns on information_schema', () => {
      const flags = validateSQL('SELECT * FROM information_schema.tables')
      expect(flags.some(f => f.severity === 'warning' && f.rule === 'no-system-tables')).toBe(true)
    })
  })

  describe('clean SELECT', () => {
    it('passes with no flags for a safe query', () => {
      const flags = validateSQL('SELECT id, name, amount FROM orders WHERE status = \'paid\' LIMIT 100')
      expect(flags).toHaveLength(0)
    })
  })

  describe('isSQLSafe', () => {
    it('returns false when error-level flags exist', () => {
      expect(isSQLSafe('DROP TABLE users')).toBe(false)
    })

    it('returns true for warning-only flags', () => {
      expect(isSQLSafe('SELECT * FROM orders')).toBe(true)
    })

    it('returns true for clean query', () => {
      expect(isSQLSafe('SELECT id FROM users LIMIT 10')).toBe(true)
    })
  })
})

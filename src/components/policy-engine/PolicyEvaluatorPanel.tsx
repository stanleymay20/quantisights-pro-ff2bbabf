import React from 'react'
import type { PolicyEvaluationResult } from '@/lib/policy-engine/types'

interface PolicyEvaluatorPanelProps {
  result: PolicyEvaluationResult | null
  isLoading: boolean
}

export function PolicyEvaluatorPanel({ result, isLoading }: PolicyEvaluatorPanelProps) {
  if (isLoading) {
    return <div className="text-sm text-muted-foreground animate-pulse">Evaluating policies...</div>
  }
  if (!result) {
    return <div className="text-sm text-muted-foreground">Run a test to see results.</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`text-2xl ${result.allowed ? '✅' : '🚫'}`} />
        <div>
          <p className={`text-lg font-semibold ${result.allowed ? 'text-green-600' : 'text-red-600'}`}>
            {result.allowed ? 'Access Allowed' : 'Access Denied'}
          </p>
          <p className="text-sm text-muted-foreground">Effect: {result.effect}</p>
        </div>
      </div>

      {result.violations.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-1">Violations ({result.violations.length})</p>
          <ul className="space-y-1">
            {result.violations.map((v) => (
              <li key={v.policyId} className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded">
                {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.maskedColumns.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-1">Masked Columns</p>
          <div className="flex flex-wrap gap-1">
            {result.maskedColumns.map((col) => (
              <span key={col} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                {col}
              </span>
            ))}
          </div>
        </div>
      )}

      {result.requiresApproval && (
        <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded text-sm">
          This action requires approval before proceeding.
        </div>
      )}

      {result.warnings.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-1">Warnings</p>
          <ul className="space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-sm text-amber-600">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

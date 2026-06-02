import React, { useState, useEffect } from 'react'
import { PolicyList } from '@/components/policy-engine/PolicyList'
import { PolicyEvaluatorPanel } from '@/components/policy-engine/PolicyEvaluatorPanel'
import { policyStore } from '@/lib/policy-engine/policy-store'
import { enforce } from '@/lib/policy-engine/policy-enforcer'
import type { Policy, PolicyEvaluationResult, PolicyEvaluationContext, PolicyType, PolicyEffect, PolicyCondition } from '@/lib/policy-engine/types'

export default function PolicyEnginePage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [testResult, setTestResult] = useState<PolicyEvaluationResult | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [testCtx, setTestCtx] = useState<Partial<PolicyEvaluationContext>>({
    containsPII: false,
    queryType: 'read',
    rowCount: 100,
    dataResidency: 'eu',
    organizationId: 'demo-org',
  })

  // Add form state
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<PolicyType>('pii_access')
  const [newEffect, setNewEffect] = useState<PolicyEffect>('warn')
  const [newField, setNewField] = useState('column.contains_pii')
  const [newValue, setNewValue] = useState('true')

  useEffect(() => {
    policyStore.loadDefaults()
    setPolicies(policyStore.listEnabled().concat(
      policyStore.listByType('approval').filter((p) => !p.enabled)
    ))
  }, [])

  const refresh = () => {
    const all = [...policyStore.listEnabled()]
    // Include disabled ones too for display
    const disabled = policyStore.listByType('approval').filter((p) => !p.enabled)
    const seen = new Set(all.map((p) => p.id))
    disabled.forEach((p) => { if (!seen.has(p.id)) all.push(p) })
    setPolicies(all)
  }

  const handleToggle = (id: string, enabled: boolean) => {
    policyStore.update(id, { enabled })
    refresh()
  }

  const handleRemove = (id: string) => {
    policyStore.remove(id)
    refresh()
  }

  const handleTest = async () => {
    setIsEvaluating(true)
    try {
      const result = await enforce(testCtx as PolicyEvaluationContext)
      setTestResult(result)
    } finally {
      setIsEvaluating(false)
    }
  }

  const handleAddPolicy = () => {
    if (!newName.trim()) return
    let parsedValue: unknown = newValue
    if (newValue === 'true') parsedValue = true
    else if (newValue === 'false') parsedValue = false
    else if (!isNaN(Number(newValue))) parsedValue = Number(newValue)

    const condition: PolicyCondition = { field: newField, operator: 'eq', value: parsedValue }
    policyStore.add({
      name: newName,
      description: '',
      type: newType,
      conditions: [condition],
      effect: newEffect,
      priority: 50,
      enabled: true,
    })
    setNewName('')
    refresh()
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Policy Enforcement Engine</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Define, manage, and test access control policies across all data operations.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Active Policies</h2>
        <PolicyList policies={policies} onToggle={handleToggle} onRemove={handleRemove} />
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-semibold">Add Policy</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="Policy name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select
            className="border rounded px-3 py-2 text-sm"
            value={newType}
            onChange={(e) => setNewType(e.target.value as PolicyType)}
          >
            {(['pii_access','data_residency','retention','approval','rate_limit','row_security','column_security'] as PolicyType[]).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={newEffect}
            onChange={(e) => setNewEffect(e.target.value as PolicyEffect)}
          >
            {(['allow','deny','require_approval','mask','warn'] as PolicyEffect[]).map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="Condition field (e.g. column.contains_pii)"
            value={newField}
            onChange={(e) => setNewField(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="Value (e.g. true, query)"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <button
            onClick={handleAddPolicy}
            className="bg-primary text-primary-foreground rounded px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Add Policy
          </button>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-semibold">Test Policy Evaluation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Contains PII
            <input
              type="checkbox"
              checked={testCtx.containsPII ?? false}
              onChange={(e) => setTestCtx((c) => ({ ...c, containsPII: e.target.checked }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Query Type
            <select
              className="border rounded px-2 py-1"
              value={testCtx.queryType ?? 'read'}
              onChange={(e) => setTestCtx((c) => ({ ...c, queryType: e.target.value as PolicyEvaluationContext['queryType'] }))}
            >
              {(['read','schema_discovery','preview','query'] as const).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Row Count
            <input
              type="number"
              className="border rounded px-2 py-1"
              value={testCtx.rowCount ?? 100}
              onChange={(e) => setTestCtx((c) => ({ ...c, rowCount: Number(e.target.value) }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Data Residency
            <input
              className="border rounded px-2 py-1"
              value={testCtx.dataResidency ?? ''}
              onChange={(e) => setTestCtx((c) => ({ ...c, dataResidency: e.target.value }))}
            />
          </label>
        </div>
        <button
          onClick={handleTest}
          disabled={isEvaluating}
          className="bg-primary text-primary-foreground rounded px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {isEvaluating ? 'Evaluating…' : 'Run Test'}
        </button>
        <PolicyEvaluatorPanel result={testResult} isLoading={isEvaluating} />
      </div>
    </div>
  )
}

import React from 'react'
import type { Policy, PolicyEffect } from '@/lib/policy-engine/types'

const effectColors: Record<PolicyEffect, string> = {
  deny: 'bg-red-100 text-red-700',
  mask: 'bg-amber-100 text-amber-700',
  require_approval: 'bg-blue-100 text-blue-700',
  warn: 'bg-gray-100 text-gray-700',
  allow: 'bg-green-100 text-green-700',
}

interface PolicyListProps {
  policies: Policy[]
  onToggle: (id: string, enabled: boolean) => void
  onRemove: (id: string) => void
}

export function PolicyList({ policies, onToggle, onRemove }: PolicyListProps) {
  if (policies.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No policies defined.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-left font-medium">Type</th>
            <th className="px-4 py-2 text-left font-medium">Effect</th>
            <th className="px-4 py-2 text-left font-medium">Priority</th>
            <th className="px-4 py-2 text-left font-medium">Enabled</th>
            <th className="px-4 py-2 text-left font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr key={policy.id} className="border-t hover:bg-muted/20">
              <td className="px-4 py-2 font-medium">{policy.name}</td>
              <td className="px-4 py-2 text-muted-foreground">{policy.type}</td>
              <td className="px-4 py-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${effectColors[policy.effect]}`}>
                  {policy.effect}
                </span>
              </td>
              <td className="px-4 py-2 text-muted-foreground">{policy.priority}</td>
              <td className="px-4 py-2">
                <input
                  type="checkbox"
                  checked={policy.enabled}
                  onChange={(e) => onToggle(policy.id, e.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
              </td>
              <td className="px-4 py-2">
                <button
                  onClick={() => onRemove(policy.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

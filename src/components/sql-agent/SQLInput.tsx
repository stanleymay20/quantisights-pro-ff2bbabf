import { useState, useCallback, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const MAX_CHARS = 500

interface SQLInputProps {
  onSubmit: (query: string) => void
  isLoading: boolean
  disabled?: boolean
}

export function SQLInput({ onSubmit, isLoading, disabled }: SQLInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isLoading || disabled) return
    onSubmit(trimmed)
    setValue('')
  }, [value, isLoading, disabled, onSubmit])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const remaining = MAX_CHARS - value.length

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Ask a question about your data..."
        value={value}
        onChange={e => setValue(e.target.value.slice(0, MAX_CHARS))}
        onKeyDown={handleKeyDown}
        disabled={isLoading || disabled}
        rows={3}
        className="resize-none text-sm"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${remaining < 50 ? 'text-amber-500' : 'text-muted-foreground'}`}>
          {remaining} characters remaining
        </span>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isLoading || disabled || !value.trim()}
        >
          {isLoading ? 'Thinking…' : 'Ask'}
        </Button>
      </div>
    </div>
  )
}

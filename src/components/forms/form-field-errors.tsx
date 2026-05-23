'use client'

type FieldError = { _errors?: string[] } | undefined

export default function FormFieldErrors({
  errors,
  field,
}: {
  // next-safe-action `result.validationErrors` shape (Zod 4 nested format):
  // { fieldName: { _errors: ['message'] }, ... }
  errors: Record<string, FieldError> | undefined
  field: string
}) {
  const messages = errors?.[field]?._errors ?? []
  if (messages.length === 0) return null
  return (
    <p className="text-xs text-rose-600" role="alert">
      {messages.join(' · ')}
    </p>
  )
}

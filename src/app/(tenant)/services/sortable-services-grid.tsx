'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { GripVertical } from 'lucide-react'
import { reorderServicesAction } from './actions'

// Wraps a server-rendered grid of service cards in a drag-and-drop sortable
// context. The caller provides the cards as { id, node } pairs — this
// component manages order state + persists changes via reorderServicesAction.

export default function SortableServicesGrid({
  items,
}: {
  items: { id: string; node: ReactNode }[]
}) {
  const [orderedIds, setOrderedIds] = useState(() => items.map((i) => i.id))

  // Resync if the server prop changes (after create / delete / restore the
  // grid re-renders with a new list; we keep the order from the server).
  useEffect(() => {
    setOrderedIds(items.map((i) => i.id))
  }, [items])

  const { execute } = useAction(reorderServicesAction, {
    onError: ({ error }) => toast.error(error.serverError?.message ?? '排序儲存失敗'),
  })

  // Activation distance avoids accidental drags when the user clicks an
  // action button inside the card (edit / archive).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = orderedIds.indexOf(String(active.id))
    const to = orderedIds.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    const next = arrayMove(orderedIds, from, to)
    setOrderedIds(next)
    execute({ orderedIds: next })
  }

  const byId = new Map(items.map((i) => [i.id, i.node]))

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orderedIds.map((id) => (
            <SortableCard key={id} id={id}>
              {byId.get(id)}
            </SortableCard>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="relative"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="拖曳排序"
        className="absolute right-2 top-2 z-10 grid size-7 cursor-grab place-items-center rounded-full bg-card/80 text-muted-foreground opacity-60 transition hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      {children}
    </div>
  )
}

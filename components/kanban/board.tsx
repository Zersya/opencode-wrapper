"use client"

import * as React from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"
import { KanbanColumn } from "./column"
import { TaskCard } from "./task-card"
import type { Task } from "@/lib/db/schema"

interface KanbanBoardProps {
  tasks: Task[]
  projectId: number
  className?: string
  onTaskMove?: (taskId: number, newStatus: string) => void
  onAddTask?: (status: string) => void
}

const columns = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "Todo" },
  { id: "in-progress", title: "In Progress" },
  { id: "in-review", title: "In Review" },
  { id: "done", title: "Done" },
]

export function KanbanBoard({
  tasks,
  projectId,
  className,
  onTaskMove,
  onAddTask,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = React.useState<number | null>(null)
  const [taskMap, setTaskMap] = React.useState<Record<string, Task[]>>(() => {
    const map: Record<string, Task[]> = {
      backlog: [],
      todo: [],
      "in-progress": [],
      "in-review": [],
      done: [],
      canceled: [],
    }

    tasks.forEach((task) => {
      const status = task.status.replace("_", "-")
      if (map[status]) {
        map[status].push(task)
      }
    })

    return map
  })

  React.useEffect(() => {
    const map: Record<string, Task[]> = {
      backlog: [],
      todo: [],
      "in-progress": [],
      "in-review": [],
      done: [],
      canceled: [],
    }

    tasks.forEach((task) => {
      const status = task.status.replace("_", "-")
      if (map[status]) {
        map[status].push(task)
      }
    })

    setTaskMap(map)
  }, [tasks])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as number)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as number
    const overId = over.id

    const activeStatus = Object.entries(taskMap).find(([_, tasks]) =>
      tasks.some((t) => t.id === activeId)
    )?.[0]

    let overStatus: string | undefined

    if (over.id.toString().startsWith("column-")) {
      overStatus = over.id.toString().replace("column-", "")
    } else {
      overStatus = Object.entries(taskMap).find(([_, tasks]) =>
        tasks.some((t) => t.id === overId)
      )?.[0]
    }

    if (!activeStatus || !overStatus || activeStatus === overStatus) return

    setTaskMap((prev) => {
      const activeTasks = [...(prev[activeStatus] || [])]
      const overTasks = [...(prev[overStatus] || [])]

      const activeIndex = activeTasks.findIndex((t) => t.id === activeId)
      if (activeIndex === -1) return prev
      
      const [activeTask] = activeTasks.splice(activeIndex, 1)

      const overIndex = overTasks.findIndex((t) => t.id === overId)
      if (overIndex >= 0) {
        overTasks.splice(overIndex, 0, activeTask)
      } else {
        overTasks.push(activeTask)
      }

      return {
        ...prev,
        [activeStatus]: activeTasks,
        [overStatus]: overTasks,
      }
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as number
    const overId = over.id

    const activeStatus = Object.entries(taskMap).find(([_, tasks]) =>
      tasks.some((t) => t.id === activeId)
    )?.[0]

    let overStatus: string | undefined

    if (over.id.toString().startsWith("column-")) {
      overStatus = over.id.toString().replace("column-", "")
    } else {
      overStatus = Object.entries(taskMap).find(([_, tasks]) =>
        tasks.some((t) => t.id === overId)
      )?.[0]
    }

    if (!activeStatus || !overStatus || activeStatus === overStatus) return

    onTaskMove?.(activeId, overStatus.replace("-", "_"))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={cn(
        "flex gap-4 h-full overflow-x-auto overflow-y-hidden pb-4 scrollbar-custom",
        className
      )}>
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            id={`column-${column.id}`}
            title={column.title}
            tasks={taskMap[column.id] || []}
            taskIds={(taskMap[column.id] || []).map((t) => t.id)}
            onAddTask={() => onAddTask?.(column.id.replace("-", "_"))}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask as any} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

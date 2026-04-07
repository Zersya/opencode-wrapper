"use client"

import * as React from "react"
import { Plus, Settings, GitBranch, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { KanbanBoard } from "@/components/kanban"
import { CreateTaskForm } from "@/components/tasks"
import { moveTask } from "@/lib/actions/tasks"
import type { Task, Project } from "@/lib/db/schema"

interface ProjectWithTasks extends Project {
  tasks: Task[]
}

interface ProjectClientProps {
  project: ProjectWithTasks
}

export function ProjectClient({ project }: ProjectClientProps) {
  const handleTaskMove = async (taskId: number, newStatus: string) => {
    await moveTask(taskId, newStatus)
  }

  const handleAddTask = (status: string) => {
    console.log(`Add task with status ${status}`)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <GitBranch className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">{project.name}</h1>
            <p className="text-sm text-gray-500">{project.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-gray-800 text-gray-300">
            {project.tasks.length} tasks
          </Badge>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
            <Settings className="h-4 w-4" />
          </Button>
          <CreateTaskForm projectId={project.id} />
        </div>
      </div>

      <Tabs defaultValue="board" className="flex-1 flex flex-col">
        <div className="px-6 border-b border-gray-800">
          <TabsList className="bg-transparent border-b-0">
            <TabsTrigger
              value="board"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-white text-gray-400"
            >
              Board
            </TabsTrigger>
            <TabsTrigger
              value="list"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-white text-gray-400"
            >
              List
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-white text-gray-400"
            >
              Timeline
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="board" className="flex-1 p-6 m-0 overflow-hidden">
          <div className="h-full overflow-x-auto">
            <KanbanBoard
              tasks={project.tasks}
              projectId={project.id}
              onTaskMove={handleTaskMove}
              onAddTask={handleAddTask}
            />
          </div>
        </TabsContent>

        <TabsContent value="list" className="flex-1 p-6 m-0">
          <div className="text-center text-gray-400 py-12">
            List view coming soon...
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 p-6 m-0">
          <div className="text-center text-gray-400 py-12">
            Timeline view coming soon...
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

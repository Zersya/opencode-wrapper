"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import type { Project } from "@/lib/db/schema"

interface CreateProjectFormProps {
  organizationId: number
  onProjectCreated?: (project: Project) => void
  trigger?: React.ReactNode
  className?: string
}

// Dynamically import the form component to avoid SSR hydration issues with Radix Dialog
const CreateProjectFormInner = dynamic(
  () => import("./create-project-form-inner").then((mod) => mod.CreateProjectFormInner),
  { ssr: false }
)

export function CreateProjectForm(props: CreateProjectFormProps) {
  return <CreateProjectFormInner {...props} />
}

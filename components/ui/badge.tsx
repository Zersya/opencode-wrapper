import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#5e6ad2] text-white hover:bg-[#5e6ad2]/80",
        secondary:
          "border-transparent bg-gray-800 text-white hover:bg-gray-700",
        destructive:
          "border-transparent bg-red-600 text-white hover:bg-red-600/80",
        outline: "border-gray-700 text-gray-400",
        success:
          "border-transparent bg-green-600 text-white hover:bg-green-600/80",
        warning:
          "border-transparent bg-yellow-600 text-white hover:bg-yellow-600/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

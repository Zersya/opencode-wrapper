import * as React from "react"
import Link from "next/link"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const linkButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#5e6ad2] text-white hover:bg-[#5e6ad2]/90",
        destructive: "bg-red-600 text-white hover:bg-red-600/90",
        outline: "border border-gray-700 bg-transparent hover:bg-gray-800 hover:text-white",
        secondary: "bg-gray-800 text-white hover:bg-gray-700",
        ghost: "hover:bg-gray-800 hover:text-white",
        link: "text-[#5e6ad2] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface LinkButtonProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof linkButtonVariants> {
  href: string
  prefetch?: boolean
}

const LinkButton = React.forwardRef<HTMLAnchorElement, LinkButtonProps>(
  ({ className, variant, size, href, prefetch, ...props }, ref) => {
    return (
      <Link
        href={href}
        prefetch={prefetch}
        className={cn(linkButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
LinkButton.displayName = "LinkButton"

export { LinkButton, linkButtonVariants }

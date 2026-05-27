import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-blue-500/20 text-blue-400",
        profit: "border-transparent bg-emerald-500/20 text-emerald-400",
        loss: "border-transparent bg-red-500/20 text-red-400",
        warning: "border-transparent bg-yellow-500/20 text-yellow-400",
        secondary: "border-[#1F2937] bg-[#1F2937] text-gray-400",
        outline: "border-[#1F2937] text-gray-400",
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

import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide', {
  variants: {
    variant: {
      default: 'border-slate-200 bg-slate-100 text-slate-700',
      queued: 'border-amber-200 bg-amber-100 text-amber-700',
      running: 'border-sky-200 bg-sky-100 text-sky-700',
      completed: 'border-emerald-200 bg-emerald-100 text-emerald-700',
      failed: 'border-rose-200 bg-rose-100 text-rose-700',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

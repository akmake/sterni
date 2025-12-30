import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

// הוספנו את indicatorClassName לחילוץ ה-props
const Progress = React.forwardRef(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
    {...props} // עכשיו זה לא כולל את indicatorClassName ולכן השגיאה תיעלם
  >
    <ProgressPrimitive.Indicator
      // כאן אנחנו משתמשים ב-indicatorClassName כדי לאפשר שינוי צבע
      className={cn("h-full w-full flex-1 bg-primary transition-all", indicatorClassName)}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
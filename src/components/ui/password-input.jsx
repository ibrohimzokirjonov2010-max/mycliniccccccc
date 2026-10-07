import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

/** Password field with a show/hide eye toggle inside the input. */
const PasswordInput = React.forwardRef(({ className, wrapperClassName, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false)
  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <Input
        {...props}
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn(className, "pr-10")}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Parolni yashirish" : "Parolni ko'rsatish"}
        title={visible ? "Parolni yashirish" : "Parolni ko'rsatish"}
        data-testid="password-eye-toggle"
        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center p-0 bg-transparent border-0 text-slate-400 hover:text-slate-600 cursor-pointer"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
})
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }

"use client"

import { useId } from "react"
import { Lock, Globe } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/atoms/RadioGroup"

type LibrarySelectionRadioProps = {
  isPublic: boolean
  onValueChange: (isPublic: boolean) => void
}

export default function LibrarySelectionRadio({ isPublic, onValueChange }: LibrarySelectionRadioProps) {
  const id = useId()
  const value = isPublic ? 'public' : 'private'

  return (
    <RadioGroup className="grid-cols-2" value={value} onValueChange={(val) => onValueChange(val === 'public')}>
      {/* Private Library */}
      <div
        className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 px-4 py-4 text-center transition-all outline-none ${
          !isPublic
            ? 'border-[#2E7D32] bg-[#E8F5E9] dark:border-[#04C40A] dark:bg-[#1C2B1C]'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        } has-focus-visible:ring-2 has-focus-visible:ring-[#2E7D32]/20 dark:has-focus-visible:ring-[#04C40A]/20`}
      >
        <RadioGroupItem id={`${id}-private`} value="private" className="sr-only" />
        <Lock className={`w-5 h-5 ${
          !isPublic ? 'text-[#2E7D32] dark:text-[#04C40A]' : 'text-slate-600 dark:text-slate-400'
        }`} />
        <label
          htmlFor={`${id}-private`}
          className={`cursor-pointer text-sm leading-none font-medium after:absolute after:inset-0 ${
            !isPublic ? 'text-[#2E7D32] dark:text-[#04C40A]' : 'text-slate-900 dark:text-slate-100'
          }`}
        >
          Private Library
        </label>
      </div>

      {/* Public Library */}
      <div
        className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 px-4 py-4 text-center transition-all outline-none ${
          isPublic
            ? 'border-[#2E7D32] bg-[#E8F5E9] dark:border-[#04C40A] dark:bg-[#1C2B1C]'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        } has-focus-visible:ring-2 has-focus-visible:ring-[#2E7D32]/20 dark:has-focus-visible:ring-[#04C40A]/20`}
      >
        <RadioGroupItem id={`${id}-public`} value="public" className="sr-only" />
        <Globe className={`w-5 h-5 ${
          isPublic ? 'text-[#2E7D32] dark:text-[#04C40A]' : 'text-slate-600 dark:text-slate-400'
        }`} />
        <label
          htmlFor={`${id}-public`}
          className={`cursor-pointer text-sm leading-none font-medium after:absolute after:inset-0 ${
            isPublic ? 'text-[#2E7D32] dark:text-[#04C40A]' : 'text-slate-900 dark:text-slate-100'
          }`}
        >
          Public Library
        </label>
      </div>
    </RadioGroup>
  )
}

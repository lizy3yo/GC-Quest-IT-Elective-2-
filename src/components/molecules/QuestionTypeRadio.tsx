"use client"

import { useId } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/atoms/RadioGroup"

type QuestionTypeOption = {
  value: string
  label: string
  icon: React.ReactNode
}

type QuestionTypeRadioProps = {
  value: string
  onValueChange: (value: string) => void
  options: QuestionTypeOption[]
}

export default function QuestionTypeRadio({ value, onValueChange, options }: QuestionTypeRadioProps) {
  const id = useId()
  const gridCols = options.length === 3 ? "grid-cols-3" : "grid-cols-2"

  return (
    <RadioGroup className={gridCols} value={value} onValueChange={onValueChange}>
      {options.map((option, index) => {
        const isSelected = value === option.value
        return (
          <div
            key={option.value}
            className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 px-4 py-4 text-center transition-all outline-none ${
              isSelected
                ? 'border-[#2E7D32] bg-[#E8F5E9] dark:border-[#04C40A] dark:bg-[#1C2B1C]'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            } has-focus-visible:ring-2 has-focus-visible:ring-[#2E7D32]/20 dark:has-focus-visible:ring-[#04C40A]/20`}
          >
            <RadioGroupItem id={`${id}-${index + 1}`} value={option.value} className="sr-only" />
            <div className={isSelected ? 'text-[#2E7D32] dark:text-[#04C40A]' : 'text-slate-600 dark:text-slate-400'}>
              {option.icon}
            </div>
            <label
              htmlFor={`${id}-${index + 1}`}
              className={`cursor-pointer text-sm leading-none font-medium after:absolute after:inset-0 ${
                isSelected ? 'text-[#2E7D32] dark:text-[#04C40A]' : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {option.label}
            </label>
          </div>
        )
      })}
    </RadioGroup>
  )
}

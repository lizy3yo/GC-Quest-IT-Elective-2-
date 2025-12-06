import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/atoms/Pagination"

type QuestionPaginationProps = {
  currentQuestion: number
  totalQuestions: number
  onNavigate: (questionIndex: number) => void
  disablePrevious?: boolean
}

export default function QuestionPagination({
  currentQuestion,
  totalQuestions,
  onNavigate,
  disablePrevious = false,
}: QuestionPaginationProps) {
  const handlePrevious = () => {
    if (currentQuestion > 1 && !disablePrevious) {
      onNavigate(currentQuestion - 2); // Convert to 0-based index
    }
  };

  const handleNext = () => {
    if (currentQuestion < totalQuestions) {
      onNavigate(currentQuestion); // Convert to 0-based index
    }
  };

  return (
    <Pagination>
      <PaginationContent className="gap-3">
        <PaginationItem>
          <PaginationLink
            size="icon"
            className="aria-disabled:pointer-events-none aria-disabled:opacity-50 cursor-pointer"
            onClick={handlePrevious}
            aria-label="Go to previous question"
            aria-disabled={currentQuestion === 1 || disablePrevious ? true : undefined}
          >
            <ChevronLeftIcon size={16} aria-hidden="true" />
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Question <span className="text-foreground">{currentQuestion}</span> of{" "}
            <span className="text-foreground">{totalQuestions}</span>
          </p>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink
            size="icon"
            className="aria-disabled:pointer-events-none aria-disabled:opacity-50 cursor-pointer"
            onClick={handleNext}
            aria-label="Go to next question"
            aria-disabled={currentQuestion === totalQuestions ? true : undefined}
          >
            <ChevronRightIcon size={16} aria-hidden="true" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

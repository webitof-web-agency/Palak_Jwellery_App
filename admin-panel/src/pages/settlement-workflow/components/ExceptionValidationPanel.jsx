import ExceptionWarningList from './ExceptionWarningList'

export default function ExceptionValidationPanel({ originalWarnings, currentWarnings }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <ExceptionWarningList
        title="Original Validation Warnings"
        items={originalWarnings}
        emptyDescription="The original parsed state did not produce warnings."
      />
      <ExceptionWarningList
        title="Current Validation Warnings"
        items={currentWarnings}
        emptyDescription="The corrected state did not produce warnings."
      />
    </div>
  )
}

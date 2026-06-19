import { Button } from '@/components/ui/button'

export function ExportPanelContent({
  filteredRowCount,
  graphEdgeCount,
  onCopyCurl,
  onExportCsv,
  onExportJson,
}: {
  filteredRowCount: number
  graphEdgeCount: number
  onCopyCurl: () => Promise<void>
  onExportCsv: () => void
  onExportJson: () => void
}) {
  return (
    <div className="export-bar" role="group" aria-label="导出">
      <Button variant="ghost" type="button" disabled={graphEdgeCount === 0} onClick={onExportCsv}>
        CSV
      </Button>
      <Button
        variant="ghost"
        type="button"
        disabled={filteredRowCount === 0}
        onClick={onExportJson}
      >
        JSON
      </Button>
      <Button variant="ghost" type="button" onClick={() => void onCopyCurl()}>
        复制 curl
      </Button>
    </div>
  )
}

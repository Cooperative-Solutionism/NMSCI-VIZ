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
      <button
        className="ghost-button"
        type="button"
        disabled={graphEdgeCount === 0}
        onClick={onExportCsv}
      >
        CSV
      </button>
      <button
        className="ghost-button"
        type="button"
        disabled={filteredRowCount === 0}
        onClick={onExportJson}
      >
        JSON
      </button>
      <button className="ghost-button" type="button" onClick={() => void onCopyCurl()}>
        复制 curl
      </button>
    </div>
  )
}

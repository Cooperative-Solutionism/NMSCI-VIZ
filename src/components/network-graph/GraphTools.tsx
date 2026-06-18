import { Download, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'

interface GraphToolsProps {
  onDownloadPng: () => void
  onFit: () => void
  onZoomBy: (delta: number) => void
}

export function GraphTools({ onDownloadPng, onFit, onZoomBy }: GraphToolsProps) {
  return (
    <div className="graph-tools" aria-label="图谱控制">
      <button type="button" aria-label="放大" title="放大" onClick={() => onZoomBy(0.15)}>
        <ZoomIn size={16} />
      </button>
      <button type="button" aria-label="缩小" title="缩小" onClick={() => onZoomBy(-0.15)}>
        <ZoomOut size={16} />
      </button>
      <button type="button" aria-label="适配图谱" title="适配图谱" onClick={onFit}>
        <Maximize2 size={16} />
      </button>
      <button type="button" aria-label="下载 PNG" title="下载 PNG" onClick={onDownloadPng}>
        <Download size={16} />
      </button>
    </div>
  )
}

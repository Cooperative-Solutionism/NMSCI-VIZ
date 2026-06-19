import { Download, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '../ui/button'

interface GraphToolsProps {
  onDownloadPng: () => void
  onFit: () => void
  onZoomBy: (delta: number) => void
}

export function GraphTools({ onDownloadPng, onFit, onZoomBy }: GraphToolsProps) {
  return (
    <div className="graph-tools" aria-label="图谱控制">
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="放大"
        title="放大"
        onClick={() => onZoomBy(0.15)}
      >
        <ZoomIn />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="缩小"
        title="缩小"
        onClick={() => onZoomBy(-0.15)}
      >
        <ZoomOut />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="适配图谱"
        title="适配图谱"
        onClick={onFit}
      >
        <Maximize2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="下载 PNG"
        title="下载 PNG"
        onClick={onDownloadPng}
      >
        <Download />
      </Button>
    </div>
  )
}

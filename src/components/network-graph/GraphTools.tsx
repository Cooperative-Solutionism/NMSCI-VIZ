import { Download, Eraser, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import type { GraphHighlightMode } from './graphViewState'
import { Button } from '../ui/button'

interface GraphToolsProps {
  hasCycles: boolean
  highlightMode: GraphHighlightMode
  onClearCanvas?: () => void
  onDownloadPng: () => void
  onFit: () => void
  onHighlightModeChange: (mode: GraphHighlightMode) => void
  onZoomBy: (delta: number) => void
}

export function GraphTools({
  hasCycles,
  highlightMode,
  onClearCanvas,
  onDownloadPng,
  onFit,
  onHighlightModeChange,
  onZoomBy,
}: GraphToolsProps) {
  return (
    <div className="graph-tools" aria-label="图谱控制">
      <div className="graph-tools__mode" role="group" aria-label="高亮模式">
        <Button
          aria-label="相关链路"
          aria-pressed={highlightMode === 'related'}
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => onHighlightModeChange('related')}
        >
          相关
        </Button>
        <Button
          aria-label="循环链路"
          aria-pressed={highlightMode === 'cycles'}
          disabled={!hasCycles}
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => onHighlightModeChange('cycles')}
        >
          循环
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="放大"
        title="放大"
        onClick={() => onZoomBy(0.15)}
      >
        <ZoomIn aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="缩小"
        title="缩小"
        onClick={() => onZoomBy(-0.15)}
      >
        <ZoomOut aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="适配图谱"
        title="适配图谱"
        onClick={onFit}
      >
        <Maximize2 aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="下载 PNG"
        title="下载 PNG"
        onClick={onDownloadPng}
      >
        <Download aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="清屏"
        title="清屏"
        onClick={() => onClearCanvas?.()}
      >
        <Eraser aria-hidden="true" />
      </Button>
    </div>
  )
}

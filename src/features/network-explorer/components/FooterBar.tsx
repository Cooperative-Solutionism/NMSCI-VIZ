import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { DataOrigin } from '../../../hooks/useConsumeChainQuery'
import type { ConsumeChainResponseDTO, SliceResponseDTO } from '../../../lib/types'

export function FooterBar({
  extended,
  filteredRowCount,
  loading,
  onNextPage,
  onPreviousPage,
  origin,
  rowCount,
  slice,
}: {
  extended: boolean
  filteredRowCount: number
  loading: boolean
  onNextPage: () => void
  onPreviousPage: () => void
  origin: DataOrigin
  rowCount: number
  slice: SliceResponseDTO<ConsumeChainResponseDTO>
}) {
  return (
    <footer className="footerbar">
      <div>
        <span className="footer-label">切片</span>
        <span>
          第 {slice.page} 页 / 每页 {slice.size} / 可见 {filteredRowCount} 行 / 后端 {rowCount} 行
        </span>
      </div>
      <div className="pagination">
        <button
          type="button"
          disabled={loading || extended || !slice.hasPrevious}
          onClick={onPreviousPage}
          aria-label="上一页"
        >
          <ChevronLeft size={16} />
        </button>
        <span>{loading ? '页面加载中…' : origin === 'backend' ? '实时切片' : '无切片'}</span>
        <button
          type="button"
          disabled={loading || extended || origin !== 'backend' || !slice.hasNext}
          onClick={onNextPage}
          aria-label="下一页"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </footer>
  )
}

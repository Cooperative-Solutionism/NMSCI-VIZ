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
        <span className="footer-label">Slice</span>
        <span>
          page {slice.page} / size {slice.size} / {filteredRowCount} visible row
          {filteredRowCount === 1 ? '' : 's'} / {rowCount} backend row
          {rowCount === 1 ? '' : 's'}
        </span>
      </div>
      <div className="pagination">
        <button
          type="button"
          disabled={loading || extended || !slice.hasPrevious}
          onClick={onPreviousPage}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span>{loading ? 'Loading page' : origin === 'backend' ? 'Live slice' : 'No slice'}</span>
        <button
          type="button"
          disabled={loading || extended || origin !== 'backend' || !slice.hasNext}
          onClick={onNextPage}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </footer>
  )
}

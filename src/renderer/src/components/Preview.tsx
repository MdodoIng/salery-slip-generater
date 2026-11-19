import { useEffect, useRef, useState } from 'react'

const PAGE_W = 794 // A4 at 96dpi, matches the payslip sheet width

export default function Preview({ srcDoc }: { srcDoc: string }): JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = (): void => setScale(Math.min(1, (el.clientWidth - 26) / PAGE_W))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="preview-box" ref={box}>
      <div style={{ width: PAGE_W * scale, height: 1123 * scale, margin: '0 auto' }}>
        <div className="preview-frame" style={{ width: PAGE_W, height: 1123, transform: `scale(${scale})` }}>
          <iframe title="Payslip preview" srcDoc={srcDoc} scrolling="no" />
        </div>
      </div>
    </div>
  )
}

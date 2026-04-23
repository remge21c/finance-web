import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: '#059669',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '36px',
      }}
    >
      <span style={{ color: 'white', fontSize: 110, fontWeight: 700 }}>재</span>
    </div>,
    { ...size }
  )
}

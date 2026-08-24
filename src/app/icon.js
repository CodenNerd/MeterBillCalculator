import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

/** Tab favicon — full-bleed mark so it stays readable at 16–32px. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b6e4f',
          borderRadius: 7,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#ffffff',
            fontFamily: 'Georgia, "Times New Roman", serif',
            lineHeight: 1,
            marginTop: -1,
          }}
        >
          P
        </div>
      </div>
    ),
    { ...size },
  )
}

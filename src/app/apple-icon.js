import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** Apple touch icon — soft plate + green tile + P (matches brand). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#e3f2eb',
        }}
      >
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 28,
            background: '#0b6e4f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 88,
              fontWeight: 700,
              color: '#ffffff',
              fontFamily: 'Georgia, "Times New Roman", serif',
              lineHeight: 1,
              marginTop: -4,
            }}
          >
            P
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}

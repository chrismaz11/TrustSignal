interface TrustSignalLogoProps {
  size?: number;
  showWordmark?: boolean;
}

export function TrustSignalLogo({ size = 32, showWordmark = true }: TrustSignalLogoProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <g stroke="#F04E23" strokeWidth="2.2" strokeLinecap="round">
          <line x1="16" y1="3" x2="16" y2="9" strokeOpacity="1" />
          <line x1="22.49" y1="5.51" x2="19.56" y2="10.8" strokeOpacity="0.85" />
          <line x1="26.49" y1="9.51" x2="21.2" y2="12.44" strokeOpacity="0.7" />
          <line x1="29" y1="16" x2="23" y2="16" strokeOpacity="0.55" />
          <line x1="26.49" y1="22.49" x2="21.2" y2="19.56" strokeOpacity="0.4" />
          <line x1="22.49" y1="26.49" x2="19.56" y2="21.2" strokeOpacity="0.3" />
          <line x1="16" y1="29" x2="16" y2="23" strokeOpacity="0.2" />
          <line x1="9.51" y1="26.49" x2="12.44" y2="21.2" strokeOpacity="0.15" />
        </g>
      </svg>
      {showWordmark && (
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: '#f0f0f0',
              lineHeight: 1.2,
            }}
          >
            trustsignal
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#555',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              lineHeight: 1.2,
            }}
          >
            Evidence Integrity Infrastructure
          </div>
        </div>
      )}
    </div>
  );
}

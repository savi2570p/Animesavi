import { createPortal } from 'react-dom';

interface PlatformLoadingScreenProps {
  platform: 'crunchy' | 'musein';
  logo: string;
}

/** Presentation only: the parent catalogue request controls its lifetime. */
export function PlatformLoadingScreen({ platform, logo }: PlatformLoadingScreenProps) {
  const name = platform === 'crunchy' ? 'Crunchy' : 'MuseIN';

  return createPortal(
    <div className="platform-loading" data-platform={platform}>
      <div className="platform-loading-panel" role="status" aria-live="polite" aria-label={`Loading ${name}`}>
        <div className="platform-loading-brand" aria-hidden="true">
          <span className="platform-loading-brand-mark" />
          <span>AnimeSavi</span>
          <span className="platform-loading-brand-label">Platforms</span>
        </div>

        <div className="platform-loading-identity">
          <div className="platform-loading-logo">
            <img src={logo} alt="" width={76} height={76} />
          </div>
          <p className="platform-loading-eyebrow">Your next watch awaits</p>
          <h2>{name}</h2>
        </div>

        <div className="platform-loading-track" aria-hidden="true"><span /></div>
        <div className="platform-loading-status">
          <span>Loading catalogue</span>
          <span className="platform-loading-dots" aria-hidden="true"><i /><i /><i /></span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
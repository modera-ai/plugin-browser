type LogoProps = { size?: number; className?: string };

export const ChromeLogo = ({ size = 16, className }: LogoProps) => (
  <img
    src="browser-logos/chrome.svg"
    width={size}
    height={size}
    className={className}
    alt=""
    aria-hidden="true"
  />
);

export const EdgeLogo = ({ size = 16, className }: LogoProps) => (
  <img
    src="browser-logos/edge.svg"
    width={size}
    height={size}
    className={className}
    alt=""
    aria-hidden="true"
  />
);

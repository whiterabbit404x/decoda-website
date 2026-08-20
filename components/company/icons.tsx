import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 24, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/* --- What Decoda does --- */

export function IconArchitecture(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 20 6.5v5C20 16.5 16.5 20.5 12 22 7.5 20.5 4 16.5 4 11.5v-5L12 3Z" />
      <path d="M12 7.5v9M8 12h8" />
    </Icon>
  );
}

export function IconAnalytics(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.6-4.6" />
      <path d="M8 11.5 10 9.5l1.6 1.6L14 8.5" />
    </Icon>
  );
}

export function IconTeam(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 20a5.5 5.5 0 0 0-3-4.9" />
    </Icon>
  );
}

/* --- Enterprise security panel --- */

export function IconShieldPulse(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 20 6.5v5C20 16.5 16.5 20.5 12 22 7.5 20.5 4 16.5 4 11.5v-5L12 3Z" />
      <path d="M7.5 12.5h2l1.5-3 2 5 1.5-2h2" />
    </Icon>
  );
}

export function IconPillars(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 8.5 12 4l8.5 4.5" />
      <path d="M5 8.5v9M9.5 8.5v9M14.5 8.5v9M19 8.5v9" />
      <path d="M3.5 20.5h17" />
    </Icon>
  );
}

export function IconFlagship(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 20 6.5v5C20 16.5 16.5 20.5 12 22 7.5 20.5 4 16.5 4 11.5v-5L12 3Z" />
      <path d="m13 8-4 5.2h3l-1 3.8 4-5.2h-3l1-3.8Z" />
    </Icon>
  );
}

/* --- Why this matters (blue checks) --- */

export function IconCheckCircle(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.4 2.4L15.8 9.5" />
    </Icon>
  );
}

/* --- Security lifecycle --- */

export function IconObserve(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </Icon>
  );
}

export function IconDetect(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
    </Icon>
  );
}

export function IconInvestigate(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.6-4.6" />
    </Icon>
  );
}

export function IconRespond(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 20 6.5v5C20 16.5 16.5 20.5 12 22 7.5 20.5 4 16.5 4 11.5v-5L12 3Z" />
      <path d="m12.7 8-3 4.4h2.3l-.7 3.6 3-4.4h-2.3l.7-3.6Z" />
    </Icon>
  );
}

export function IconProve(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3.5h6.5L18.5 7.5V19a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5Z" />
      <path d="M14 3.5V8h4.5" />
      <path d="m9.5 14 1.6 1.6 3-3.2" />
    </Icon>
  );
}

/* --- Platform vision / roadmap --- */

export function IconOrchestration(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="5.5" cy="18" r="2.2" />
      <circle cx="18.5" cy="18" r="2.2" />
      <path d="M12 7.2v3.3M11 10.5 6.6 16M13 10.5 17.4 16" />
    </Icon>
  );
}

export function IconCounterparty(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7.5" cy="8" r="2.6" />
      <circle cx="16.5" cy="8" r="2.6" />
      <path d="M3.5 19a4 4 0 0 1 8 0M12.5 19a4 4 0 0 1 8 0" />
    </Icon>
  );
}

export function IconCommandCenter(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M4 13v3.5h16V13" />
      <path d="m12 13 3.2-3" />
      <circle cx="12" cy="13" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/* --- Utility --- */

export function IconArrowRight(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

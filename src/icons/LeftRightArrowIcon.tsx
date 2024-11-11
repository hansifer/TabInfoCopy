type LeftRightArrowIconProps = {
  size?: number
}

export const LeftRightArrowIcon = ({ size = 16 }: LeftRightArrowIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="18 8 22 12 18 16" />
      <polyline points="6 8 2 12 6 16" />
      <line
        x1="2"
        x2="22"
        y1="12"
        y2="12"
      />
    </svg>
  )
}
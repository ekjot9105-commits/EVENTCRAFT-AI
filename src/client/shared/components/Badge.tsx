interface BadgeProps {
  children: React.ReactNode;
  color?: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'emerald' | 'purple' | 'brand';
  size?: 'sm' | 'md';
}

const colorMap = {
  gray: 'bg-surface-700/50 text-surface-300',
  blue: 'bg-blue-500/15 text-blue-400',
  green: 'bg-green-500/15 text-green-400',
  yellow: 'bg-yellow-500/15 text-yellow-400',
  red: 'bg-red-500/15 text-red-400',
  emerald: 'bg-emerald-500/15 text-emerald-400',
  purple: 'bg-purple-500/15 text-purple-400',
  brand: 'bg-brand-500/15 text-brand-400',
};

const sizeMap = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export default function Badge({
  children,
  color = 'gray',
  size = 'sm',
}: BadgeProps) {
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${colorMap[color]} ${sizeMap[size]}`}>
      {children}
    </span>
  );
}

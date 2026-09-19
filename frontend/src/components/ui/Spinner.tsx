
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };

export function Spinner({ size = 'md', label = 'Loading…' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={[
        sizeMap[size],
        'inline-block border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin',
      ].join(' ')}
    />
  );
}

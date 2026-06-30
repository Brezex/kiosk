import { useEffect, useState } from 'react';

interface Props {
  logoText?: string;
  onComplete: () => void;
  duration?: number;
}

const SHIELDS = [
  { size: 80, top: 15, delay: 0, duration: 4.5, opacity: 0.6 },
  { size: 60, top: 35, delay: 0.3, duration: 4.2, opacity: 0.5 },
  { size: 100, top: 55, delay: 0.1, duration: 4.8, opacity: 0.7 },
  { size: 50, top: 75, delay: 0.5, duration: 4.0, opacity: 0.4 },
  { size: 70, top: 25, delay: 0.2, duration: 4.4, opacity: 0.55 },
  { size: 90, top: 65, delay: 0.4, duration: 4.6, opacity: 0.65 },
  { size: 55, top: 45, delay: 0.6, duration: 4.1, opacity: 0.45 },
  { size: 75, top: 85, delay: 0.15, duration: 4.3, opacity: 0.5 },
];

export default function TransitionAnimation(props: Props) {
  const { 
    logoText = 'COMPANY', 
    onComplete, 
    duration = 5000 
  } = props;
  
  const [phase, setPhase] = useState<'darken' | 'fly' | 'exit' | 'done'>('darken');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('fly'), 500);
    const t2 = setTimeout(() => setPhase('exit'), 4500);
    const t3 = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, duration);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [duration, onComplete]);

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden"
      style={{
        backgroundColor: phase === 'darken' ? 'rgba(0,0,0,0.7)' : 
                         phase === 'fly' ? 'rgba(0,0,0,0.85)' :
                         phase === 'exit' ? 'rgba(0,0,0,0.5)' : 'transparent',
        transition: 'background-color 0.5s ease',
      }}
    >
      {SHIELDS.map((shield, index) => (
        <div
          key={index}
          className="absolute"
          style={{
            top: `${shield.top}%`,
            left: phase === 'fly' || phase === 'exit' ? '0' : '-200px',
            animation: phase === 'fly' 
              ? `shieldFly${index % 3} ${shield.duration}s ease-in-out ${shield.delay}s forwards`
              : phase === 'exit'
              ? `shieldExit 0.5s ease-in forwards`
              : 'none',
          }}
        >
          <div
            className="absolute top-1/2 right-full transform -translate-y-1/2"
            style={{
              width: `${shield.size * 3}px`,
              height: `${shield.size * 0.15}px`,
              background: `linear-gradient(to right, transparent, rgba(255,255,255,${shield.opacity * 0.6}))`,
              borderRadius: '2px',
            }}
          />
<img
  src="/shield.png"
  alt="shield"
  style={{
    width: `${shield.size}px`,
    height: 'auto',
    opacity: shield.opacity,
    filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5))',
    display: 'block',
  }}
/>
        </div>
      ))}

<div
  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
  style={{
    opacity: phase === 'fly' ? 1 : phase === 'exit' ? 0 : 0,
    transition: 'opacity 0.5s ease',
    textAlign: 'center',
  }}
>
  <img
    src="/logo.png"
    alt="Company Logo"
    style={{
      width: '400px',
      height: 'auto',
      filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.8)) drop-shadow(0 0 60px rgba(255,255,255,0.4))',
      animation: phase === 'fly' ? 'logoPulse 2s ease-in-out infinite' : 'none',
    }}
  />
</div>

<style>{`
  @keyframes shieldFly0 {
    0% { transform: translateX(-200px) scale(0.5); }
    100% { transform: translateX(calc(100vw + 200px)) scale(1.2); }
  }
  @keyframes shieldFly1 {
    0% { transform: translateX(-200px) scale(0.7); }
    100% { transform: translateX(calc(100vw + 200px)) scale(1); }
  }
  @keyframes shieldFly2 {
    0% { transform: translateX(-200px) scale(0.6); }
    100% { transform: translateX(calc(100vw + 200px)) scale(1.1); }
  }
  @keyframes shieldExit {
    0% { transform: translateX(0); }
    100% { transform: translateX(calc(100vw + 300px)); }
  }
  @keyframes logoPulse {
    0%, 100% { 
      filter: drop-shadow(0 0 30px rgba(255,255,255,0.8)) drop-shadow(0 0 60px rgba(255,255,255,0.4));
      transform: scale(1);
    }
    50% { 
      filter: drop-shadow(0 0 50px rgba(255,255,255,1)) drop-shadow(0 0 100px rgba(255,255,255,0.6));
      transform: scale(1.05);
    }
  }
`}</style>
    </div>
  );
}
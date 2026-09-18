import { useState, useEffect } from 'react';
import { Lock, Shield, Unlock, PhoneCall } from 'lucide-react';
import { telecomBridge } from '../services/telephony/telecomBridge';

interface LockscreenBarrierProps {
  onUnlockSuccess?: () => void;
  onEmergencyCall?: (num: string) => void;
}

export default function LockscreenBarrier({ onUnlockSuccess, onEmergencyCall }: LockscreenBarrierProps) {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [unlockRequested, setUnlockRequested] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleUnlock = () => {
    setUnlockRequested(true);
    const initiated = telecomBridge.requestDeviceUnlock();
    if (!initiated) {
      setTimeout(() => setUnlockRequested(false), 2000);
    }
  };

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const formattedDate = currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div
      id="lockscreen-security-barrier"
      className="fixed inset-0 z-40 flex flex-col items-center justify-between bg-gradient-to-b from-[#060a12] via-[#09111e] to-[#04070d] px-6 py-12 text-white select-none backdrop-blur-md animate-in fade-in duration-300"
    >
      {/* Top Clock & Status */}
      <div className="flex flex-col items-center space-y-1 text-center pt-4">
        <div className="flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold text-indigo-300 tracking-wider">
          <Shield className="h-3.5 w-3.5 text-indigo-400" />
          <span>VIGILSHIELD PRIVACY SHIELD</span>
        </div>
        <h1 className="text-6xl font-light tracking-tight text-slate-100 pt-3">{formattedTime}</h1>
        <p className="text-sm font-medium text-slate-400">{formattedDate}</p>
      </div>

      {/* Center Lock Status */}
      <div className="flex flex-col items-center max-w-xs text-center space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-24 w-24 rounded-full bg-indigo-500/15 animate-ping" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-indigo-500/40 bg-indigo-950/80 shadow-xl shadow-indigo-950/50">
            <Lock className="h-9 w-9 text-indigo-400" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-slate-100">Device Locked</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your call logs, recorded calls, caller notes, and contacts are secured while your phone is locked.
          </p>
        </div>

        <button
          type="button"
          id="unlock-device-btn"
          onClick={handleUnlock}
          className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] py-3.5 px-6 font-semibold text-sm text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          {unlockRequested ? (
            <>
              <Unlock className="h-4 w-4 animate-bounce" />
              <span>Prompting for device unlock…</span>
            </>
          ) : (
            <>
              <Unlock className="h-4 w-4" />
              <span>Unlock Device</span>
            </>
          )}
        </button>
      </div>

      {/* Bottom info & Emergency Access */}
      <div className="flex flex-col items-center space-y-3 pb-2 text-center">
        <p className="text-[11px] text-slate-500">
          Incoming calls ring and display caller ID automatically over this lock screen.
        </p>
        {onEmergencyCall && (
          <button
            type="button"
            onClick={() => onEmergencyCall('112')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition py-1 px-3 rounded-lg hover:bg-slate-800/40"
          >
            <PhoneCall className="h-3.5 w-3.5 text-rose-400" />
            <span>Emergency (112)</span>
          </button>
        )}
      </div>
    </div>
  );
}

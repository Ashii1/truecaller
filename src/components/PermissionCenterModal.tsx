import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Clock, PhoneCall, ShieldAlert, ShieldCheck, Users, X } from 'lucide-react';
import { ShieldSettings } from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';

interface PermissionCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ShieldSettings;
  onUpdateSettings: (newSettings: ShieldSettings) => void;
  isDefaultDialer: boolean;
  onRequestDefaultDialer: () => void;
  onSyncContacts: () => void;
}

type LiveState = 'ON' | 'OFF' | 'AVAILABLE' | 'UNAVAILABLE';

export default function PermissionCenterModal({ isOpen, onClose, settings, onUpdateSettings, isDefaultDialer, onRequestDefaultDialer, onSyncContacts }: PermissionCenterModalProps) {
  const [notificationStatus, setNotificationStatus] = useState<LiveState>('OFF');
  const [contactsStatus, setContactsStatus] = useState<LiveState>('OFF');
  const [callLogStatus, setCallLogStatus] = useState<LiveState>('UNAVAILABLE');
  const [screeningStatus, setScreeningStatus] = useState<LiveState>('UNAVAILABLE');

  const refresh = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) setNotificationStatus(Notification.permission === 'granted' ? 'ON' : 'OFF');
    const diag = telecomBridge.getDiagnostics();
    setContactsStatus(diag.contactsPermission ? 'ON' : 'OFF');
    setCallLogStatus(diag.callLogPermission || diag.isDefaultDialer ? 'AVAILABLE' : 'UNAVAILABLE');
    setScreeningStatus(diag.isDefaultDialer ? 'AVAILABLE' : 'UNAVAILABLE');
  };

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, [isOpen, isDefaultDialer]);

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try { await Notification.requestPermission(); refresh(); } catch (err) { console.warn('Notification permission request failed:', err); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-5">
      <section className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-400"><ShieldCheck className="h-5 w-5" /></div><div className="min-w-0"><h2 className="text-lg font-extrabold text-white">Permission Center</h2><p className="text-xs text-slate-400">Live Android permission and Phone role status</p></div></div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close permission center"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs leading-5 text-slate-400">No setup wizard. VigilShield asks for the Default Phone role when it first opens. Use this screen later to review live Android status.</div>
          <StatusRow icon={<PhoneCall className="h-4 w-4" />} title="Default Phone App" description="Routes real cellular calls through VigilShield InCallService." status={isDefaultDialer ? 'ON' : 'OFF'} action={!isDefaultDialer ? <button onClick={onRequestDefaultDialer} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">Set as default</button> : undefined} />
          <StatusRow icon={<Users className="h-4 w-4" />} title="Contacts" description="Reads device contacts for caller names and trusted-contact protection." status={contactsStatus} action={contactsStatus !== 'ON' ? <button onClick={onSyncContacts} className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-600">Refresh</button> : undefined} />
          <StatusRow icon={<Clock className="h-4 w-4" />} title="Call Log" description="Reads real incoming, outgoing and missed call history." status={callLogStatus} />
          <StatusRow icon={<Bell className="h-4 w-4" />} title="Notifications" description="Missed-call, spam and urgent-call alerts." status={notificationStatus} action={notificationStatus !== 'ON' && typeof Notification !== 'undefined' ? <button onClick={handleRequestNotifications} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">Enable</button> : undefined} />
          <StatusRow icon={<ShieldAlert className="h-4 w-4" />} title="Caller screening" description="Available when VigilShield has the required Android phone role." status={screeningStatus} />
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><div className="text-sm font-bold text-white">Protection status</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><MiniStatus label="Shield" on={settings.masterEnabled} /><MiniStatus label="Privacy" on={true} /><MiniStatus label="Emergency alerts" on={true} /></div></div>
        </div>
      </section>
    </div>
  );
}

function StatusRow({ icon, title, description, status, action }: { icon: React.ReactNode; title: string; description: string; status: LiveState; action?: React.ReactNode }) {
  const positive = status === 'ON' || status === 'AVAILABLE';
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{positive ? <CheckCircle2 className="h-4 w-4" /> : icon}</div><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">{title}</div><div className="mt-1 text-xs leading-5 text-slate-400">{description}</div></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${positive ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>{status}</span>{action}</div></div>;
}

function MiniStatus({ label, on }: { label: string; on: boolean }) { return <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-[11px] text-slate-500">{label}</div><div className={`mt-1 text-xs font-bold ${on ? 'text-emerald-400' : 'text-slate-500'}`}>{on ? 'Active' : 'Off'}</div></div>; }

import { useState, FormEvent } from 'react';
import { ArrowLeft, Flag, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SpamCategory } from '../types';

interface FastReportModalProps {
  isOpen: boolean;
  initialNumber?: string;
  onClose: () => void;
  onSubmitReport: (number: string, category: SpamCategory, description: string) => void;
}

export default function FastReportModal({
  isOpen,
  initialNumber = '',
  onClose,
  onSubmitReport,
}: FastReportModalProps) {
  const [number, setNumber] = useState(initialNumber);
  const [category, setCategory] = useState<SpamCategory>('TELEMARKETING');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!number.trim()) return;

    onSubmitReport(number.trim(), category, description.trim() || `Reported as ${category}`);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1200);
  };

  const categories: { id: SpamCategory; label: string; desc: string }[] = [
    { id: 'TELEMARKETING', label: 'Telemarketing', desc: 'Unsolicited sales pitches or promotional offers' },
    { id: 'SCAM', label: 'Financial Scam', desc: 'Bank fraud, fake KYC, lottery or investment traps' },
    { id: 'ROBOCALL', label: 'Automated Robocall', desc: 'Pre-recorded voice messages or computer dialing' },
    { id: 'IMPERSONATOR', label: 'Impersonation', desc: 'Pretending to be police, tax agency, or delivery' },
    { id: 'DEBT_COLLECTOR', label: 'Harassment / Debt', desc: 'Abusive calling or aggressive recovery calls' },
    { id: 'CUSTOM', label: 'Other Spam', desc: 'General unwanted calls' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Report Unwanted Call</h2>
              <p className="text-xs text-slate-400">Fast 2-tap community threat submission</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-semibold">Back</span>
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">Report Submitted!</h3>
            <p className="text-xs text-slate-400">Thank you for protecting the community.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="+91 98201 44556"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-2xl text-sm font-mono font-bold text-white placeholder-slate-600 focus:outline-none"
                required
              />
            </div>

            {/* Category selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                What type of call was it?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-3 rounded-xl border text-left transition ${
                      category === cat.id
                        ? 'bg-rose-950/40 border-rose-500 text-rose-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{cat.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{cat.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Details (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Claimed to be bank officer asking for OTP..."
                rows={2}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-950/50"
              >
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

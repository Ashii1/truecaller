import { useState } from 'react';
import { ArrowLeft, Shield, ShieldCheck, Heart, Sparkles, Smartphone, Lock, Award, CheckCircle2, FileText, ExternalLink, HelpCircle } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';

interface AboutAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrivacyTerms?: (tab?: 'privacy' | 'terms') => void;
}

export default function AboutAppModal({ isOpen, onClose, onOpenPrivacyTerms }: AboutAppModalProps) {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 safe-top-modal sm:p-5 backdrop-blur-sm animate-fade-in">
      <section className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">{t('about_us')}</h2>
              <p className="text-xs text-slate-400">CallShield Production Telephony Engine</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-xs font-semibold">Back</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 text-slate-300 text-xs leading-relaxed">
          {/* Hero Branding */}
          <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-950 p-4 text-center space-y-2">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-lg shadow-blue-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-base font-black text-white">CallShield</h3>
            <p className="text-xs text-blue-300 font-medium">Smart Caller ID, Telephony Firewall & HD Recording</p>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              <span>Version 2.4.0 • Production Build</span>
            </div>
          </div>

          {/* Mission & Vision */}
          <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h4 className="font-bold text-white flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Our Mission</span>
            </h4>
            <p className="text-slate-400">
              CallShield is built from the ground up to give mobile users complete sovereignty over their incoming calls.
              We combat spam, aggressive telemarketing, OTP/banking impersonators, and fraudulent robocalls with high-speed,
              on-device heuristic analysis and comprehensive caller identification.
            </p>
          </div>

          {/* Core Pillars */}
          <div className="space-y-2">
            <h4 className="font-bold text-white uppercase text-[10px] tracking-wider text-slate-400">Core Features</h4>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
                <Lock className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Zero Telemetry & Local Privacy</div>
                  <div className="text-[11px] text-slate-400">Your phonebook, call history, and recordings never leave your device. No ad networks, no tracking SDKs.</div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
                <Smartphone className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Truecaller-Grade Caller Intelligence</div>
                  <div className="text-[11px] text-slate-400">Identifies the name, business purpose, location, and telecom circle for unknown callers with community spam risk scoring.</div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
                <Award className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">HD Telephony Call Recording</div>
                  <div className="text-[11px] text-slate-400">Studio-quality call audio recording saved directly to internal storage with instant playback and export options.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Legal Links */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <button
              type="button"
              onClick={() => onOpenPrivacyTerms?.('privacy')}
              className="flex items-center gap-1 font-semibold text-blue-400 hover:text-blue-300"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{t('privacy_policy')}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenPrivacyTerms?.('terms')}
              className="flex items-center gap-1 font-semibold text-blue-400 hover:text-blue-300"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{t('terms_of_service')}</span>
            </button>
          </div>

          {/* Copyright */}
          <div className="text-center text-[10px] text-slate-600 pt-1">
            &copy; {new Date().getFullYear()} CallShield Technologies. All rights reserved.
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NoResumeGate() {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleContinueAnyway = () => {
    // Set session cookie
    document.cookie = "resume_gate_override=true; path=/";
    // Reload page to re-render server component
    window.location.reload();
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="max-w-lg w-full text-center space-y-6 py-12">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-2 animate-pulse">
          <AlertTriangle size={32} className="text-amber-400" />
        </div>
        <div className="text-2xl font-bold text-white tracking-tight">Let's set up your resume first</div>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Achievement scoring compares against your existing resume. Without one, 
          scores are just a generic guess — not personalized to you.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-6 py-2.5 rounded-xl">
            <Link href="/resume?action=upload">Upload my resume</Link>
          </Button>
          <Button asChild variant="outline" className="border-zinc-800 text-zinc-300 hover:bg-zinc-950 hover:text-white px-6 py-2.5 rounded-xl">
            <Link href="/resume?action=build">Build from scratch</Link>
          </Button>
        </div>
        <div className="pt-4">
          <button 
            onClick={() => setShowConfirm(true)}
            className="text-xs text-zinc-500 underline hover:text-zinc-400 transition-colors"
          >
            Continue without a resume — scores will be less accurate
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={20} className="text-amber-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Are you sure?</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Are you sure? Achievement scores won't reflect your actual background. You can add a resume anytime from the Resume page.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowConfirm(false)} 
                className="flex-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleContinueAnyway}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl"
              >
                Continue anyway
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

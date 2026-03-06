import React, { useState } from 'react';
import { ChevronDown, LogOut, UserCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import { cn } from '../ui/cn';

const AppHeader = ({ title = 'Aroha Flow', subtitle, onLogout, backTo }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="flow-glass-header sticky top-0 z-30">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          {backTo ? (
            <Button variant="ghost" size="sm" onClick={() => navigate(backTo)}>
              Back
            </Button>
          ) : null}
          <div className="h-8 w-8 overflow-hidden rounded-ui border border-app-border bg-app-bg-secondary p-1">
            <img src="/logo.png" alt="Aroha Flow logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="text-sm font-semibold text-app-text-primary">{title}</p>
            {subtitle ? <p className="text-xs app-muted">{subtitle}</p> : null}
          </div>
        </div>

        <div className="relative">
          <Button variant="secondary" size="sm" onClick={() => setMenuOpen((s) => !s)}>
            <UserCircle2 className="h-4 w-4" />
            <ChevronDown className="h-4 w-4" />
          </Button>
          <div
            className={cn(
              'absolute right-0 mt-2 w-44 rounded-ui border border-white/10 bg-slate-900/80 backdrop-blur-xl p-1 shadow-lg',
              menuOpen ? 'block' : 'hidden'
            )}
          >
            <button
              className="flex w-full items-center gap-2 rounded-ui px-3 py-2 text-left text-sm text-app-text-primary hover:bg-white/10 transition-colors duration-200"
              onClick={() => {
                setMenuOpen(false);
                onLogout?.();
              }}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;

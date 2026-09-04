import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div id="error-boundary-screen" className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 my-8 mx-4 shadow-xl">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400 rounded-full flex items-center justify-center mb-5 animate-pulse">
            <AlertTriangle className="w-8 h-8" />
          </div>
          
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
            Ops, algo deu errado!
          </h2>
          
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs leading-relaxed mb-6">
            Ocorreu um erro inesperado ao carregar esta tela. Mas não se preocupe, seus dados estão seguros!
          </p>

          {this.state.error && (
            <div className="w-full max-w-xs bg-slate-100 dark:bg-slate-950 p-3 rounded-lg text-left mb-6 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1 font-bold">
                Detalhes do Erro
              </span>
              <p className="font-mono text-xs text-rose-600 dark:text-rose-400 break-words line-clamp-3">
                {this.state.error.message || String(this.state.error)}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 w-full max-w-xs">
            <button
              id="btn-error-reload"
              onClick={this.handleReload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 dark:shadow-none transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Recarregar
            </button>
            
            <button
              id="btn-error-home"
              onClick={this.handleGoHome}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              Início
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

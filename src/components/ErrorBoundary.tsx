import React, { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends (React.Component as any)<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState & { error?: Error } = {
    hasError: false
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState & { error?: Error } {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-12 text-center bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
          <AlertCircle className="mx-auto text-zinc-300 mb-4" size={48} />
          <h3 className="text-lg font-bold text-zinc-900 mb-2">Ops! Algo deu errado nesta seção.</h3>
          <p className="text-sm text-zinc-500 max-w-xs mx-auto mb-6">Ocorreu um erro inesperado ao processar os dados desta aba.</p><pre className="text-xs text-red-600 bg-red-50 p-4 rounded text-left overflow-auto mb-4">{this.state.error?.toString()}
{this.state.error?.stack}</pre>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="px-6 py-2 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-md active:scale-95"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


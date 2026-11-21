import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] w-full flex items-center justify-center p-6 bg-[#F1F3F6] text-[#212121]">
          <div className="w-full max-w-md bg-white border border-[#E0E0E0] rounded-[8px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-red-50 text-[#D32F2F] border border-red-200 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-[#D32F2F]" />
            </div>
            <h2 className="text-[18px] font-semibold text-[#212121] tracking-tight">
              Something went wrong
            </h2>
            <p className="text-[13px] text-[#878787] mt-1 mb-4 max-w-sm">
              An unexpected error occurred while rendering this view. Your session state is preserved.
            </p>
            {this.state.error?.message && (
              <pre className="w-full p-2.5 bg-[#F8FAFC] border border-[#E0E0E0] rounded-[6px] text-[11px] font-mono text-slate-700 text-left overflow-x-auto mb-4">
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="h-[38px] px-5 py-2 rounded-[6px] bg-[#2874F0] hover:bg-blue-600 text-white text-[14px] font-medium flex items-center gap-2 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Page</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

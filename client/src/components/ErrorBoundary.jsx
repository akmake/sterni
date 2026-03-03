import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
            <div className="text-5xl">😵</div>
            <h1 className="text-2xl font-bold text-gray-800">משהו השתבש</h1>
            <p className="text-gray-500">
              אירעה שגיאה בלתי צפויה. נסה לרענן את הדף או לחזור לדף הבית.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                רענן דף
              </button>
              <button
                onClick={() => { this.handleReset(); window.location.href = '/'; }}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                חזור לדף הבית
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

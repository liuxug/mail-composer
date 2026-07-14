import { useEffect } from 'react';
import { XCircle, Mail, User } from 'lucide-react';

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        onRemove(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  const handleClose = () => {
    onRemove(toast.id);
  };

  if (toast.type === 'email' && toast.emails && toast.emails.length > 0) {
    return (
      <div className="animate-[slideUpIn_0.3s_ease-out]">
        <div className="bg-white rounded-lg shadow-xl border border-gray-100 min-w-[320px] overflow-hidden mb-3">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Mail className="w-4 h-4" />
              <span className="text-sm font-medium">新邮件</span>
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white transition"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            {toast.emails.slice(0, 3).map((email, index) => (
              <div key={index} className="flex items-start gap-3 pb-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-800 text-sm truncate">
                      {email.fromName || email.from_addr || email.from || '未知发件人'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {email.from_addr || email.from || ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {email.subject || '无主题'}
                  </p>
                </div>
              </div>
            ))}
            {toast.emails.length > 3 && (
              <div className="text-center text-sm text-gray-400 pt-2 border-t border-gray-100">
                还有 {toast.emails.length - 3} 封新邮件
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };

  return (
    <div className="animate-[slideUpIn_0.3s_ease-out] mb-3">
      <div className={`flex items-center gap-3 px-4 py-3 ${colors[toast.type]} text-white rounded-lg shadow-lg`}>
        <span className="text-sm font-medium">{toast.message}</span>
        <button
          onClick={handleClose}
          className="ml-2 hover:bg-white/20 rounded-full p-0.5 transition"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function Toast({ toasts, onRemove }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}
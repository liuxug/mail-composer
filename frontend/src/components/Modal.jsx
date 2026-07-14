import { X } from 'lucide-react';

export default function Modal({ title, content, show, onClose, onConfirm, confirmText = '确定', cancelText = '取消', type = 'confirm' }) {
  if (!show) return null;

  const handleConfirm = () => {
    onConfirm && onConfirm();
    onClose && onClose();
  };

  const handleCancel = () => {
    onClose && onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 animate-[fadeIn_0.2s_ease-out]">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">{title}</h2>
          <button
            onClick={handleCancel}
            className="p-1 text-gray-500 hover:bg-gray-100 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <p className="text-gray-600">{content}</p>
        </div>
        
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded transition ${type === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
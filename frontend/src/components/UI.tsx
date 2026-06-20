import { component$ } from "@builder.io/qwik";

interface ModalProps {
  open: boolean;
  title: string;
  onClose$: () => void;
  children: any;
  width?: string;
  footer?: any;
}

export const Modal = component$<ModalProps>(({ open, title, onClose$, children, width = 'max-w-lg', footer }) => {
  if (!open) return null;
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick$={onClose$}>
      <div
        class={`bg-white rounded-2xl shadow-2xl w-full ${width} max-h-[90vh] flex flex-col overflow-hidden`}
        onClick$={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick$={onClose$}
            class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div class="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
});

interface ButtonProps {
  type?: 'button' | 'submit';
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'ghost' | 'default';
  size?: 'sm' | 'md' | 'lg';
  onClick$?: () => void;
  disabled?: boolean;
  children: any;
  class?: string;
}

const variantMap: Record<string, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20',
  success: 'bg-green-600 hover:bg-green-700 text-white shadow-sm shadow-green-500/20',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-500/20',
  ghost: 'text-gray-600 hover:bg-gray-100 text-gray-700',
  default: 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm',
};

const sizeMap: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
};

export const Button = component$<ButtonProps>(({ type = 'button', variant = 'default', size = 'md', onClick$, disabled, children, class: extraClass = '' }) => {
  return (
    <button
      type={type}
      onClick$={onClick$}
      disabled={disabled}
      class={`inline-flex items-center justify-center gap-2 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variantMap[variant]} ${sizeMap[size]} ${extraClass}`}
    >
      {children}
    </button>
  );
});

interface SelectFieldProps {
  label?: string;
  value: string;
  onChange$: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  class?: string;
  required?: boolean;
}

export const SelectField = component$<SelectFieldProps>(({ label, value, onChange$, options, placeholder = '请选择', class: extraClass = '', required }) => {
  return (
    <div class={extraClass}>
      {label && (
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span class="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange$={(e) => onChange$((e.target as HTMLSelectElement).value)}
        class="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
});

interface InputFieldProps {
  label?: string;
  value: string;
  onChange$: (v: string) => void;
  placeholder?: string;
  type?: string;
  class?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
}

export const InputField = component$<InputFieldProps>(({ label, value, onChange$, placeholder, type = 'text', class: extraClass = '', required, disabled, rows }) => {
  const base = `${rows ? 'resize-y' : ''} w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400`;
  return (
    <div class={extraClass}>
      {label && (
        <label class="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span class="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {rows ? (
        <textarea
          value={value}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          onInput$={(e) => onChange$((e.target as HTMLTextAreaElement).value)}
          class={base}
        />
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onInput$={(e) => onChange$((e.target as HTMLInputElement).value)}
          class={base}
        />
      )}
    </div>
  );
});

export const EmptyState = component$<{ text?: string }>(({ text = '暂无数据' }) => {
  return (
    <div class="py-16 text-center">
      <div class="w-20 h-20 bg-gray-50 rounded-full mx-auto flex items-center justify-center mb-4">
        <svg class="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <p class="text-gray-400 text-sm">{text}</p>
    </div>
  );
});

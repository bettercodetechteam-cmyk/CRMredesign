import React from 'react';
import { cn } from '@/lib/utils';

interface ProfessionalFormProps {
  children: React.ReactNode;
  className?: string;
  onSubmit?: (e: React.FormEvent) => void;
}

export const ProfessionalForm: React.FC<ProfessionalFormProps> = ({ 
  children, 
  className,
  onSubmit 
}) => {
  return (
    <form 
      className={cn("space-y-4 xs:space-y-5 sm:space-y-6", className)}
      onSubmit={onSubmit}
    >
      {children}
    </form>
  );
};

interface FormGroupProps {
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}

export const FormGroup: React.FC<FormGroupProps> = ({ 
  children, 
  className,
  columns = 1 
}) => {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 xs:grid-cols-2",
    3: "grid-cols-1 xs:grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
  };

  return (
    <div className={cn(
      "grid gap-4 xs:gap-5",
      gridCols[columns],
      className
    )}>
      {children}
    </div>
  );
};

interface FormFieldProps {
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({ 
  children, 
  className,
  fullWidth = true 
}) => {
  return (
    <div className={cn(
      fullWidth ? "col-span-full" : "",
      className
    )}>
      {children}
    </div>
  );
};

interface FormLabelProps {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
  required?: boolean;
}

export const FormLabel: React.FC<FormLabelProps> = ({ 
  children, 
  htmlFor,
  className,
  required = false 
}) => {
  return (
    <label 
      htmlFor={htmlFor}
      className={cn(
        "block text-sm xs:text-base font-medium text-gray-700 mb-2 font-sans",
        required && "after:content-['*'] after:ml-1 after:text-red-500",
        className
      )}
    >
      {children}
    </label>
  );
};

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  error?: boolean;
  helperText?: string;
}

export const FormInput: React.FC<FormInputProps> = ({ 
  className,
  error = false,
  helperText,
  ...props 
}) => {
  return (
    <div className="w-full">
      <input
        className={cn(
          "w-full px-4 py-3 border rounded-lg text-sm xs:text-base font-body",
          "focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200",
          "bg-white placeholder-gray-400",
          error 
            ? "border-red-300 focus:ring-red-500 focus:border-red-500" 
            : "border-gray-300 hover:border-gray-400",
          className
        )}
        {...props}
      />
      {helperText && (
        <p className={cn(
          "mt-1 text-xs xs:text-sm",
          error ? "text-red-600" : "text-gray-500"
        )}>
          {helperText}
        </p>
      )}
    </div>
  );
};

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
  error?: boolean;
  helperText?: string;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({ 
  className,
  error = false,
  helperText,
  ...props 
}) => {
  return (
    <div className="w-full">
      <textarea
        className={cn(
          "w-full px-4 py-3 border rounded-lg text-sm xs:text-base font-body resize-none",
          "focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200",
          "bg-white placeholder-gray-400 min-h-[100px]",
          error 
            ? "border-red-300 focus:ring-red-500 focus:border-red-500" 
            : "border-gray-300 hover:border-gray-400",
          className
        )}
        {...props}
      />
      {helperText && (
        <p className={cn(
          "mt-1 text-xs xs:text-sm",
          error ? "text-red-600" : "text-gray-500"
        )}>
          {helperText}
        </p>
      )}
    </div>
  );
};

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
  error?: boolean;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
}

export const FormSelect: React.FC<FormSelectProps> = ({ 
  className,
  error = false,
  helperText,
  options,
  ...props 
}) => {
  return (
    <div className="w-full">
      <select
        className={cn(
          "w-full px-4 py-3 border rounded-lg text-sm xs:text-base font-body",
          "focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200",
          "bg-white",
          error 
            ? "border-red-300 focus:ring-red-500 focus:border-red-500" 
            : "border-gray-300 hover:border-gray-400",
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText && (
        <p className={cn(
          "mt-1 text-xs xs:text-sm",
          error ? "text-red-600" : "text-gray-500"
        )}>
          {helperText}
        </p>
      )}
    </div>
  );
};

interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
}

export const FormActions: React.FC<FormActionsProps> = ({ 
  children, 
  className 
}) => {
  return (
    <div className={cn(
      "flex flex-col xs:flex-row gap-3 xs:gap-4 pt-4 xs:pt-5",
      className
    )}>
      {children}
    </div>
  );
};

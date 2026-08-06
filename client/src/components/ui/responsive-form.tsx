import { forwardRef, type FormHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResponsiveFormProps extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode;
  className?: string;
}

const ResponsiveForm = forwardRef<HTMLFormElement, ResponsiveFormProps>(
  ({ className, children, ...props }, ref) => (
    <form
      ref={ref}
      className={cn("form-responsive space-y-4 sm:space-y-6", className)}
      {...props}
    >
      {children}
    </form>
  )
);
ResponsiveForm.displayName = "ResponsiveForm";

interface ResponsiveFormGroupProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}

const ResponsiveFormGroup = forwardRef<HTMLDivElement, ResponsiveFormGroupProps>(
  ({ className, children, columns = 1, ...props }, ref) => {
    const gridClasses = {
      1: "grid-cols-1",
      2: "grid-cols-1 sm:grid-cols-2",
      3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "form-grid-responsive grid gap-3 sm:gap-4",
          gridClasses[columns],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ResponsiveFormGroup.displayName = "ResponsiveFormGroup";

interface ResponsiveFormFieldProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  label?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
}

const ResponsiveFormField = forwardRef<HTMLDivElement, ResponsiveFormFieldProps>(
  ({ className, children, label, error, required, fullWidth = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "space-y-2",
        fullWidth ? "col-span-full" : "",
        className
      )}
      {...props}
    >
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
);
ResponsiveFormField.displayName = "ResponsiveFormField";

interface ResponsiveFormActionsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  align?: "left" | "center" | "right" | "between";
}

const ResponsiveFormActions = forwardRef<HTMLDivElement, ResponsiveFormActionsProps>(
  ({ className, children, align = "right", ...props }, ref) => {
    const alignClasses = {
      left: "justify-start",
      center: "justify-center",
      right: "justify-end",
      between: "justify-between",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col sm:flex-row gap-3 sm:gap-4",
          alignClasses[align],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ResponsiveFormActions.displayName = "ResponsiveFormActions";

export {
  ResponsiveForm,
  ResponsiveFormGroup,
  ResponsiveFormField,
  ResponsiveFormActions,
};

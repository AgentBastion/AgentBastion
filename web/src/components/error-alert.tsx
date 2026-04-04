import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  className?: string;
  children?: React.ReactNode;
}

export function ErrorAlert({ message, className, children }: ErrorAlertProps) {
  return (
    <div className={`rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2 ${className ?? ''}`}>
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {children}
    </div>
  );
}

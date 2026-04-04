import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ErrorAlertProps {
  message: string;
  className?: string;
  children?: React.ReactNode;
}

export function ErrorAlert({ message, className, children }: ErrorAlertProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center gap-2">
        <span className="flex-1">{message}</span>
        {children}
      </AlertDescription>
    </Alert>
  );
}

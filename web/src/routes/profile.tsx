import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Lock, LogOut, Trash2 } from 'lucide-react';
import { apiPost, apiDelete } from '@/lib/api';

export function ProfilePage() {
  const { t } = useTranslation();

  // --- Password change ---
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword !== confirmPassword) {
      setPwError(t('auth.passwordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setPwError(t('auth.passwordMinLength', 'Password must be at least 8 characters'));
      return;
    }

    setPwLoading(true);
    try {
      await apiPost('/api/auth/password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPwSuccess(t('auth.passwordChanged'));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Force logout after 2 seconds
      setTimeout(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        sessionStorage.removeItem('signing_key');
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  // --- Revoke all sessions ---
  const handleRevokeSessions = async () => {
    if (!confirm(t('auth.revokeSessionsConfirm'))) return;
    try {
      await apiPost('/api/auth/revoke-sessions', {});
      alert(t('auth.sessionsRevoked'));
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      sessionStorage.removeItem('signing_key');
      window.location.href = '/';
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  // --- Delete account ---
  const handleDeleteAccount = async () => {
    const email = prompt(t('auth.deleteAccountConfirm'));
    if (!email) return;
    try {
      await apiDelete('/api/auth/account');
      alert(t('auth.accountDeleted'));
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      sessionStorage.removeItem('signing_key');
      window.location.href = '/';
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('auth.profile')}</h1>
      </div>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            {t('auth.changePassword')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {pwError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{pwError}</div>
            )}
            {pwSuccess && (
              <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">{pwSuccess}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="old-pw">{t('auth.oldPassword')}</Label>
              <Input id="old-pw" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">{t('auth.newPassword')}</Label>
              <Input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">{t('auth.confirmPassword')}</Label>
              <Input id="confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={pwLoading}>
              {pwLoading ? t('common.loading') : t('auth.changePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogOut className="h-4 w-4" />
            {t('auth.revokeSessions')}
          </CardTitle>
          <CardDescription>
            {t('auth.revokeSessionsConfirm')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleRevokeSessions}>
            <LogOut className="h-4 w-4 mr-2" />
            {t('auth.revokeSessions')}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Danger Zone: Delete Account */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <Trash2 className="h-4 w-4" />
            {t('auth.deleteAccount')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDeleteAccount}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t('auth.deleteAccount')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

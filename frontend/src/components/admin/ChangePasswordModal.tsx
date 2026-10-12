import { useState } from 'react';
import { authApi } from '@/services/adminApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

/** Troca da própria senha (exige a senha atual). */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const close = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setErrors({});
    onClose();
  };

  const save = async () => {
    if (next !== confirm) return setErrors({ confirm: 'As senhas não conferem.' });
    setSaving(true);
    setErrors({});
    try {
      await authApi.changePassword(current, next);
      toast('Senha alterada.');
      close();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(friendlyMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Trocar minha senha"
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={saving}>Salvar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Senha atual" required error={errors.currentPassword}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
        </Field>
        <Field label="Nova senha" required hint="8 ou mais caracteres, com letras e números." error={errors.newPassword}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
        </Field>
        <Field label="Repita a nova senha" required error={errors.confirm}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}

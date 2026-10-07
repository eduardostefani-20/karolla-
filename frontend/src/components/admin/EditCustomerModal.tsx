import { useState } from 'react';
import { formatPhone, normalizeBrazilianPhone, type Customer } from '@karolla/shared';
import { adminApi } from '@/services/adminApi';
import { ApiError, friendlyMessage } from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';

export function EditCustomerModal({ customer, open, onClose, onSaved }: { customer: Customer; open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...customer, whatsapp: formatPhone(customer.whatsapp) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const setAddr = (patch: Partial<Customer['address']>) => setForm((f) => ({ ...f, address: { ...f.address, ...patch } }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      await adminApi.updateCustomer(customer.id, {
        name: form.name,
        whatsapp: normalizeBrazilianPhone(form.whatsapp),
        email: form.email,
        address: form.address,
        notes: form.notes,
      });
      toast('Dados do tutor atualizados.');
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar tutor" size="lg" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="secondary" onClick={save} loading={saving}>Salvar</Button></>}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Nome completo" required error={errors.name}>{(p) => <Input {...p} value={form.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp" required error={errors.whatsapp}>{(p) => <Input {...p} type="tel" value={form.whatsapp} onChange={(e) => set({ whatsapp: formatPhone(e.target.value) })} />}</Field>
          <Field label="E-mail" error={errors.email}>{(p) => <Input {...p} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />}</Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="Endereço">{(p) => <Input {...p} value={form.address.street} onChange={(e) => setAddr({ street: e.target.value })} />}</Field>
          <Field label="Número">{(p) => <Input {...p} value={form.address.number} onChange={(e) => setAddr({ number: e.target.value })} />}</Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Complemento">{(p) => <Input {...p} value={form.address.complement} onChange={(e) => setAddr({ complement: e.target.value })} />}</Field>
          <Field label="Bairro">{(p) => <Input {...p} value={form.address.neighborhood} onChange={(e) => setAddr({ neighborhood: e.target.value })} />}</Field>
          <Field label="Cidade">{(p) => <Input {...p} value={form.address.city} onChange={(e) => setAddr({ city: e.target.value })} />}</Field>
        </div>
        <Field label="Observações internas">{(p) => <Textarea {...p} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />}</Field>
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import { FiEdit2, FiPlus, FiStar, FiTrash2 } from 'react-icons/fi';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Modal from '../../components/common/Modal';
import { useGuardians } from '../../contexts/GuardianContext';
import { useNotify } from '../../contexts/NotificationContext';
import type { Guardian } from '../../types';
import { initials } from '../../utils/format';

const palette = ['#4FA89B', '#5C8FB4', '#D97D6C', '#A9C7DE', '#6FBFB2'];
const emptyForm = { name: '', relation: '', phone: '', email: '' };

export default function GuardiansPage() {
  const { guardians, isLoading, addGuardian, updateGuardian, removeGuardian } = useGuardians();
  const notify = useNotify();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Guardian | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Guardian | null>(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (g: Guardian) => {
    setEditing(g);
    setForm({ name: g.name, relation: g.relation, phone: g.phone, email: g.email ?? '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      notify('Name and phone number are required.', 'warning');
      return;
    }
    setSaving(true);
    if (editing) {
      await updateGuardian(editing.id, form);
      notify('Guardian updated.', 'success');
    } else {
      const avatarColor = palette[guardians.length % palette.length];
      await addGuardian({ ...form, avatarColor });
      notify('Guardian added to your circle.', 'success');
    }
    setSaving(false);
    setModalOpen(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await removeGuardian(confirmDelete.id);
    notify('Guardian removed.', 'info');
    setConfirmDelete(null);
  };

  return (
    <div className="max-w-4xl pb-10">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-sky-300/75 max-w-md">
          The people who hear from Tether first. They'll get your live location and status the moment an alert goes out.
        </p>
        <Button icon={<FiPlus />} onClick={openAdd}>Add guardian</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-sky-300/60">Loading your guardian circle…</p>
      ) : guardians.length === 0 ? (
        <Card className="text-center py-14">
          <p className="text-sky-200">No guardians yet.</p>
          <p className="text-sm text-sky-300/70 mt-1">Add someone you trust so Tether always has a hand to reach for.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {guardians.map((g) => (
            <Card key={g.id} interactive className="flex items-start gap-4">
              <span
                className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold text-dusk-950 shrink-0"
                style={{ backgroundColor: g.avatarColor }}
              >
                {initials(g.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sky-50 font-medium truncate">{g.name}</p>
                  {g.isPrimary && <FiStar size={13} className="text-teal-400 shrink-0" />}
                </div>
                <p className="text-xs font-mono text-sky-300/60 mt-1">{g.phone}</p>
                {g.email && <p className="text-xs font-mono text-teal-300/80 mt-0.5 truncate">{g.email}</p>}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => openEdit(g)}
                  aria-label={`Edit ${g.name}`}
                  className="p-2 rounded-lg hover:bg-white/[0.08] text-sky-300"
                >
                  <FiEdit2 size={14} />
                </button>
                <button
                  onClick={() => setConfirmDelete(g)}
                  aria-label={`Delete ${g.name}`}
                  className="p-2 rounded-lg hover:bg-white/[0.08] text-coral-400"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit guardian' : 'Add guardian'}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-sky-300/70">Full name</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Meera Nair" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-sky-300/70">Relation</span>
            <input className="input" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="e.g. Mother, Roommate" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-sky-300/70">Phone number</span>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 90000 00000" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-sky-300/70">Email (optional)</span>
            <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" />
          </label>
          <Button fullWidth loading={saving} onClick={handleSave} className="mt-2">
            {editing ? 'Save changes' : 'Add to circle'}
          </Button>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Remove guardian?" maxWidth="max-w-sm">
        <p className="text-sm text-sky-300/80">
          {confirmDelete?.name} will no longer receive alerts or live location from you.
        </p>
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={handleDelete}>Remove</Button>
        </div>
      </Modal>
    </div>
  );
}

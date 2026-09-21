import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { X, User as UserIcon, Mail, Shield, CheckCircle, RefreshCw } from 'lucide-react';

export const UserModal = ({
  showUserModal,
  selectedUserForEdit,
  fetchUsers,
  isSubmitting,
  setIsSubmitting,
  setShowUserModal,
  currentUser
}: any) => {
  return (
        <AnimatePresence>
          {
            showUserModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 lg:p-8 my-auto"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">
                      {selectedUserForEdit ? 'Editar Colaborador' : 'Convidar Colaborador'}
                    </h3>
                    <button onClick={() => setShowUserModal, currentUser(false)}><X size={20} /></button>
                  </div>
                  <form className="space-y-4" onSubmit={async (e) => {
                    e.preventDefault();
                    if (isSubmitting) return;
                    setIsSubmitting(true);
                    const form = e.currentTarget;
                    const formData = new FormData(form);
                    const data = Object.fromEntries(formData.entries());

                    const url = selectedUserForEdit ? `/api/users/${selectedUserForEdit.id}` : '/api/users';
                    const method = selectedUserForEdit ? 'PATCH' : 'POST';

                    try {
                      const res = await fetch(url, {
                        method,
                        headers: {
                          'Content-Type': 'application/json',
                          'x-user-role': currentUser?.role || ''
                        },
                        body: JSON.stringify({
                          ...data,
                          hourly_cost: Number(data.hourly_cost),
                          active: data.active === 'on' || !selectedUserForEdit
                        })
                      });

                      if (!res.ok) {
                        const errData = await res.json().catch(() => null);
                        alert(`Erro: ${errData?.error || 'Falha na operação'}`);
                        return;
                      }

                      setShowUserModal, currentUser(false);
                      fetchUsers();
                    } catch (error) {
                      alert("Erro ao conectar com o servidor.");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome Completo</label>
                      <input
                        name="name"
                        type="text"
                        defaultValue={selectedUserForEdit?.name}
                        placeholder="Ex: João Silva"
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">E-mail</label>
                      <input
                        name="email"
                        type="email"
                        defaultValue={selectedUserForEdit?.email}
                        placeholder="joao@uniflow.com"
                        className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                        required
                      />
                    </div>
                    {!selectedUserForEdit && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Senha Temporária</label>
                        <input
                          name="password"
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm"
                          required
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Função / Acesso</label>
                        <select
                          name="role"
                          defaultValue={selectedUserForEdit?.role || 'Produção'}
                          className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Produção">Produção</option>
                          <option value="Comercial">Comercial</option>
                        </select>
                      </div>
                      {currentUser?.role === 'Admin' && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Custo/Hora (R$)</label>
                          <input
                            name="hourly_cost"
                            type="number"
                            step="0.01"
                            defaultValue={selectedUserForEdit?.hourly_cost || 0}
                            placeholder="0,00"
                            className="w-full p-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                            required
                          />
                        </div>
                      )}
                    </div>
                    {selectedUserForEdit && (
                      <div className="flex items-center gap-2">
                        <input
                          name="active"
                          type="checkbox"
                          defaultChecked={selectedUserForEdit.active}
                          id="user-active"
                        />
                        <label htmlFor="user-active" className="text-sm text-zinc-600">Colaborador Ativo</label>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={cn(
                        "w-full py-3 bg-zinc-900 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                        isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:bg-zinc-800 active:scale-[0.98]"
                      )}
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Processando...
                        </>
                      ) : (
                        selectedUserForEdit ? 'Salvar Alterações' : 'Convidar Colaborador'
                      )}
                    </button>
                  </form>
                </motion.div>
              </div>
            )
          }
        </AnimatePresence >
  );
};








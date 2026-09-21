import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/Badge';
import { User as UserIcon, Edit2 } from 'lucide-react';

export const Collaborators = ({ users, currentUser, setSelectedUserForEdit, setShowUserModal }: any) => {
  return (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <p className="text-sm text-zinc-500">{users.length} colaboradores</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {users.map(user => (
                <Card key={user.id} className="p-4 flex items-center justify-between hover:border-zinc-300 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900">{user.name}</h4>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><UserIcon size={12} /> {user.email}</span>
                        {currentUser?.role === 'Admin' && (
                          <>
                            <span>•</span>
                            <span>R$ {user.hourly_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/h</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={user.role === 'Admin' ? 'info' : 'default'}>{user.role}</Badge>
                    <button
                      onClick={() => {
                        setSelectedUserForEdit(user);
                        setShowUserModal(true);
                      }}
                      className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
  );
};
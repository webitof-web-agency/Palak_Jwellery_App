const roleClasses = {
  admin: 'bg-gold-500/10 text-gold-500 border-gold-500/20',
  salesman: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
}

export default function UserRow({ user, onToggleStatus, onDelete, onEdit }) {
  const initial = user?.name?.[0] || 'U'
  const isActive = Boolean(user?.isActive)
  const joinedDate = user?.createdAt ? new Date(user.createdAt) : null

  return (
    <tr className="group transition-all hover:bg-[var(--jsm-panel-bg-faint)]">
      <td className="px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl surface-panel-faint panel-border font-bold uppercase text-heading">
            {initial}
          </div>
          <div>
            <div className="font-bold text-primary">{user?.name || 'Unknown'}</div>
            <div className="text-[10px] font-bold text-muted">{user?.email || '-'}</div>
            {user?.phone ? <div className="text-[10px] font-bold text-muted">{user.phone}</div> : null}
          </div>
        </div>
      </td>
      <td className="px-8 py-5">
        <span className={`rounded-lg border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${roleClasses[user?.role] || roleClasses.salesman}`}>
          {user?.role || 'salesman'}
        </span>
      </td>
      <td className="px-8 py-5">
        <button
          type="button"
          onClick={() => onToggleStatus(user?._id)}
          className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
            isActive ? 'text-green-500 hover:text-green-400' : 'text-muted hover:text-primary'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-[var(--jsm-border)]'
            }`}
          />
          {isActive ? 'Active' : 'Inactive'}
        </button>
      </td>
      <td className="px-8 py-5 text-muted text-[10px] font-bold uppercase tracking-widest">
        {joinedDate
          ? joinedDate.toLocaleDateString(undefined, {
              day: '2-digit',
              month: 'short',
            })
          : '-'}
      </td>
      <td className="px-8 py-5 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onEdit(user)}
            className="rounded-xl border border-[var(--jsm-border)] surface-panel-soft px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-heading transition-all hover:border-gold-500/30 hover:bg-gold-500/10 hover:text-primary"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(user?._id, user?.name)}
            className="text-[10px] font-bold uppercase tracking-widest text-red-500/60 transition-colors hover:text-red-500"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

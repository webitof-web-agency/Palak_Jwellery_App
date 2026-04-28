const roleClasses = {
  admin: 'bg-gold-500/10 text-gold-500 border-gold-500/20',
  salesman: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
}

export default function UserRow({ user, onToggleStatus, onDelete }) {
  const initial = user?.name?.[0] || 'U'
  const isActive = Boolean(user?.isActive)

  return (
    <tr className="hover:bg-white/[0.02] transition-all group">
      <td className="px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl surface-panel-faint panel-border flex items-center justify-center font-bold text-heading uppercase">
            {initial}
          </div>
          <div>
            <div className="text-primary font-bold">{user?.name || 'Unknown'}</div>
            <div className="text-[10px] text-muted font-bold">{user?.email || '-'}</div>
            {user?.phone ? (
              <div className="text-[10px] text-muted font-bold">{user.phone}</div>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-8 py-5">
        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${roleClasses[user?.role] || roleClasses.salesman}`}>
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
            className={`w-1.5 h-1.5 rounded-full ${
              isActive
                ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                : 'bg-white/10'
            }`}
          />
          {isActive ? 'Active' : 'Inactive'}
        </button>
      </td>
      <td className="px-8 py-5 text-muted text-[10px] font-bold uppercase tracking-widest">
        {new Date(user?.createdAt || Date.now()).toLocaleDateString(undefined, {
          day: '2-digit',
          month: 'short',
        })}
      </td>
      <td className="px-8 py-5 text-right">
        <button
          type="button"
          onClick={() => onDelete(user?._id, user?.name)}
          className="text-[10px] uppercase font-bold tracking-widest text-red-500/60 hover:text-red-500 transition-colors"
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

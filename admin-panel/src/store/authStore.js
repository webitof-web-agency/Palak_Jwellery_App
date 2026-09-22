import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      // zustand's persist middleware rehydrates from localStorage
      // asynchronously (a microtask) even though localStorage itself is
      // synchronous — so on first paint, before this flips true, `token`
      // reads as null regardless of what's actually stored. Anything that
      // makes a routing decision off `token`/`user` (see App.jsx's
      // HomeRedirect/PublicRoute/ProtectedRoute) must wait for this,
      // otherwise a logged-in user hitting "/" gets bounced to /login and
      // right back to /dashboard a moment later — visible as a blank flash.
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setAuth: ({ token, user }) => {
        set({ token, user })
      },
      clearAuth: () => {
        set({ token: null, user: null })
      },
    }),
    {
      name: 'jewellery-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      // Called with (state, error) — must flip hasHydrated even on error
      // (e.g. corrupted localStorage JSON), otherwise routing stays gated
      // forever instead of just falling back to "logged out".
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          useAuthStore.setState({ hasHydrated: true })
          return
        }
        state?.setHasHydrated(true)
      },
    },
  ),
)

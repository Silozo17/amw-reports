import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { AppRole, Profile } from '@/types/database';

interface ClientUserInfo {
  client_id: string;
  org_id: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  isOwner: boolean;
  isPlatformAdmin: boolean;
  isManager: boolean;
  isClientUser: boolean;
  clientUserInfo: ClientUserInfo | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [clientUserInfo, setClientUserInfo] = useState<ClientUserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScopeReady, setIsScopeReady] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    setProfile(profileData as Profile | null);

    const { data: memberData } = await supabase
      .from('org_members')
      .select('role')
      .eq('user_id', userId)
      .limit(1)
      .single();
    setRole((memberData?.role as AppRole) ?? null);

    const { data: adminData } = await supabase
      .from('platform_admins')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    setIsPlatformAdmin(!!adminData);

    // Check if user is a client_user
    const { data: cuData } = await supabase
      .rpc('get_client_user_info', { _user_id: userId });
    if (cuData && cuData.length > 0) {
      setClientUserInfo({ client_id: cuData[0].client_id, org_id: cuData[0].org_id });
    } else {
      setClientUserInfo(null);
    }
  }, []);

  const refetchProfile = useCallback(async () => {
    if (!user) return;
    await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setRole(null);
          setIsPlatformAdmin(false);
          setClientUserInfo(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading,
        isOwner: role === 'owner',
        isPlatformAdmin,
        isManager: role === 'manager',
        isClientUser: !!clientUserInfo,
        clientUserInfo,
        signIn,
        signUp,
        signOut,
        refetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

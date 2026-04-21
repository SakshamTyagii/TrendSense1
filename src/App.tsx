import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useStore } from './store/useStore';
import { syncUsageFromServer } from './lib/subscription';
import HomeFeed from './components/HomeFeed';
import BottomNav from './components/BottomNav';
import CategoryBar from './components/CategoryBar';

// Lazy-loaded routes — code-split for smaller initial bundle
const AuthScreen = lazy(() => import('./components/AuthScreen'));
const DetailView = lazy(() => import('./components/DetailView'));
const CreatorStudio = lazy(() => import('./components/CreatorStudio'));
const SearchView = lazy(() => import('./components/SearchView'));
const ProfileView = lazy(() => import('./components/ProfileView'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isAuthLoading, currentView, setView, initAuth, user } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [checkoutToast, setCheckoutToast] = useState<string | null>(null);

  // Initialize Supabase auth on mount (checks session, listens for changes)
  useEffect(() => {
    initAuth();
  }, []);

  // Handle Stripe checkout return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (checkout === 'success') {
      setCheckoutToast('Welcome to Pro! \ud83c\udf89 Unlimited access unlocked.');
      // Sync subscription from server so isPro() returns true immediately
      if (user) {
        syncUsageFromServer(user.id).catch(() => {});
      }
      window.history.replaceState({}, '', '/');
      setTimeout(() => setCheckoutToast(null), 5000);
    } else if (checkout === 'canceled') {
      setCheckoutToast('Checkout canceled. You can upgrade anytime.');
      window.history.replaceState({}, '', '/');
      setTimeout(() => setCheckoutToast(null), 4000);
    }
  }, [user]);

  // Sync Zustand currentView → URL
  useEffect(() => {
    const viewToPath: Record<string, string> = {
      feed: '/',
      detail: '/story',
      search: '/search',
      profile: '/profile',
      creator: '/creator',
    };
    const targetPath = viewToPath[currentView] || '/';
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  }, [currentView]);

  // Sync URL → Zustand currentView (on initial load / back button)
  useEffect(() => {
    const pathToView: Record<string, typeof currentView> = {
      '/': 'feed',
      '/story': 'detail',
      '/search': 'search',
      '/profile': 'profile',
      '/creator': 'creator',
      '/login': 'feed',
    };
    const view = pathToView[location.pathname];
    if (view && view !== currentView) {
      setView(view);
    }
  }, [location.pathname]);

  // Public route: login
  if (!isAuthenticated && location.pathname !== '/login') {
    // Allow the feed to be visible to crawlers (public content)
  }

  // Show loading while Supabase checks the session (avoids login flash)
  if (isAuthLoading) {
    return <LoadingFallback />;
  }

  return (
    <div className="bg-black min-h-screen">
      {/* Checkout toast */}
      {checkoutToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold shadow-lg shadow-amber-500/30 animate-pulse">
          {checkoutToast}
        </div>
      )}
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public route — login */}
          <Route path="/login" element={<AuthScreen />} />

          {/* Main feed — public for crawlers, functional for logged-in users */}
          <Route path="/" element={
            !isAuthenticated ? <AuthScreen /> : (
              <>
                <CategoryBar />
                <HomeFeed />
              </>
            )
          } />

          {/* Protected routes */}
          <Route path="/story" element={
            isAuthenticated ? (
              <AnimatePresence>
                <DetailView key="detail" />
              </AnimatePresence>
            ) : <AuthScreen />
          } />
          <Route path="/search" element={
            isAuthenticated ? (
              <AnimatePresence>
                <SearchView key="search" />
              </AnimatePresence>
            ) : <AuthScreen />
          } />
          <Route path="/profile" element={
            isAuthenticated ? (
              <AnimatePresence>
                <ProfileView key="profile" />
              </AnimatePresence>
            ) : <AuthScreen />
          } />
          <Route path="/creator" element={
            isAuthenticated ? (
              <AnimatePresence>
                <CreatorStudio key="creator" />
              </AnimatePresence>
            ) : <AuthScreen />
          } />

          {/* Catch-all — redirect to feed */}
          <Route path="*" element={
            !isAuthenticated ? <AuthScreen /> : (
              <>
                <CategoryBar />
                <HomeFeed />
              </>
            )
          } />
        </Routes>
      </Suspense>

      {/* Persistent bottom nav — visible on ALL authenticated screens */}
      {isAuthenticated && <BottomNav />}
    </div>
  );
}

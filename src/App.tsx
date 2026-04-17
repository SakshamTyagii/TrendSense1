import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useStore } from './store/useStore';
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
  const { isAuthenticated, isAuthLoading, currentView, setView, initAuth } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize Supabase auth on mount (checks session, listens for changes)
  useEffect(() => {
    initAuth();
  }, []);

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
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public route — login */}
          <Route path="/login" element={<AuthScreen />} />

          {/* Main feed — public for crawlers, functional for logged-in users */}
          <Route path="/" element={
            <>
              {!isAuthenticated ? (
                <AuthScreen />
              ) : (
                <>
                  <CategoryBar />
                  <HomeFeed />
                  <BottomNav />
                </>
              )}
            </>
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
              <>
                <AnimatePresence>
                  <SearchView key="search" />
                </AnimatePresence>
                <BottomNav />
              </>
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
                <BottomNav />
              </>
            )
          } />
        </Routes>
      </Suspense>
    </div>
  );
}

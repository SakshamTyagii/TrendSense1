import { AnimatePresence } from 'framer-motion';
import { useStore } from './store/useStore';
import AuthScreen from './components/AuthScreen';
import HomeFeed from './components/HomeFeed';
import DetailView from './components/DetailView';
import CreatorStudio from './components/CreatorStudio';
import SearchView from './components/SearchView';
import ProfileView from './components/ProfileView';
import BottomNav from './components/BottomNav';
import CategoryBar from './components/CategoryBar';

export default function App() {
  const { isAuthenticated, currentView } = useStore();

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="bg-black min-h-screen">
      {/* Category bar - only on feed */}
      {currentView === 'feed' && <CategoryBar />}

      {/* Main content */}
      {currentView === 'feed' && <HomeFeed />}

      {/* Overlays */}
      <AnimatePresence>
        {currentView === 'detail' && <DetailView key="detail" />}
        {currentView === 'creator' && <CreatorStudio key="creator" />}
        {currentView === 'search' && <SearchView key="search" />}
        {currentView === 'profile' && <ProfileView key="profile" />}
      </AnimatePresence>

      {/* Bottom navigation */}
      {currentView !== 'detail' && currentView !== 'creator' && <BottomNav />}
    </div>
  );
}

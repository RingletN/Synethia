import { Routes, Route, Navigate, useLocation} from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Loader from './components/ui/Loader'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import BackgroundGlow from './components/layout/BackgroundGlow'
import Home from './pages/Home/Home'
// import Canvas from './pages/Canvas'
import Projects from './pages/Projects/Projects'
import Profile from './pages/Profile/Profile'
import AuthPage from './pages/Autentification/AuthPage'

import './App.css'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  // if (loading) return <div>Загрузка...</div>;
  return user ? children : <Navigate to="/auth" />;
}

function App() {

  const { loading } = useAuth();
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth';
  if (loading) {
   return (
    <>
    <Header />
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(11, 11, 31, 0.4)',
        zIndex: 9999,
      }}>
        <Loader size={80} color="cyan" speed={1400} />
      </div>
      </>
    );
  }

  return (
    <>
      <BackgroundGlow />
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projects" element={<Projects />}/>
       {/* <Route path="/canvas" element={<Canvas />} /> */}
         <Route path="/auth" element={<AuthPage />} />
        <Route 
          path="/profile" 
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } 
        />
      </Routes>

      {!isAuthPage && <Footer />}
    </>
  )
}

export default App;
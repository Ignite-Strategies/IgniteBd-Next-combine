import { useNavigate, useLocation } from "react-router-dom";

export default function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navItems = [
    { path: '/bdpipeline', label: 'Pipeline', icon: '🎯' },
    { path: '/growth-dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/personas', label: 'Personas', icon: '👤' },
    { path: '/outreach', label: 'Outreach', icon: '📧' },
    { path: '/meetings', label: 'Meetings', icon: '📅' },
    { path: '/proposals', label: 'Proposals', icon: '📄' },
    { path: '/assessment', label: 'Assessment', icon: '📊' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          
          {/* Logo/Brand */}
          <div className="flex items-center">
            <button
              onClick={() => navigate('/growth-dashboard')}
              className="flex items-center space-x-2 text-lg font-bold text-red-600 hover:text-red-700 transition-colors"
            >
              <span className="text-2xl">🔥</span>
              <span>Ignite BD</span>
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isActive(item.path)
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-gray-700 hover:text-red-600 hover:bg-red-50'
                }`}
              >
                <span className="mr-1.5">{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}


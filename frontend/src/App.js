import React, { useState, useEffect, createContext, useContext, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { 
  Users, BarChart3, Settings, LogOut, Menu, X, Search, Plus, Edit, Trash2,
  ChevronLeft, ChevronRight, User, Phone, Mail, Calendar, Heart, 
  Church, Shield, UserCheck, Home, Eye, EyeOff, Loader2, AlertCircle,
  CheckCircle, BookOpen, MapPin, Award
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        try {
          const res = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(res.data);
        } catch {
          localStorage.removeItem("token");
          setToken(null);
        }
      }
      setLoading(false);
    };
    verifyToken();
  }, [token]);

  const login = async (username, password) => {
    const res = await axios.post(`${API}/auth/login`, { username, password });
    localStorage.setItem("token", res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (username, password, full_name) => {
    const res = await axios.post(`${API}/auth/register`, { username, password, full_name });
    localStorage.setItem("token", res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const api = axios.create({ baseURL: API });
  api.interceptors.request.use(config => {
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading, api }}>
      {children}
    </AuthContext.Provider>
  );
};

// Components
const Input = ({ label, icon: Icon, error, ...props }) => (
  <div className="space-y-1">
    {label && <label className="text-sm font-medium text-muted-foreground">{label}</label>}
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />}
      <input
        className={`w-full bg-muted/50 border border-border rounded-lg py-2.5 ${Icon ? 'pl-10' : 'pl-4'} pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${error ? 'border-destructive' : ''}`}
        {...props}
      />
    </div>
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

const Button = ({ children, variant = "primary", loading, icon: Icon, className = "", ...props }) => {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-muted text-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
  };
  
  return (
    <button
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 ${variants[variant]} ${className}`}
      disabled={loading}
      {...props}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : Icon && <Icon className="w-5 h-5" />}
      {children}
    </button>
  );
};

const Card = ({ children, className = "", hover = false }) => (
  <div className={`bg-card border border-border rounded-xl ${hover ? 'card-hover' : ''} ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }) => {
  const variants = {
    default: "bg-muted text-muted-foreground",
    success: "badge-active",
    danger: "badge-inactive",
    info: "badge-service"
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
};

const StatCard = ({ title, value, icon: Icon, color = "primary" }) => (
  <Card className="stat-card">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <p className="text-3xl font-bold">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-xl bg-${color}/20 flex items-center justify-center`}>
        <Icon className={`w-6 h-6 text-primary`} />
      </div>
    </div>
  </Card>
);

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto animate-fade-in">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

const Toast = ({ message, type = "info", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = { success: CheckCircle, error: AlertCircle, info: AlertCircle };
  const colors = { success: "text-green-400 bg-green-500/10", error: "text-red-400 bg-red-500/10", info: "text-blue-400 bg-blue-500/10" };
  const Icon = icons[type];

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border border-border glass animate-slide-in ${colors[type]}`}>
      <Icon className="w-5 h-5" />
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70"><X className="w-4 h-4" /></button>
    </div>
  );
};

// Pages
const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password, fullName);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Помилка авторизації");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>
      
      <Card className="w-full max-w-md relative animate-fade-in">
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse-glow">
              <Church className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">УЦХВЄ</h1>
            <p className="text-muted-foreground mt-1">м. Івано-Франківськ</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Input
                label="Повне ім'я"
                icon={User}
                placeholder="Введіть ваше ім'я"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                data-testid="register-fullname-input"
              />
            )}
            
            <Input
              label="Логін"
              icon={User}
              placeholder="Введіть логін"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              data-testid="login-username-input"
            />
            
            <div className="relative">
              <Input
                label="Пароль"
                icon={Shield}
                type={showPassword ? "text" : "password"}
                placeholder="Введіть пароль"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" data-testid="login-submit-btn">
              {isLogin ? "Увійти" : "Зареєструватися"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              data-testid="toggle-auth-mode-btn"
            >
              {isLogin ? "Немає акаунту? Зареєструватися" : "Вже є акаунт? Увійти"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

const PublicPage = () => {
  const [info, setInfo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/public/info`).then(res => setInfo(res.data)).catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Church className="w-8 h-8 text-primary" />
            <span className="font-bold text-lg gradient-text">УЦХВЄ</span>
          </div>
          <Button onClick={() => navigate("/login")} icon={User} data-testid="public-login-btn">
            Увійти
          </Button>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 animate-fade-in">
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-primary/10 flex items-center justify-center animate-pulse-glow">
              <Church className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
              {info?.info?.name || "УЦХВЄ"}
            </h1>
            <p className="text-xl text-muted-foreground">
              <MapPin className="inline w-5 h-5 mr-2" />
              {info?.info?.city || "м. Івано-Франківськ"}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <Card className="p-8 text-center card-hover" hover>
              <Users className="w-12 h-12 mx-auto mb-4 text-primary" />
              <p className="text-4xl font-bold mb-2">{info?.stats?.active_members || 0}</p>
              <p className="text-muted-foreground">Активних членів</p>
            </Card>
            <Card className="p-8 text-center card-hover" hover>
              <MapPin className="w-12 h-12 mx-auto mb-4 text-primary" />
              <p className="text-4xl font-bold mb-2">{info?.stats?.districts || 0}</p>
              <p className="text-muted-foreground">Малих груп</p>
            </Card>
            <Card className="p-8 text-center card-hover" hover>
              <Heart className="w-12 h-12 mx-auto mb-4 text-primary" />
              <p className="text-4xl font-bold mb-2">30+</p>
              <p className="text-muted-foreground">Років служіння</p>
            </Card>
          </div>

          <Card className="p-8 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-4">Ласкаво просимо!</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Українська Церква Християн Віри Євангельської запрошує вас на наші богослужіння. 
              Приєднуйтесь до нашої спільноти віри, любові та служіння.
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
};

// Dashboard Layout
const DashboardLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: Home, label: "Головна", path: "/dashboard" },
    { icon: Users, label: "Члени церкви", path: "/dashboard/members" },
    { icon: BarChart3, label: "Статистика", path: "/dashboard/statistics" },
    { icon: Award, label: "Керівництво", path: "/dashboard/leadership" },
    { icon: MapPin, label: "Дільниці", path: "/dashboard/districts" },
  ];

  if (user?.role === "admin") {
    menuItems.push({ icon: Settings, label: "Користувачі", path: "/dashboard/users" });
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'}`}>
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Church className="w-5 h-5 text-primary" />
            </div>
            {sidebarOpen && <span className="font-bold gradient-text">УЦХВЄ</span>}
          </div>
        </div>
        
        <nav className="p-4 space-y-2">
          {menuItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`sidebar-item w-full ${location.pathname === item.path ? 'active' : ''}`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <button onClick={logout} className="sidebar-item w-full text-destructive" data-testid="logout-btn">
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Вийти</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-muted rounded-lg lg:hidden">
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="text-sm">
                <p className="font-medium">{user?.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

// Dashboard Home
const DashboardHome = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { api } = useAuth();

  useEffect(() => {
    api.get("/statistics").then(res => {
      setStats(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [api]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="dashboard-home">
      <h1 className="text-2xl font-bold">Панель керування</h1>
      
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Активних членів" value={stats?.active_members || 0} icon={Users} />
        <StatCard title="Чоловіків" value={stats?.male_count || 0} icon={User} />
        <StatCard title="Жінок" value={stats?.female_count || 0} icon={User} />
        <StatCard title="Хрещених" value={stats?.baptized_count || 0} icon={Heart} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Вікові групи</h2>
          <div className="space-y-3">
            {stats?.age_groups && Object.entries(stats.age_groups).map(([group, count]) => (
              <div key={group} className="flex items-center justify-between">
                <span className="text-muted-foreground">{group} років</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{ width: `${(count / stats.active_members) * 100}%` }}
                    />
                  </div>
                  <span className="font-medium w-10 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Топ служінь</h2>
          <div className="space-y-3">
            {stats?.service_stats?.slice(0, 8).map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-muted-foreground">{s.name}</span>
                <Badge variant="info">{s.count}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// Members Page
const MembersPage = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeOnly, setActiveOnly] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState(null);
  const { api, user } = useAuth();

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/members", {
        params: { page, limit: 30, search, active_only: activeOnly }
      });
      setMembers(res.data.members);
      setTotalPages(res.data.pages);
    } catch (err) {
      setToast({ message: "Помилка завантаження", type: "error" });
    }
    setLoading(false);
  }, [api, page, search, activeOnly]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const canEdit = ["admin", "presbyter", "deacon"].includes(user?.role);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="members-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Члени церкви</h1>
        {canEdit && (
          <Button icon={Plus} onClick={() => setShowAddModal(true)} data-testid="add-member-btn">
            Додати члена
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Пошук за ПІБ..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-muted/50 border border-border rounded-lg py-2.5 pl-10 pr-4"
              data-testid="members-search-input"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={e => { setActiveOnly(e.target.checked); setPage(1); }}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm">Тільки активні</span>
          </label>
        </div>
      </Card>

      {/* Members Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ПІБ</th>
                  <th>Телефон</th>
                  <th>Служіння</th>
                  <th>Статус</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.original_id} className="cursor-pointer" onClick={() => setSelectedMember(m)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.gender === 'male' ? 'bg-blue-500/10' : 'bg-pink-500/10'}`}>
                          <User className={`w-5 h-5 ${m.gender === 'male' ? 'text-blue-400' : 'text-pink-400'}`} />
                        </div>
                        <div>
                          <p className="font-medium">{m.pib}</p>
                          <p className="text-xs text-muted-foreground">{m.gender_ukr}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm">{m.phone_mobile || m.phone_home || "—"}</span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {m.services?.filter(s => s.is_active).slice(0, 2).map((s, i) => (
                          <Badge key={i} variant="info">{s.name}</Badge>
                        ))}
                        {m.services?.filter(s => s.is_active).length > 2 && (
                          <Badge>+{m.services.filter(s => s.is_active).length - 2}</Badge>
                        )}
                      </div>
                    </td>
                    <td>
                      <Badge variant={m.is_active ? "success" : "danger"}>
                        {m.is_active ? "Активний" : "Вибув"}
                      </Badge>
                    </td>
                    <td>
                      <button className="p-2 hover:bg-muted rounded-lg" onClick={e => { e.stopPropagation(); setSelectedMember(m); }}>
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <span className="text-sm text-muted-foreground">Сторінка {page} з {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)} icon={ChevronLeft}>
              Назад
            </Button>
            <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Далі <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Member Details Modal */}
      <Modal open={!!selectedMember} onClose={() => setSelectedMember(null)} title="Деталі члена">
        {selectedMember && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${selectedMember.gender === 'male' ? 'bg-blue-500/10' : 'bg-pink-500/10'}`}>
                <User className={`w-8 h-8 ${selectedMember.gender === 'male' ? 'text-blue-400' : 'text-pink-400'}`} />
              </div>
              <div>
                <h3 className="text-xl font-bold">{selectedMember.pib}</h3>
                <p className="text-muted-foreground">{selectedMember.gender_ukr}</p>
              </div>
            </div>

            <div className="grid gap-4">
              {selectedMember.phone_mobile && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <span>{selectedMember.phone_mobile}</span>
                </div>
              )}
              {selectedMember.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <span>{selectedMember.email}</span>
                </div>
              )}
              {selectedMember.birth_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <span>Народження: {new Date(selectedMember.birth_date).toLocaleDateString('uk-UA')}</span>
                </div>
              )}
              {selectedMember.baptism_date && (
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-muted-foreground" />
                  <span>Хрещення: {new Date(selectedMember.baptism_date).toLocaleDateString('uk-UA')}</span>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold mb-2">Інформація</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Сімейний стан:</span>
                <span>{selectedMember.marital_status || "—"}</span>
                <span className="text-muted-foreground">Соціальний стан:</span>
                <span>{selectedMember.social_status || "—"}</span>
                <span className="text-muted-foreground">Освіта:</span>
                <span>{selectedMember.education || "—"}</span>
                <span className="text-muted-foreground">Професія:</span>
                <span>{selectedMember.profession || "—"}</span>
              </div>
            </div>

            {selectedMember.services?.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Служіння</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedMember.services.map((s, i) => (
                    <Badge key={i} variant={s.is_active ? "info" : "default"}>
                      {s.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {selectedMember.notes && (
              <div>
                <h4 className="font-semibold mb-2">Примітки</h4>
                <p className="text-sm text-muted-foreground">{selectedMember.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add Member Modal */}
      <AddMemberModal 
        open={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        onSuccess={() => { setShowAddModal(false); fetchMembers(); setToast({ message: "Члена додано", type: "success" }); }}
      />

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
};

const AddMemberModal = ({ open, onClose, onSuccess }) => {
  const [form, setForm] = useState({ pib: "", gender: "male", phone_mobile: "" });
  const [loading, setLoading] = useState(false);
  const { api } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/members", form);
      onSuccess();
      setForm({ pib: "", gender: "male", phone_mobile: "" });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Додати нового члена">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="ПІБ"
          placeholder="Прізвище Ім'я По-батькові"
          value={form.pib}
          onChange={e => setForm({ ...form, pib: e.target.value })}
          required
          data-testid="add-member-pib-input"
        />
        
        <div>
          <label className="text-sm font-medium text-muted-foreground">Стать</label>
          <div className="flex gap-4 mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="gender" value="male" checked={form.gender === "male"} onChange={e => setForm({ ...form, gender: e.target.value })} />
              <span>Брат</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="gender" value="female" checked={form.gender === "female"} onChange={e => setForm({ ...form, gender: e.target.value })} />
              <span>Сестра</span>
            </label>
          </div>
        </div>

        <Input
          label="Мобільний телефон"
          placeholder="067 1234567"
          value={form.phone_mobile}
          onChange={e => setForm({ ...form, phone_mobile: e.target.value })}
          data-testid="add-member-phone-input"
        />

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Скасувати
          </Button>
          <Button type="submit" loading={loading} className="flex-1" data-testid="add-member-submit-btn">
            Додати
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Statistics Page
const StatisticsPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { api } = useAuth();

  useEffect(() => {
    api.get("/statistics").then(res => {
      setStats(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [api]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="statistics-page">
      <h1 className="text-2xl font-bold">Статистика</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Всього членів" value={stats?.total_members || 0} icon={Users} />
        <StatCard title="Активних" value={stats?.active_members || 0} icon={UserCheck} />
        <StatCard title="Вибулих" value={stats?.inactive_members || 0} icon={User} />
        <StatCard title="Хрещених" value={stats?.baptized_count || 0} icon={Heart} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Розподіл за статтю</h2>
          <div className="flex items-center justify-center gap-8 py-8">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center mb-2">
                <span className="text-3xl font-bold text-blue-400">{stats?.male_count || 0}</span>
              </div>
              <p className="text-muted-foreground">Чоловіків</p>
            </div>
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-pink-500/20 flex items-center justify-center mb-2">
                <span className="text-3xl font-bold text-pink-400">{stats?.female_count || 0}</span>
              </div>
              <p className="text-muted-foreground">Жінок</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Вікові групи</h2>
          <div className="space-y-4">
            {stats?.age_groups && Object.entries(stats.age_groups).map(([group, count]) => {
              const percentage = stats.active_members > 0 ? (count / stats.active_members) * 100 : 0;
              return (
                <div key={group}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{group} років</span>
                    <span className="font-medium">{count} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Сімейний стан</h2>
          <div className="space-y-3">
            {stats?.marital_stats && Object.entries(stats.marital_stats).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-muted-foreground">{status}</span>
                <Badge>{count}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Соціальний стан</h2>
          <div className="space-y-3">
            {stats?.social_stats && Object.entries(stats.social_stats).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-muted-foreground">{status}</span>
                <Badge>{count}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Служіння</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats?.service_stats?.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <span>{s.name}</span>
              <Badge variant="info">{s.count}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// Leadership Page
const LeadershipPage = () => {
  const [leadership, setLeadership] = useState(null);
  const [loading, setLoading] = useState(true);
  const { api } = useAuth();

  useEffect(() => {
    api.get("/leadership").then(res => {
      setLeadership(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [api]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="leadership-page">
      <h1 className="text-2xl font-bold">Керівництво церкви</h1>

      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          Пресвітери
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leadership?.presbyters?.map(p => (
            <Card key={p.id} className="p-4" hover>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{p.member?.pib}</p>
                  <p className="text-sm text-muted-foreground">{p.member?.phone_mobile}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary" />
          Диякони
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leadership?.deacons?.map(d => (
            <Card key={d.id} className="p-4" hover>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                  <User className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{d.member?.pib}</p>
                  <p className="text-sm text-muted-foreground">{d.member?.phone_mobile}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

// Districts Page
const DistrictsPage = () => {
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { api } = useAuth();

  useEffect(() => {
    api.get("/districts").then(res => {
      setDistricts(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [api]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  // Group by area
  const grouped = districts.reduce((acc, d) => {
    const area = d.area || "Інше";
    if (!acc[area]) acc[area] = [];
    acc[area].push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in" data-testid="districts-page">
      <h1 className="text-2xl font-bold">Дільниці (малі групи)</h1>

      {Object.entries(grouped).map(([area, areaDistricts]) => (
        <div key={area}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            {area}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {areaDistricts.map(d => (
              <Card key={d.original_id} className="p-4" hover>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="info">Дільниця №{d.number}</Badge>
                </div>
                <p className="font-medium mb-1">Лідер: {d.leader_name || "—"}</p>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Users Management Page
const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const { api, user: currentUser } = useAuth();

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (err) {
      setToast({ message: "Помилка завантаження", type: "error" });
    }
    setLoading(false);
  }, [api]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateRole = async (userId, role) => {
    try {
      await api.put(`/users/${userId}/role?role=${role}`);
      setToast({ message: "Роль оновлено", type: "success" });
      fetchUsers();
    } catch (err) {
      setToast({ message: "Помилка оновлення", type: "error" });
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Видалити користувача?")) return;
    try {
      await api.delete(`/users/${userId}`);
      setToast({ message: "Користувача видалено", type: "success" });
      fetchUsers();
    } catch (err) {
      setToast({ message: err.response?.data?.detail || "Помилка видалення", type: "error" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const roles = [
    { value: "admin", label: "Адміністратор" },
    { value: "presbyter", label: "Пресвітер" },
    { value: "deacon", label: "Диякон" },
    { value: "user", label: "Користувач" }
  ];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="users-page">
      <h1 className="text-2xl font-bold">Управління користувачами</h1>

      <Card className="overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Користувач</th>
              <th>Логін</th>
              <th>Роль</th>
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-medium">{u.full_name}</span>
                  </div>
                </td>
                <td>{u.username}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={e => updateRole(u.id, e.target.value)}
                    disabled={u.id === currentUser?.id}
                    className="bg-muted border border-border rounded-lg px-3 py-1.5 text-sm"
                  >
                    {roles.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    onClick={() => deleteUser(u.id)}
                    disabled={u.id === currentUser?.id}
                    className="p-2 hover:bg-destructive/10 rounded-lg text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Main App
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout>
                <DashboardHome />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/members" element={
            <ProtectedRoute>
              <DashboardLayout>
                <MembersPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/statistics" element={
            <ProtectedRoute>
              <DashboardLayout>
                <StatisticsPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/leadership" element={
            <ProtectedRoute>
              <DashboardLayout>
                <LeadershipPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/districts" element={
            <ProtectedRoute>
              <DashboardLayout>
                <DistrictsPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/users" element={
            <ProtectedRoute>
              <DashboardLayout>
                <UsersPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

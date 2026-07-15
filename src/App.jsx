import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Plus, Trash2, Save, LogOut, CheckCircle, Eraser, Settings } from 'lucide-react';
import './App.css'; 

const WEEKDAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const SITES = [
  "Civic Centre",
  "Public Works",
  "Leisure Center",
  "Parks Office",
  "Griffith's Park Centre"
];

// Database Service (Simulated API Layer)
// This abstracts the data layer so it can be easily swapped for an Entra/LDAP API later.
const DBService = {
  getUsers: async () => {
    try {
      const res = await fetch('/api/users');
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },
  saveUsers: async (users) => {
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(users)
      });
    } catch(e) { console.error(e); }
  },
  authenticate: async (id, enteredId) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enteredId })
      });
      const data = await res.json();
      return data.user;
    } catch(e) {
      console.error(e);
      return null;
    }
  },
  getStore: async (key) => {
    try {
      const res = await fetch(`/api/store/${key}`);
      const data = await res.json();
      if (data.data) {
        try { return JSON.parse(data.data); } catch(e) { return data.data; }
      }
      return null;
    } catch(e) { return null; }
  },
  setStore: async (key, value) => {
    try {
      await fetch(`/api/store/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: value })
      });
    } catch(e) { console.error(e); }
  },
  removeStore: async (key) => {
    try {
      await fetch(`/api/store/${key}`, { method: 'DELETE' });
    } catch(e) { console.error(e); }
  },
  getAllStoreKeys: async (prefix) => {
    try {
      const res = await fetch(`/api/store/keys/${prefix}`);
      return await res.json();
    } catch(e) { return []; }
  }
};

function App() {
  const [kioskSite, setKioskSite] = useState(() => localStorage.getItem('kioskSite'));
  const [loggedInEmployee, setLoggedInEmployee] = useState(null);
  
  const [timeLeft, setTimeLeft] = useState('');
  const [isPastDeadline, setIsPastDeadline] = useState(false);

  useEffect(() => {
    const DEADLINE_DATE = new Date(2026, 6, 17, 12, 0, 0); // July 17, 2026 12:00 PM
    
    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = DEADLINE_DATE - now;

      if (difference <= 0) {
        setIsPastDeadline(true);
        setTimeLeft('DEADLINE PASSED');
        return;
      }

      const d = Math.floor(difference / (1000 * 60 * 60 * 24));
      const h = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const m = Math.floor((difference / 1000 / 60) % 60);
      const s = Math.floor((difference / 1000) % 60);

      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSiteSelect = (site) => {
    localStorage.setItem('kioskSite', site);
    setKioskSite(site);
  };

  const handleLogout = () => {
    setLoggedInEmployee(null);
  };

  const clearSite = () => {
    localStorage.removeItem('kioskSite');
    setKioskSite(null);
    setLoggedInEmployee(null);
  }

  return (
    <div className="kiosk-container">
      <header className="kiosk-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {kioskSite && <h2 style={{ color: 'var(--text-muted)', fontSize: '20px' }}>{kioskSite} Kiosk</h2>}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ 
            background: isPastDeadline ? 'var(--danger-color)' : 'rgba(255,255,255,0.1)', 
            padding: '8px 16px', 
            borderRadius: '20px', 
            fontSize: '14px', 
            fontWeight: 'bold',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
             <span style={{ opacity: 0.8 }}>Due: Friday 12:00 PM</span>
             <span style={{ background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '4px' }}>
               {timeLeft}
             </span>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {kioskSite && !loggedInEmployee && (
              <button className="btn btn-outline" onClick={clearSite} style={{ color: 'var(--text-muted)', borderColor: 'transparent' }}>
                <Settings size={18} /> Setup
              </button>
            )}
            {loggedInEmployee && (
              <button className="btn btn-outline" onClick={handleLogout} style={{ color: 'white', borderColor: 'white' }}>
                <LogOut size={18} /> Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="kiosk-content">
        {!kioskSite ? (
          <AdminSetupScreen onSelectSite={handleSiteSelect} />
        ) : !loggedInEmployee ? (
          <LoginScreen 
            site={kioskSite} 
            onLogin={(emp) => setLoggedInEmployee(emp)} 
          />
        ) : (
          <TimesheetApp employee={loggedInEmployee} onSubmitSuccess={handleLogout} isPastDeadline={isPastDeadline} />
        )}
      </main>
    </div>
  );
}

function UserManagementScreen({ onExit }) {
  const [users, setUsers] = useState([]);
  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserSite, setNewUserSite] = useState(SITES[0]);

  useEffect(() => {
    DBService.getUsers().then(setUsers);
  }, []);

  const handleAddUser = (e) => {
    e.preventDefault();
    if (users.find(u => u.id === newUserId)) {
      alert("Employee ID already exists!");
      return;
    }
    const newUser = { id: newUserId, name: newUserName, site: newUserSite };
    const updated = [...users, newUser];
    setUsers(updated);
    DBService.saveUsers(updated);
    setNewUserId(''); setNewUserName('');
  };

  const handleDeleteUser = (id) => {
    if(window.confirm("Are you sure you want to delete this employee?")) {
      const updated = users.filter(u => u.id !== id);
      setUsers(updated);
      DBService.saveUsers(updated);
    }
  };

  return (
    <div className="timesheet-view">
      <div className="timesheet-header-bar">
        <div className="user-info">
          <span><strong>System Admin</strong></span>
        </div>
        <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '14px' }} onClick={onExit}>
            Exit Admin
        </button>
      </div>

      <div style={{ maxWidth: '1000px', margin: '40px auto', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
        <div className="card" style={{ padding: '32px' }}>
           <h2 style={{ marginBottom: '24px' }}>Employee Database</h2>
           <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
             <thead>
               <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                 <th style={{ padding: '12px 8px' }}>ID</th>
                 <th style={{ padding: '12px 8px' }}>Name</th>
                 <th style={{ padding: '12px 8px' }}>Site</th>
                 <th style={{ padding: '12px 8px' }}>Actions</th>
               </tr>
             </thead>
             <tbody>
               {users.map(u => (
                 <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                   <td style={{ padding: '12px 8px' }}>{u.id}</td>
                   <td style={{ padding: '12px 8px' }}>{u.name}</td>
                   <td style={{ padding: '12px 8px' }}>{u.site}</td>
                   <td style={{ padding: '12px 8px' }}>
                     <button className="remove-row-btn" onClick={() => handleDeleteUser(u.id)}>
                       <Trash2 size={16} />
                     </button>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>

        <div className="card" style={{ padding: '32px', height: 'fit-content' }}>
          <h2 style={{ marginBottom: '24px' }}>Add Employee</h2>
          <form className="login-form" onSubmit={handleAddUser}>
            <input type="text" placeholder="Employee Name" value={newUserName} onChange={e => setNewUserName(e.target.value)} required />
            <input type="text" placeholder="Employee ID" value={newUserId} onChange={e => setNewUserId(e.target.value)} required />
            <select value={newUserSite} onChange={e => setNewUserSite(e.target.value)}>
              {SITES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="submit" className="btn btn-large" style={{ marginTop: '16px' }}>Add Employee</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function AdminSetupScreen({ onSelectSite }) {
  const [selected, setSelected] = useState(SITES[0]);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const handleAdminAuth = (e) => {
    e.preventDefault();
    if (adminPin === '9999') {
      setIsAdminAuthenticated(true);
      setShowAdminLogin(false);
      setAdminPin('');
    } else {
      alert('Incorrect Admin PIN');
    }
  };

  if (isAdminAuthenticated) {
    return <UserManagementScreen onExit={() => setIsAdminAuthenticated(false)} />;
  }

  if (showAdminLogin) {
    return (
      <div className="login-screen">
        <div className="card login-card">
          <h2>Admin Access</h2>
          <p>Enter master PIN to manage employees (Try: 9999)</p>
          <form className="login-form" onSubmit={handleAdminAuth}>
            <input type="password" placeholder="Admin PIN" value={adminPin} onChange={e => setAdminPin(e.target.value)} required autoFocus />
            <button type="submit" className="btn btn-large">Login</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowAdminLogin(false)}>Cancel</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="card login-card" style={{ paddingBottom: '20px' }}>
        <h2>Kiosk Setup</h2>
        <p>Please select the location for this iPad.</p>
        <div className="login-form">
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {SITES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-large" onClick={() => onSelectSite(selected)}>
            Lock Kiosk to Site
          </button>
        </div>
      </div>
      <button className="btn btn-outline" style={{ marginTop: '24px', color: 'var(--text-muted)', borderColor: 'transparent' }} onClick={() => setShowAdminLogin(true)}>
        <Settings size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Manage Employees
      </button>
    </div>
  );
}

function LoginScreen({ site, onLogin }) {
  const [selectedName, setSelectedName] = useState(null);
  const [enteredId, setEnteredId] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    DBService.getUsers().then(setUsers);
  }, []);

  const employeesAtSite = users.filter(e => e.site === site);

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setError('');
    
    const user = await DBService.authenticate(selectedName.id, enteredId);
    
    setIsAuthenticating(false);
    if (user) {
      onLogin(user);
    } else {
      setError('Incorrect Employee ID.');
    }
  };

  if (selectedName) {
    return (
      <div className="login-screen">
        <div className="card login-card">
          <h2>Welcome, {selectedName.name}</h2>
          <p>Please enter your Employee ID to access your timesheet.</p>
          <form className="login-form" onSubmit={handlePinSubmit}>
            <input 
              type="password" 
              placeholder="Enter Employee ID" 
              value={enteredId}
              onChange={(e) => setEnteredId(e.target.value)}
              required
              autoFocus
              disabled={isAuthenticating}
            />
            {error && <p style={{ color: 'var(--danger-color)', margin: 0 }}>{error}</p>}
            <button type="submit" className="btn btn-large" disabled={isAuthenticating}>
              {isAuthenticating ? 'Verifying...' : 'Login'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => { setSelectedName(null); setEnteredId(''); setError(''); }} disabled={isAuthenticating}>
              Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen" style={{ alignItems: 'flex-start', paddingTop: '40px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '800px', textAlign: 'center' }}>
        <h2>Select Your Name</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Tap your name below to sign in.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {employeesAtSite.map(emp => (
            <button 
              key={emp.id} 
              className="btn btn-outline" 
              style={{ padding: '24px 16px', fontSize: '18px', display: 'block', width: '100%' }}
              onClick={() => setSelectedName(emp)}
            >
              {emp.name}
            </button>
          ))}
          {employeesAtSite.length === 0 && (
            <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1' }}>No employees assigned to this site.</p>
          )}
        </div>
      </div>
    </div>
  );
}

async function seedHistoricalData(employeeId) {
  const dates = [
    { key: `timesheet_${employeeId}_June27_2026_v2`, start: new Date(2026, 5, 27) },
    { key: `timesheet_${employeeId}_July4_2026_v2`, start: new Date(2026, 6, 4) }
  ];
  for (const d of dates) {
    const statusKey = d.key.replace('_v2', '_Status_v2');
    const existingStatus = await DBService.getStore(statusKey);
    if (!existingStatus) {
      const entries = [];
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(d.start);
        currentDate.setDate(d.start.getDate() + i);
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
        const dateString = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const isWeekend = (currentDate.getDay() === 0 || currentDate.getDay() === 6);
        entries.push({
          id: `day-${i}`,
          dayName: `${dayName}, ${dateString}`,
          rows: [{ id: `row-1`, workDescription: isWeekend ? '' : 'Standard Duties', hours: isWeekend ? 0 : 8, code: 'Regular' }]
        });
      }
      await DBService.setStore(d.key, entries);
      await DBService.setStore(statusKey, 'submitted');
    }
  }
}

function TimesheetApp({ employee, onSubmitSuccess, isPastDeadline }) {
  const currentWeekKey = `timesheet_${employee.id}_July11_2026_v2`;
  const submitStatusKey = `timesheet_${employee.id}_July11_2026_Status_v2`;

  const [viewMode, setViewMode] = useState('current');
  const [selectedHistory, setSelectedHistory] = useState(null);

  const [entries, setEntries] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const sigCanvas = useRef({});
  const [savedSignature, setSavedSignature] = useState(null);
  const [historyList, setHistoryList] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      await seedHistoricalData(employee.id);
      
      let loadedEntries = await DBService.getStore(currentWeekKey);
      if (!loadedEntries) {
        loadedEntries = initializeEntries();
      } else {
        const startDate = new Date(2026, 6, 11);
        loadedEntries.forEach((day, i) => {
          if (!day.dayName.includes(',')) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dayStr = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
            const dateString = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            day.dayName = `${dayStr}, ${dateString}`;
          }
        });
      }
      
      const status = await DBService.getStore(submitStatusKey);
      const sig = await DBService.getStore(`signature_${employee.id}`);
      
      if (isMounted) {
         setEntries(loadedEntries);
         setSubmitted(status === 'submitted');
         setSavedSignature(sig);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [employee.id, currentWeekKey, submitStatusKey]);

  useEffect(() => {
    if (entries) {
      DBService.setStore(currentWeekKey, entries);
    }
  }, [entries, currentWeekKey]);

  useEffect(() => {
    if (entries && isPastDeadline && !submitted) {
      console.log("Deadline passed! Auto-submitting...");
      const payload = {
        employeeId: employee.id,
        employeeName: employee.name,
        site: employee.site,
        entries,
        signature: savedSignature || null,
        autoSubmitted: true
      };
      console.log("Auto-Submitting to Laserfiche:", payload);
      DBService.setStore(submitStatusKey, 'submitted');
      setSubmitted(true);
      setIsVerifying(false);
      setViewMode('current');
    }
  }, [isPastDeadline, submitted, employee, entries, savedSignature, submitStatusKey]);

  if (!entries) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading timesheet...</div>;
  }

  function initializeEntries() {
    const days = 7;
    const initial = [];
    const startDate = new Date(2026, 6, 11); // July 11, 2026
    
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      const dateString = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      initial.push({
        id: `day-${i}`,
        dayName: `${dayName}, ${dateString}`,
        rows: [
          { id: `row-${Date.now()}-${Math.random()}`, workDescription: '', hours: 0, code: 'Regular' }
        ]
      });
    }
    return initial;
  }

  const addRow = (dayIndex) => {
    const newEntries = [...entries];
    newEntries[dayIndex].rows.push({
      id: `row-${Date.now()}-${Math.random()}`,
      workDescription: '',
      hours: 0,
      code: 'Regular'
    });
    setEntries(newEntries);
  };

  const removeRow = (dayIndex, rowIndex) => {
    const newEntries = [...entries];
    newEntries[dayIndex].rows.splice(rowIndex, 1);
    setEntries(newEntries);
  };

  const updateRow = (dayIndex, rowIndex, field, value) => {
    const newEntries = [...entries];
    if (field === 'hours') {
      if (value !== '' && parseFloat(value) > 24) {
        value = '24';
      }
    }
    newEntries[dayIndex].rows[rowIndex][field] = value;
    setEntries(newEntries);
  };

  const clearSignature = () => {
    sigCanvas.current.clear();
  };

  const handleInitialSubmit = () => {
    try {
      const grandTotal = entries.reduce((acc, day) => 
        acc + day.rows.reduce((sum, r) => sum + parseFloat(r.hours || 0), 0)
      , 0);

      if (grandTotal > 168) {
        alert("Validation Error: Total weekly hours cannot exceed 168 hours.");
        return;
      }

      for (let day of entries) {
        const dailyTotal = day.rows.reduce((sum, r) => sum + parseFloat(r.hours || 0), 0);
        if (dailyTotal > 24) {
          alert(`Validation Error: Total hours for ${day.dayName.split(',')[0]} cannot exceed 24 hours.`);
          return;
        }
      }

      let finalSignature = savedSignature;
      if (!finalSignature) {
        if (!sigCanvas.current || typeof sigCanvas.current.isEmpty !== 'function') {
           alert("Signature pad is not ready.");
           return;
        }
        if (sigCanvas.current.isEmpty()) {
          alert("Please sign the timesheet before submitting.");
          return;
        }
        finalSignature = sigCanvas.current.getCanvas().toDataURL('image/png');
        DBService.setStore(`signature_${employee.id}`, finalSignature);
        setSavedSignature(finalSignature);
      }
      setIsVerifying(true);
    } catch (err) {
      console.error(err);
      alert("An error occurred: " + err.message);
    }
  };

  const handleFinalSubmit = () => {
    try {
      const payload = {
        employeeId: employee.id,
        employeeName: employee.name,
        site: employee.site,
        entries,
        signature: savedSignature
      };
      console.log("Submitting to Laserfiche:", payload);
      DBService.setStore(submitStatusKey, 'submitted');
      setSubmitted(true);
      setIsVerifying(false);
    } catch (err) {
      console.error(err);
      alert("An error occurred while submitting: " + err.message);
    }
  };

  const totalRegular = entries.reduce((acc, day) => 
    acc + day.rows.filter(r => r.code === 'Regular').reduce((sum, r) => sum + parseFloat(r.hours || 0), 0)
  , 0);

  const totalOvertime = entries.reduce((acc, day) => 
    acc + day.rows.filter(r => r.code === 'OT 1.5' || r.code === 'OT 2.0').reduce((sum, r) => sum + parseFloat(r.hours || 0), 0)
  , 0);

  const totalLeave = entries.reduce((acc, day) => 
    acc + day.rows.filter(r => ['Sick', 'Vacation', 'Bank Time'].includes(r.code)).reduce((sum, r) => sum + parseFloat(r.hours || 0), 0)
  , 0);



  const renderMatrixTable = (entriesToRender) => {
    const hourCodes = ['Regular', 'OT 1.5', 'OT 2.0', 'Bank Time', 'Sick', 'Vacation'];
    const tableData = hourCodes.map(code => {
      const days = entriesToRender.map(day => {
        return day.rows.filter(r => r.code === code).reduce((sum, r) => sum + parseFloat(r.hours || 0), 0);
      });
      const total = days.reduce((sum, val) => sum + val, 0);
      return { code, days, total };
    }).filter(row => row.total > 0 || row.code === 'Regular');

    const grandTotal = entriesToRender.reduce((acc, day) => 
      acc + day.rows.reduce((sum, r) => sum + parseFloat(r.hours || 0), 0)
    , 0);

    return (
      <div style={{ background: 'var(--bg-color)', borderRadius: '6px', marginBottom: '32px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: 'var(--primary-color)', color: 'white' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left' }}>Type</th>
              {entriesToRender.map(day => (
                <th key={day.id} style={{ padding: '12px 4px' }}>
                  {day.dayName.split(',')[0].substring(0, 3)}
                </th>
              ))}
              <th style={{ padding: '12px 8px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map(row => (
              <tr key={row.code} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '500' }}>{row.code}</td>
                {row.days.map((val, idx) => (
                  <td key={idx} style={{ padding: '12px 4px', color: val > 0 ? 'inherit' : 'var(--border-color)' }}>
                    {val > 0 ? val.toFixed(2) : '-'}
                  </td>
                ))}
                <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>
                  {row.total > 0 ? row.total.toFixed(2) : '-'}
                </td>
              </tr>
            ))}
            <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
              <td style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Daily Totals</td>
              {entriesToRender.map((day, dIdx) => {
                 const dailyTotal = tableData.reduce((sum, r) => sum + r.days[dIdx], 0);
                 return (
                   <td key={dIdx} style={{ padding: '12px 4px', fontWeight: 'bold' }}>
                     {dailyTotal > 0 ? dailyTotal.toFixed(2) : '-'}
                   </td>
                 );
              })}
              <td style={{ padding: '12px 8px', fontWeight: 'bold', background: 'var(--secondary-color)', color: 'white' }}>
                {grandTotal.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  if (submitted && viewMode === 'current') {
    return (
      <div className="timesheet-view">
         <div className="timesheet-header-bar">
           <div className="user-info">
             <span><strong>{employee.name}</strong> <span style={{color: 'var(--text-muted)'}}>({employee.id})</span></span>
           </div>
           <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
             <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '14px' }} onClick={() => setViewMode('historyList')}>
                 View History
             </button>
             <div style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>Pay Period: July 11, 2026 - July 17, 2026</div>
           </div>
         </div>
         <div className="card login-card" style={{ padding: '40px', maxWidth: '800px', margin: '40px auto' }}>
          <CheckCircle color="var(--secondary-color)" size={48} style={{ marginBottom: '16px' }} />
          <h2 style={{ color: 'var(--text-main)' }}>{isPastDeadline ? "Timesheet Locked" : "Timesheet Submitted"}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
             {isPastDeadline 
               ? "The weekly deadline has passed and your timesheet was automatically submitted and locked. If you need to make corrections, please contact your supervisor." 
               : "Your timesheet has been submitted. You may continue to make modifications until the Friday deadline."}
          </p>
          <div style={{ marginBottom: '32px' }}>
            {renderMatrixTable(entries)}
          </div>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            {!isPastDeadline && (
               <button className="btn btn-outline" onClick={() => {
                 setSubmitted(false);
                 DBService.removeStore(submitStatusKey);
               }}>
                 Unlock & Edit
               </button>
            )}
            <button className="btn btn-large" style={{ flex: 1 }} onClick={onSubmitSuccess}>
              Done (Log Out)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'historyList') {
    // We need to fetch history if not already loaded, but for simplicity we can load on demand
    // Actually since this is a render block, we can't fetch async directly here.
    // Let's use a small useEffect hook to fetch history when viewMode changes.
    // Wait, let's just render a loading state if historyList is empty, and trigger fetch.
    if (historyList.length === 0) {
      DBService.getAllStoreKeys(`timesheet_${employee.id}_`).then(async (keys) => {
        const hList = [];
        for (let row of keys) {
           const key = row.key;
           if (key.endsWith('_Status_v2') && row.data === '"submitted"' && key !== submitStatusKey) {
             const dataKey = key.replace('_Status_v2', '_v2');
             const dataRow = keys.find(k => k.key === dataKey);
             if (dataRow && dataRow.data) {
                try {
                  const parsed = JSON.parse(JSON.parse(dataRow.data));
                  const firstDay = parsed[0].dayName.split(',')[1].trim(); 
                  const lastDay = parsed[6].dayName.split(',')[1].trim(); 
                  const totalHours = parsed.reduce((acc, day) => acc + day.rows.reduce((sum, r) => sum + parseFloat(r.hours || 0), 0), 0);
                  hList.push({ dataKey, label: `${firstDay} - ${lastDay}, 2026`, entries: parsed, totalHours });
                } catch(e) {}
             }
           }
        }
        hList.reverse();
        setHistoryList(hList);
      });
      return <div style={{ padding: '40px', textAlign: 'center' }}>Loading history...</div>;
    }

    return (
      <div className="timesheet-view">
        <div className="timesheet-header-bar">
          <div className="user-info">
            <span><strong>{employee.name}</strong> <span style={{color: 'var(--text-muted)'}}>({employee.id})</span></span>
          </div>
          <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '14px' }} onClick={() => setViewMode('current')}>
              Back to Current Timesheet
          </button>
        </div>
        <div className="card" style={{ maxWidth: '800px', margin: '40px auto', padding: '40px' }}>
          <h2 style={{ marginBottom: '24px', color: 'var(--text-main)' }}>Past Timesheets</h2>
          {historyList.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No past timesheets found.</p>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {historyList.map(item => (
                <div key={item.dataKey} className="card" style={{ padding: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-color)', border: '1px solid var(--border-color)' }} onClick={() => { setSelectedHistory(item); setViewMode('historyDetail'); }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0' }}>{item.label}</h3>
                    <span style={{ fontSize: '14px', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14} /> Submitted & Locked</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{item.totalHours.toFixed(2)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Hours</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'historyDetail' && selectedHistory) {
    return (
      <div className="timesheet-view">
        <div className="timesheet-header-bar">
          <div className="user-info">
            <span><strong>{employee.name}</strong> <span style={{color: 'var(--text-muted)'}}>({employee.id})</span></span>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '14px' }} onClick={() => setViewMode('historyList')}>
                Back to List
            </button>
            <div style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>Pay Period: {selectedHistory.label}</div>
          </div>
        </div>
        <div className="card" style={{ maxWidth: '800px', margin: '40px auto', padding: '40px', overflowX: 'auto' }}>
          <h2 style={{ marginBottom: '24px', color: 'var(--text-main)' }}>Submitted Timesheet</h2>
          {renderMatrixTable(selectedHistory.entries)}
        </div>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="timesheet-view">
         <div className="card" style={{ maxWidth: '800px', margin: '40px auto', padding: '40px', overflowX: 'auto' }}>
            <h2 style={{ marginBottom: '24px', color: 'var(--text-main)' }}>Verify Your Submission</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Please review your totals below. Once submitted, your timesheet will be locked and cannot be modified.</p>
            
            {renderMatrixTable(entries)}
            
            <div style={{ background: 'rgba(73, 110, 137, 0.1)', padding: '16px', borderRadius: '6px', borderLeft: '4px solid var(--primary-color)', marginBottom: '32px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontStyle: 'italic', color: 'var(--text-main)' }}>
                "I certify that the hours recorded above are a true and accurate record of all time worked during this pay period."
              </p>
            </div>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setIsVerifying(false)}>
                Go Back & Edit
              </button>
              <button className="btn" onClick={handleFinalSubmit}>
                Confirm & Submit
              </button>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="timesheet-view">
      <div className="timesheet-header-bar">
        <div className="user-info">
          <span><strong>{employee.name}</strong> <span style={{color: 'var(--text-muted)'}}>({employee.id})</span></span>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '14px' }} onClick={() => setViewMode('historyList')}>
              View History
          </button>
          <div style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>
            Pay Period: July 11, 2026 - July 17, 2026
          </div>
        </div>
      </div>

      <div className="timesheet-body">
        {entries.map((day, dIdx) => (
          <div key={day.id} className="day-card">
            <div className="day-header">
              <h3>{day.dayName}</h3>
            </div>
            
            <div className="entry-grid">
              {day.rows.map((row, rIdx) => (
                <div key={row.id} className="entry-row">
                  <input 
                    type="text" 
                    placeholder="Work Description / Project" 
                    value={row.workDescription}
                    onChange={(e) => updateRow(dIdx, rIdx, 'workDescription', e.target.value)}
                  />
                  <select value={row.code} onChange={(e) => updateRow(dIdx, rIdx, 'code', e.target.value)}>
                    <option value="Regular">Regular Hours</option>
                    <option value="OT 1.5">Overtime 1.5</option>
                    <option value="OT 2.0">Overtime 2.0</option>
                    <option value="Bank Time">Bank Time</option>
                    <option value="Sick">Sick Leave</option>
                    <option value="Vacation">Vacation</option>
                  </select>
                  <input 
                    type="number" 
                    placeholder="Hours" 
                    min="0"
                    max="24"
                    step="0.25"
                    value={row.hours}
                    onChange={(e) => updateRow(dIdx, rIdx, 'hours', e.target.value)}
                  />
                  {day.rows.length > 1 && (
                    <button className="remove-row-btn" onClick={() => removeRow(dIdx, rIdx)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button className="add-row-btn" onClick={() => addRow(dIdx)}>
                <Plus size={16} /> Add Entry
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="timesheet-footer">
        <div className="totals-group">
          <div className="total-item">
            <span className="total-label">Regular Hrs</span>
            <span className="total-value">{totalRegular.toFixed(2)}</span>
          </div>
          <div className="total-item">
            <span className="total-label">Overtime Hrs</span>
            <span className="total-value">{totalOvertime.toFixed(2)}</span>
          </div>
          <div className="total-item">
            <span className="total-label">Leave Hrs</span>
            <span className="total-value">{totalLeave.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="signature-section">
          <span className="total-label">Employee Signature</span>
          
          {savedSignature ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <img 
                src={savedSignature} 
                alt="Saved Signature" 
                style={{ border: '1px solid var(--border-color)', borderRadius: '4px', background: '#E0E6ED', height: '150px', width: '400px', objectFit: 'contain' }}
              />
              <button 
                className="btn btn-outline" 
                style={{ padding: '6px 10px', fontSize: '12px' }} 
                onClick={() => {
                  localStorage.removeItem(`signature_${employee.id}`);
                  setSavedSignature(null);
                }}
              >
                Reset Signature
              </button>
            </div>
          ) : (
            <SignatureCanvas 
              ref={sigCanvas} 
              canvasProps={{width: 400, height: 150, className: 'signature-canvas'}} 
            />
          )}

          <div className="sig-actions">
            {!savedSignature && (
              <button className="btn btn-outline" style={{ padding: '8px 12px', fontSize: '14px' }} onClick={clearSignature}>
                <Eraser size={16} /> Clear
              </button>
            )}
            <button className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={() => onSubmitSuccess()}>
              <Save size={16} /> Save & Exit
            </button>
            <button className="btn" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={handleInitialSubmit}>
              <CheckCircle size={16} /> Sign & Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

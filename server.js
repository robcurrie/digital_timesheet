import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Serve static frontend files
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
}

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Initialize SQLite database
const db = new sqlite3.Database(path.join(dataDir, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Connected to SQLite database.');
        
        // Create Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            site TEXT NOT NULL
        )`, (err) => {
            if (!err) {
                // Seed initial users if empty
                db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
                    if (row && row.count === 0) {
                        const stmt = db.prepare(`INSERT INTO users (id, name, site) VALUES (?, ?, ?)`);
                        const initialUsers = [
                            { id: '1001', name: 'Ronald McDonald', site: 'Civic Centre' },
                            { id: '1002', name: 'Colonel Sanders', site: 'Civic Centre' },
                            { id: '1003', name: 'Wendy Thomas', site: 'Civic Centre' },
                            { id: '1004', name: 'Count Chocula', site: 'Civic Centre' },
                            { id: '1005', name: "Cap'n Crunch", site: 'Civic Centre' },
                            { id: '1006', name: 'Tony Tiger', site: 'Civic Centre' },
                            { id: '1007', name: 'Chef Boyardee', site: 'Civic Centre' },
                            { id: '1008', name: 'Homer Simpson', site: 'Public Works' },
                            { id: '1009', name: 'Peter Griffin', site: 'Public Works' },
                            { id: '1010', name: 'Bob Belcher', site: 'Public Works' },
                            { id: '1011', name: 'Fred Flintstone', site: 'Public Works' },
                            { id: '1012', name: 'Barney Rubble', site: 'Public Works' },
                            { id: '1013', name: 'George Jetson', site: 'Public Works' },
                            { id: '1014', name: 'Bugs Bunny', site: 'Public Works' },
                            { id: '1015', name: 'Bruce Wayne', site: 'Leisure Center' },
                            { id: '1016', name: 'Clark Kent', site: 'Leisure Center' },
                            { id: '1017', name: 'Peter Parker', site: 'Leisure Center' },
                            { id: '1018', name: 'Barry Allen', site: 'Leisure Center' },
                            { id: '1019', name: 'Hal Jordan', site: 'Leisure Center' },
                            { id: '1020', name: 'Diana Prince', site: 'Leisure Center' },
                            { id: '1021', name: 'Arthur Curry', site: 'Leisure Center' },
                            { id: '1022', name: 'Luke Skywalker', site: 'Parks Office' },
                            { id: '1023', name: 'Han Solo', site: 'Parks Office' },
                            { id: '1024', name: 'James T. Kirk', site: 'Parks Office' },
                            { id: '1025', name: 'Spock', site: 'Parks Office' },
                            { id: '1026', name: 'Jean-Luc Picard', site: 'Parks Office' },
                            { id: '1027', name: 'Indiana Jones', site: 'Parks Office' },
                            { id: '1028', name: 'Marty McFly', site: 'Parks Office' },
                            { id: '1029', name: 'Mario Mario', site: "Griffith's Park Centre" },
                            { id: '1030', name: 'Luigi Mario', site: "Griffith's Park Centre" },
                            { id: '1031', name: 'Sonic Hedgehog', site: "Griffith's Park Centre" },
                            { id: '1032', name: 'Pac Man', site: "Griffith's Park Centre" },
                            { id: '1033', name: 'Link', site: "Griffith's Park Centre" },
                            { id: '1034', name: 'Zelda', site: "Griffith's Park Centre" },
                            { id: '1035', name: 'Donkey Kong', site: "Griffith's Park Centre" }
                        ];
                        initialUsers.forEach(u => stmt.run(u.id, u.name, u.site));
                        stmt.finalize();
                    }
                });
            }
        });

        // Create Timesheets table (Key-Value store mapping to local storage)
        db.run(`CREATE TABLE IF NOT EXISTS timesheets (
            key TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            status TEXT
        )`);
    }
});

// API Endpoints

// Get all users
app.get('/api/users', (req, res) => {
    db.all(`SELECT * FROM users`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Save users (overwrite for simple management)
app.post('/api/users', (req, res) => {
    const users = req.body;
    db.serialize(() => {
        db.run(`DELETE FROM users`);
        const stmt = db.prepare(`INSERT INTO users (id, name, site) VALUES (?, ?, ?)`);
        users.forEach(u => stmt.run(u.id, u.name, u.site));
        stmt.finalize((err) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ message: "Users updated successfully" });
            }
        });
    });
});

// Authenticate user
app.post('/api/auth', (req, res) => {
    const { id, enteredId } = req.body;
    if (id !== enteredId) {
        return res.json({ user: null });
    }
    db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
        if (err || !row) {
            res.json({ user: null });
        } else {
            res.json({ user: row });
        }
    });
});

// Timesheet key-value endpoints
app.get('/api/store/:key', (req, res) => {
    const key = req.params.key;
    db.get(`SELECT data FROM timesheets WHERE key = ?`, [key], (err, row) => {
        if (err || !row) {
            res.json({ data: null });
        } else {
            res.json({ data: row.data });
        }
    });
});

app.post('/api/store/:key', (req, res) => {
    const key = req.params.key;
    const data = JSON.stringify(req.body.data);
    db.run(`INSERT INTO timesheets (key, data) VALUES (?, ?) 
            ON CONFLICT(key) DO UPDATE SET data = excluded.data`, 
    [key, data], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true });
        }
    });
});

app.delete('/api/store/:key', (req, res) => {
    const key = req.params.key;
    db.run(`DELETE FROM timesheets WHERE key = ?`, [key], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true });
        }
    });
});

// Get all keys (for history)
app.get('/api/store/keys/:prefix', (req, res) => {
    const prefix = req.params.prefix;
    db.all(`SELECT key, data FROM timesheets WHERE key LIKE ?`, [`${prefix}%`], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Export all timesheets as clean JSON
app.get('/api/export', (req, res) => {
    db.all(`SELECT * FROM timesheets`, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Parse the JSON strings back into objects for a clean output
        const exportData = rows.map(row => {
            let parsedData;
            try {
                parsedData = JSON.parse(row.data);
            } catch (e) {
                parsedData = row.data;
            }
            return {
                key: row.key,
                data: parsedData,
                status: row.status
            };
        });
        
        // Send pretty-printed JSON
        res.header("Content-Type", "application/json");
        res.send(JSON.stringify(exportData, null, 4));
    });
});

app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
});

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-for-resume-builder";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Initialize SQLite database
  const dbPath = path.join(__dirname, "database.sqlite");
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS resumes_v2 (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      data TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      isVip INTEGER DEFAULT 0,
      layoutData TEXT
    );
  `);

  // Migrate old resumes if they exist
  try {
    const oldResumes = await db.all("SELECT * FROM resumes");
    if (oldResumes && oldResumes.length > 0) {
      for (const r of oldResumes) {
        const newId = "res_" + Date.now().toString() + Math.random().toString(36).substr(2, 5);
        await db.run(
          "INSERT INTO resumes_v2 (id, userId, title, data, updatedAt) VALUES (?, ?, ?, ?, ?)",
          [newId, r.userId, "我的简历", r.data, r.updatedAt]
        );
      }
      await db.exec("DROP TABLE resumes");
    }
  } catch (e) {
    // Table might not exist, ignore
  }

  // Seed default admin and templates if not exists
  const adminExists = await db.get("SELECT id FROM users WHERE username = 'admin'");
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await db.run(
      "INSERT INTO users (id, username, password, role, createdAt) VALUES (?, ?, ?, ?, ?)",
      ["user_admin", "admin", hashedPassword, "admin", new Date().toISOString()]
    );
  }

  const templatesExist = await db.get("SELECT count(*) as count FROM templates");
  if (templatesExist.count === 0) {
    const defaultTemplates = [
      { id: 'template1', name: '简约通用', description: '适合所有行业的标准排版，清晰明了。', isVip: 0, layoutData: null },
      { id: 'template2', name: '现代专业', description: '带有侧边栏的现代设计，适合互联网/设计行业。', isVip: 1, layoutData: null },
      { 
        id: 'template3', 
        name: '普通简历', 
        description: '通过后台拖拽生成的动态模板示例。', 
        isVip: 0,
        layoutData: JSON.stringify({
          layoutType: 'single',
          themeColor: '#0ea5e9',
          fontColor: '#333333',
          backgroundColor: '#ffffff',
          sidebarBackgroundColor: '#f8fafc',
          mainBlocks: [
            { id: '1', type: 'header' },
            { id: '2', type: 'summary' },
            { id: '3', type: 'work' },
            { id: '4', type: 'projects' },
            { id: '5', type: 'education' },
            { id: '6', type: 'skills' }
          ],
          sidebarBlocks: []
        })
      }
    ];
    for (const t of defaultTemplates) {
      await db.run(
        "INSERT INTO templates (id, name, description, isVip, layoutData) VALUES (?, ?, ?, ?, ?)",
        [t.id, t.name, t.description, t.isVip, t.layoutData]
      );
    }
  }

  // Middleware to verify JWT
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    next();
  };

  // API Routes
  app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    
    try {
      const existing = await db.get("SELECT id FROM users WHERE username = ?", [username]);
      if (existing) return res.status(400).json({ error: "Username already exists" });
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const id = "user_" + Date.now().toString();
      await db.run(
        "INSERT INTO users (id, username, password, createdAt) VALUES (?, ?, ?, ?)",
        [id, username, hashedPassword, new Date().toISOString()]
      );
      
      const token = jwt.sign({ id, username, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ user: { id, username, role: 'user', status: 'active' }, token });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);
      if (!user) return res.status(400).json({ error: "Invalid credentials" });
      
      if (user.status === 'disabled') return res.status(403).json({ error: "Account is disabled" });
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(400).json({ error: "Invalid credentials" });
      
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ user: { id: user.id, username: user.username, role: user.role, status: user.status }, token });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await db.get("SELECT id, username, role, status, createdAt FROM users WHERE id = ?", [req.user.id]);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/user/profile", authenticateToken, async (req: any, res) => {
    const { username, currentPassword, newPassword } = req.body;
    try {
      const user = await db.get("SELECT * FROM users WHERE id = ?", [req.user.id]);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (username && username !== user.username) {
        const existing = await db.get("SELECT id FROM users WHERE username = ?", [username]);
        if (existing) return res.status(400).json({ error: "Username already taken" });
        await db.run("UPDATE users SET username = ? WHERE id = ?", [username, req.user.id]);
      }

      if (newPassword) {
        if (!currentPassword) return res.status(400).json({ error: "Current password required" });
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) return res.status(400).json({ error: "Invalid current password" });
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, req.user.id]);
      }

      const updatedUser = await db.get("SELECT id, username, role, status FROM users WHERE id = ?", [req.user.id]);
      res.json(updatedUser);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/resumes/me", authenticateToken, async (req: any, res) => {
    try {
      const resumes = await db.all("SELECT id, title, data, updatedAt FROM resumes_v2 WHERE userId = ? ORDER BY updatedAt DESC", [req.user.id]);
      res.json(resumes.map(r => ({ ...r, data: JSON.parse(r.data) })));
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/resumes/me", authenticateToken, async (req: any, res) => {
    const { title, data } = req.body;
    try {
      const id = "res_" + Date.now().toString() + Math.random().toString(36).substr(2, 5);
      const updatedAt = new Date().toISOString();
      await db.run(
        "INSERT INTO resumes_v2 (id, userId, title, data, updatedAt) VALUES (?, ?, ?, ?, ?)",
        [id, req.user.id, title || "未命名简历", JSON.stringify(data), updatedAt]
      );
      res.json({ id, title: title || "未命名简历", data, updatedAt });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/resumes/me/:id", authenticateToken, async (req: any, res) => {
    const { title, data } = req.body;
    try {
      const resume = await db.get("SELECT id FROM resumes_v2 WHERE id = ? AND userId = ?", [req.params.id, req.user.id]);
      if (!resume) return res.status(404).json({ error: "Resume not found" });

      const updatedAt = new Date().toISOString();
      if (title && data) {
        await db.run("UPDATE resumes_v2 SET title = ?, data = ?, updatedAt = ? WHERE id = ?", [title, JSON.stringify(data), updatedAt, req.params.id]);
      } else if (title) {
        await db.run("UPDATE resumes_v2 SET title = ?, updatedAt = ? WHERE id = ?", [title, updatedAt, req.params.id]);
      } else if (data) {
        await db.run("UPDATE resumes_v2 SET data = ?, updatedAt = ? WHERE id = ?", [JSON.stringify(data), updatedAt, req.params.id]);
      }
      res.json({ success: true, updatedAt });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/resumes/me/:id", authenticateToken, async (req: any, res) => {
    try {
      const result = await db.run("DELETE FROM resumes_v2 WHERE id = ? AND userId = ?", [req.params.id, req.user.id]);
      if (result.changes === 0) return res.status(404).json({ error: "Resume not found" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Admin route to get all resumes (disabled in production)
  app.get("/api/admin/resumes", authenticateToken, requireAdmin, async (req: any, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: "This feature is disabled in production for privacy reasons." });
    }
    try {
      const resumes = await db.all(`
        SELECT r.id, r.userId, r.title, r.updatedAt, u.username 
        FROM resumes_v2 r 
        JOIN users u ON r.userId = u.id 
        ORDER BY r.updatedAt DESC
      `);
      res.json(resumes);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/admin/resumes/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: "This feature is disabled in production for privacy reasons." });
    }
    try {
      const resume = await db.get("SELECT * FROM resumes_v2 WHERE id = ?", [req.params.id]);
      if (!resume) return res.status(404).json({ error: "Resume not found" });
      res.json({ ...resume, data: JSON.parse(resume.data) });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/admin/resumes/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: "This feature is disabled in production for privacy reasons." });
    }
    try {
      const result = await db.run("DELETE FROM resumes_v2 WHERE id = ?", [req.params.id]);
      if (result.changes === 0) return res.status(404).json({ error: "Resume not found" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await db.all("SELECT * FROM templates");
      const formatted = templates.map(t => ({
        ...t,
        isVip: t.isVip === 1,
        layoutData: t.layoutData ? JSON.parse(t.layoutData) : undefined
      }));
      res.json(formatted);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/templates", authenticateToken, requireAdmin, async (req, res) => {
    const { id, name, description, isVip, layoutData } = req.body;
    try {
      await db.run(
        "INSERT INTO templates (id, name, description, isVip, layoutData) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, isVip=excluded.isVip, layoutData=excluded.layoutData",
        [id, name, description, isVip ? 1 : 0, layoutData ? JSON.stringify(layoutData) : null]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/templates/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      await db.run("DELETE FROM templates WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/admin/users", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const users = await db.all("SELECT id, username, role, status, createdAt FROM users");
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/admin/users/:id/status", authenticateToken, requireAdmin, async (req, res) => {
    const { status } = req.body;
    try {
      if (req.params.id === (req as any).user.id) {
        return res.status(400).json({ error: "Cannot change own status" });
      }
      await db.run("UPDATE users SET status = ? WHERE id = ?", [status, req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

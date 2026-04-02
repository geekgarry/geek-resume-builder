require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
// 增加 JSON 请求体大小限制
app.use(express.json({ limit: '50mb' }));

// 增加 URL 编码请求体大小限制
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 9901;
const JWT_SECRET = process.env.JWT_SECRET || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890@PLUS';

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234567890',
  database: process.env.DB_NAME || 'resume_builder',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// --- AUTH ROUTES ---

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const [existing] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return res.status(400).json({ error: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user_${Date.now()}`;
    
    await pool.query(
      'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
      [userId, username, hashedPassword]
    );

    const token = jwt.sign({ id: userId, username, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: userId, username, role: 'user', status: 'active' }, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    
    if (users.length === 0) return res.status(400).json({ error: 'Invalid credentials' });
    
    const user = users[0];
    
    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'Account is disabled' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, username: user.username, role: user.role, status: user.status }, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, username, role, status, created_at as createdAt FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    if (users[0].status === 'disabled') return res.status(403).json({ error: 'Account is disabled' });
    res.json(users[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = users[0];
    
    if (user.status === 'disabled') return res.status(403).json({ error: 'Account is disabled' });

    if (username && username !== user.username) {
      const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      if (existing.length > 0) return res.status(400).json({ error: 'Username already taken' });
      await pool.query('UPDATE users SET username = ? WHERE id = ?', [username, req.user.id]);
    }

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
      const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!validPassword) return res.status(400).json({ error: 'Invalid current password' });
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, req.user.id]);
    }

    const [updatedUsers] = await pool.query('SELECT id, username, role, status FROM users WHERE id = ?', [req.user.id]);
    res.json(updatedUsers[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- RESUME ROUTES ---

// Get all resumes for current user
app.get('/api/resumes/me/one', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, title, resume_data as data, updated_at as updatedAt FROM resumes WHERE user_id = ? ORDER BY updated_at DESC limit 1', [req.user.id]);
    const formatted = rows.map(r => ({
      ...r,
      data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    }));
    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/resumes/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, title, resume_data as data, updated_at as updatedAt FROM resumes WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id]);
    const formatted = rows.map(r => ({
      ...r,
      data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data
    }));
    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new resume
app.post('/api/resumes/me', authenticateToken, async (req, res) => {
  try {
    const { title, data } = req.body;
    const id = `res_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    await pool.query(
      'INSERT INTO resumes (id, user_id, title, resume_data) VALUES (?, ?, ?, ?)',
      [id, req.user.id, title || '未命名简历', JSON.stringify(data)]
    );
    
    res.json({ id, title: title || '未命名简历', data, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update resume
app.put('/api/resumes/me/:id', authenticateToken, async (req, res) => {
  try {
    const { title, data } = req.body;
    const [resumes] = await pool.query('SELECT id FROM resumes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (resumes.length === 0) return res.status(404).json({ error: 'Resume not found' });

    if (title && data) {
      await pool.query('UPDATE resumes SET title = ?, resume_data = ? WHERE id = ?', [title, JSON.stringify(data), req.params.id]);
    } else if (title) {
      await pool.query('UPDATE resumes SET title = ? WHERE id = ?', [title, req.params.id]);
    } else if (data) {
      await pool.query('UPDATE resumes SET resume_data = ? WHERE id = ?', [JSON.stringify(data), req.params.id]);
    }
    
    res.json({ success: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete resume
app.delete('/api/resumes/me/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM resumes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Resume not found' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- TEMPLATE ROUTES ---

// Get all templates (Public)
app.get('/api/templates', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM templates ORDER BY created_at ASC');
    const templates = rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isVip: !!r.is_vip,
      readonly: !r.readonly, // 表示是否为系统预设模板，用户不可编辑 单个!0 = true, !!0 = false
      layoutData: r.layout_data ? (typeof r.layout_data === 'string' ? JSON.parse(r.layout_data) : r.layout_data) : undefined
    }));
    res.json(templates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- ADMIN ROUTES ---

// Get all users
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, role, status, created_at as createdAt FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user status
app.put('/api/admin/users/:id/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot change own status' });
    }
    // Note: Assuming there is a status column in the users table, if not, this will fail.
    // Let's add status column to users table if it doesn't exist, or just ignore for now.
    // Assuming the database has a status column.
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user
app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add or Update template
app.post('/api/templates', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id, name, description, isVip, layoutData } = req.body;
    
    // Check if exists
    const [existing] = await pool.query('SELECT id FROM templates WHERE id = ?', [id]);
    
    if (existing.length > 0) {
      await pool.query(
        'UPDATE templates SET name = ?, description = ?, is_vip = ?, layout_data = ? WHERE id = ?',
        [name, description, isVip ? 1 : 0, layoutData ? JSON.stringify(layoutData) : null, id]
      );
    } else {
      await pool.query(
        'INSERT INTO templates (id, name, description, is_vip, layout_data) VALUES (?, ?, ?, ?, ?)',
        [id, name, description, isVip ? 1 : 0, layoutData ? JSON.stringify(layoutData) : null]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete template
app.delete('/api/templates/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all resumes (Admin)
app.get('/api/admin/resumes', authenticateToken, isAdmin, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This feature is disabled in production for privacy reasons.' });
  }
  try {
    const [rows] = await pool.query(`
      SELECT r.id, r.user_id as userId, r.title, r.updated_at as updatedAt, u.username 
      FROM resumes r 
      JOIN users u ON r.user_id = u.id 
      ORDER BY r.updated_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// admin 获取任何用户的简历数据，这个接口需要传递简历 ID 来获取对应的简历数据
// Get specific resume (Admin)
app.get('/api/admin/resumes/:id', authenticateToken, isAdmin, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This feature is disabled in production for privacy reasons.' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM resumes WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Resume not found' });
    const resume = rows[0];
    res.json({
      id: resume.id,
      userId: resume.user_id,
      title: resume.title,
      data: typeof resume.resume_data === 'string' ? JSON.parse(resume.resume_data) : resume.resume_data,
      updatedAt: resume.updated_at
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// admin 删除任何用户的简历数据，这个接口需要传递简历 ID 来删除对应的简历数据，管理员可以删除任何用户的简历数据，这个接口需要传递简历 ID 来删除对应的简历数据
// Delete resume (Admin)
app.delete('/api/admin/resumes/:id', authenticateToken, isAdmin, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This feature is disabled in production for privacy reasons.' });
  }
  try {
    const [result] = await pool.query('DELETE FROM resumes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Resume not found' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// admin 更新任何用户的简历数据，这个接口需要传递简历 ID 和更新内容来修改对应的简历数据
app.put('/api/admin/resumes/:id', authenticateToken, isAdmin, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This feature is disabled in production for privacy reasons.' });
  }
  try {
    const { title, data } = req.body;
    const [result] = await pool.query('UPDATE resumes SET title = ?, resume_data = ? WHERE id = ?', [title, JSON.stringify(data), req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Resume not found' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Gemini AI 接口，简历优化接口，支持流式返回优化结果，前端可以根据返回的流式数据实时展示优化后的内容，提升用户体验
const { GoogleGenAI } = require('@google/genai');
// 初始化 Gemini API，确保你的 .env 文件中有 GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "your_gemini_api_key_here" });

app.post('/api/ai-optimize', authenticateToken, async (req, res) => {
  const { text, contextType } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  let systemInstruction = "你是一个专业的简历优化专家。请帮我润色以下简历内容，使其更加专业、有吸引力，突出重点成果。直接返回润色后的内容，不要包含多余的解释或前缀。不要包含任何 Markdown 标记";
  
  if (contextType === 'summary') {
    systemInstruction = "你是一个资深的HR和简历优化专家。请帮我润色以下【个人总结】，使其更加专业、精炼、有吸引力，突出核心竞争力、过往成就和职业目标。语气要自信且客观。直接返回润色后的内容，不要包含任何多余的解释、问候语或前缀（如“这是优化后的内容”）。不要包含任何 Markdown 标记";
  } else if (contextType === 'work') {
    systemInstruction = "你是一个资深的HR和简历优化专家。请帮我润色以下【工作经历】描述。请尽量使用STAR法则（情境、任务、行动、结果）进行重构，使用强有力的动词开头，突出具体的工作成果、业务价值和数据支撑（如果有）。直接返回润色后的内容，不要包含任何多余的解释、问候语或前缀。不要包含任何 Markdown 标记";
  } else if (contextType === 'project') {
    systemInstruction = "你是一个资深的HR和简历优化专家。请帮我润色以下【项目经验】描述。请突出项目的业务背景、技术难点、个人核心贡献以及最终取得的成果。语言要专业、精炼。直接返回润色后的内容，不要包含任何多余的解释、问候语或前缀。不要包含任何 Markdown 标记";
  }

  try {
    // 设置 Server-Sent Events (SSE) 响应头，保持连接不断开
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 调用 Gemini 流式 API
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: text,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    // 遍历流并实时发送给前端
    for await (const chunk of responseStream) {
      if (chunk.text) {
        // 按照 SSE 格式发送数据块
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    
    // 结束流标识
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error("AI 润色请求失败:", error);
    res.write(`data: ${JSON.stringify({ error: 'AI 润色失败，请稍后重试' })}\n\n`);
    res.end();
  }
});

// AI 根据基础信息自动生成完整简历内容
app.post('/api/ai/generate-resume', authenticateToken, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const systemInstruction = `你是一个专业的简历生成助手。请根据用户提供的一段基本信息，提取并扩写成一份完整的简历数据。
  必须严格返回 JSON 格式，不要包含任何 Markdown 标记（如 \`\`\`json）。
  JSON 结构必须严格如下：
  {
    "basics": { "name": "", "email": "", "phone": "", "summary": "", "avatar": "" },
    "work": [{ "id": "1", "company": "", "position": "", "duration": "", "description": "", "isHidden": false }],
    "education": [{ "id": "1", "school": "", "degree": "", "year": "" }],
    "jobIntention": { "targetJob": "", "targetCity": "", "expectedSalary": "" },
    "projects": [{ "id": "1", "name": "", "role": "", "duration": "", "description": "", "technologies": "", "isHidden": false }],
    "awards": [{ "id": "1", "name": "", "date": "", "description": "", "isHidden": false }],
    "certifications": [{ "id": "1", "name": "", "date": "", "description": "", "isHidden": false }],
    "portfolio": [{ "id": "1", "name": "", "url": "", "description": "", "isHidden": false }],
    "skills": "",
    "hobbies": ""
  }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json",
      }
    });
    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error("AI 生成简历失败:", error);
    res.status(500).json({ error: 'AI 生成简历失败' });
  }
});

// AI 自动生成简历模板配置 (供后端模板库管理使用)
app.post('/api/ai/generate-template', authenticateToken, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const systemInstruction = `你是一个资深的前端UI设计师。请根据用户的描述，生成一个简历模板的样式配置。
  必须严格返回 JSON 格式，不要包含任何 Markdown 标记。
  JSON 结构如下：
  {
    "name": "模板名称",
    "description": "模板描述",
    "styleConfig": {
      "primaryColor": "#HEX",
      "secondaryColor": "#HEX",
      "backgroundColor": "#HEX",
      "fontFamily": "sans-serif | serif | monospace",
      "layout": "single-column | two-column | table | ppt"
    },
    "customCss": "额外的CSS样式字符串"
  }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json",
      }
    });
    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error("AI 生成模板失败:", error);
    res.status(500).json({ error: 'AI 生成模板失败' });
  }
});

// AI 岗位分析 & 简历综合匹配分析
app.post('/api/ai/analyze', authenticateToken, async (req, res) => {
  const { type, text, fileData, mimeType, resumeData } = req.body;
  // type: 'job' (仅岗位分析) | 'match' (简历与岗位综合匹配)

  try {
    let parts = [];
    let systemInstruction = "";

    if (type === 'job') {
      systemInstruction = "你是一个资深的HR和行业专家。请分析用户提供的岗位要求（文本或图片/PDF），提取核心技能、经验要求、加分项，并给出应聘该岗位的建议和行业动态简析。给出技术面试的试题示例和解题思路。并且岗位中关键要求和加分项请用【】符号标注出来，方便前端高亮显示。";
      if (text) parts.push({ text: `岗位描述文本：\n${text}` });
    } else if (type === 'match') {
      systemInstruction = "你是一个资深的HR和职业规划师。请根据提供的个人简历数据，分析其优势和劣势。如果用户还提供了目标岗位描述，请结合岗位描述进行【人岗匹配度】的深度综合分析，指出匹配的亮点、需要弥补的短板，并给出针对性的面试建议和简历修改的建议和修改后的内容。给出技术面试的试题示例和解题思路。并且请用【】符号标注出简历中的亮点和岗位中的关键要求，方便前端高亮显示。";
      parts.push({ text: `个人简历数据：\n${JSON.stringify(resumeData)}` });
      if (text) parts.shift(); parts.push({ text: `个人简历数据：\n${JSON.stringify(resumeData)}\n目标岗位描述文本：\n${text}` });
    } else if(type === 'generate') {
      systemInstruction = "你是一个资深的HR和职业规划师。请根据提供的个人简历数据，分析其优势和劣势，并结合当前的行业岗位需求，自动优化修改符合岗位要求生成一份新的简历内容。返回内容结构和接收的resumeData的内容格式要一致，内容完整并且只多不少，不要减少原内容，直接返回修改优化后的完整简历内容，不要包含任何多余的解释、问候语或前缀。不要包含任何 Markdown 标记。";
      parts.push({ text: `个人简历数据：\n${JSON.stringify(resumeData)}` });
      if(text) parts.shift(); parts.push({ text: `个人简历数据：\n${JSON.stringify(resumeData)}\n目标岗位描述文本：\n${text}` });
    }

    // 处理上传的文件 (图片或 PDF)
    if (fileData && mimeType) {
      const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    }

    if (parts.length === 0) {
      return res.status(400).json({ error: '请提供分析内容' });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // 使用支持多模态的模型
      contents: { role: 'user', parts: parts },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    res.json({ result: response.text });
  } catch (error) {
    console.error("AI 分析失败:", error);
    res.status(500).json({ error: 'AI 分析失败，请检查文件格式或稍后重试' });
  }
});

app.post('/api/stream/ai/analyze', async (req, res) => {
  const { type, text, fileData, mimeType, resumeData } = req.body;
  // type: 'job' (仅岗位分析) | 'match' (简历与岗位综合匹配)
    try {
      let parts = [];
      let systemInstruction = "";

      if (type === 'job') {
        systemInstruction = "你是一个资深的HR和行业专家。请分析用户提供的岗位要求（文本或图片/PDF），提取核心技能、经验要求、加分项，并给出应聘该岗位的建议和行业动态简析。并且岗位中关键要求和加分项请用【】符号标注出来，方便前端高亮显示。也给出技术面试的试题示例和解题思路。";
        if (text) parts.push({ text: `岗位描述文本：\n${text}` });
      } else if (type === 'match') {
        systemInstruction = "你是一个资深的HR和职业规划师。请根据提供的个人简历数据，分析其优势和劣势。如果用户还提供了目标岗位描述，请结合岗位描述进行【人岗匹配度】的深度综合分析，指出匹配的亮点、需要弥补的短板，并给出针对性的面试建议和简历修改的建议和修改后的内容。给出技术面试的试题示例和解题思路。并且请用【】符号标注出简历中的亮点和岗位中的关键要求，方便前端高亮显示。";
        parts.push({ text: `个人简历数据：\n${JSON.stringify(resumeData)}` });
        if (text) parts.shift(); parts.push({ text: `个人简历数据：\n${JSON.stringify(resumeData)}\n目标岗位描述文本：\n${text}` });
      } else if(type === 'generate') {
        systemInstruction = "你是一个资深的HR和职业规划师。请根据提供的个人简历数据，分析其优势和劣势，并结合当前的行业岗位需求，自动优化修改符合岗位要求生成一份新的简历内容。返回内容结构和接收的resumeData的内容格式要一致，内容完整并且只多不少，不要减少原内容，直接返回修改优化后的完整简历内容，不要包含任何多余的解释、问候语或前缀。不要包含任何 Markdown 标记。";
        parts.push({ text: `个人简历数据：\n${JSON.stringify(resumeData)}` });
        if(text) parts.shift(); parts.push({ text: `个人简历数据：\n${JSON.stringify(resumeData)}\n目标岗位描述文本：\n${text}` });
      }

      // 处理上传的文件 (图片或 PDF)
      if (fileData && mimeType) {
        const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      }

      if (parts.length === 0) {
        return res.status(400).json({ error: '请提供分析内容' });
      }

        // 配置SSE头部
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // 构造请求体
        // const requestBody = {
        //     contents: [{
        //         role: 'user',
        //         parts: parts
        //     }],
        //     generationConfig: {
        //         temperature: 0.7,
        //         maxOutputTokens: 2048
        //     }
        // };

        // // 发起POST请求并监听流式响应
        // const response = await axios.post(GEMINI_STREAM_URL, requestBody, {
        //     responseType: 'stream'
        // });

        // let isFirstChunk = true;
        // response.data.on('data', chunk => {
        //     if (isFirstChunk) {
        //         res.write(`event: start\n`);
        //         res.write(`data: Stream started.\n\n`);
        //         isFirstChunk = false;
        //     }

        //     const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
        //     for (let line of lines) {
        //         if (line.startsWith('data:')) {
        //             const jsonData = line.substring(5).trim();
        //             try {
        //                 const parsedData = JSON.parse(jsonData);
        //                 if (parsedData.candidates && parsedData.candidates.length > 0 &&
        //                     parsedData.candidates.content.parts.length > 0) {

        //                     const contentPart = parsedData.candidates.content.parts;
        //                     if (contentPart.text) {
        //                         res.write(`event: update\ndata: ${JSON.stringify({ text: contentPart.text })}\n\n`);
        //                     }
        //                 }
        //             } catch (e) {
        //                 console.error("Failed to parse stream data:", e.message);
        //             }
        //         }
        //     }
        // });

        // response.data.on('end', () => {
        //     res.write(`event: end\ndata: Stream ended.\n\n`);
        //     res.end();
        // });
    //     response.data.on('error', err => {
    //         console.error("Stream error occurred:", err.message);
    //         res.status(500).json({ error: "Internal server streaming error" });
    //     });
    // } catch (err) {
    //     console.error(err.stack || err.message);
    //     res.status(500).json({ error: "Server internal error during request processing." });
    // }
    // 调用 Gemini 流式 API
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: [{
        role: 'user',
        parts: parts
      }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    // 遍历流并实时发送给前端
    for await (const chunk of responseStream) {
      if (chunk.text) {
        // 按照 SSE 格式发送数据块
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    
    // 结束流标识
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error("AI 行业/岗位分析失败:", error);
    res.write(`data: ${JSON.stringify({ error: 'AI 行业/岗位分析失败，请稍后重试' })}\n\n`);
    res.end();
  }
});

// 服务端Node.js示例
app.post('/api/gemini-proxy', async (req, res) => {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

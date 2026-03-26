-- AI Resume Builder Database Schema (MySQL)

-- 1. Users Table
CREATE TABLE `users` (
  `id` VARCHAR(50) PRIMARY KEY,
  `username` VARCHAR(50) UNIQUE NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('user', 'admin') DEFAULT 'user',
  `status` ENUM('active', 'disabled') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Resumes Table (Storing the entire resume JSON for flexibility)
-- Alternatively, you could normalize this into separate tables (education, work, projects),
-- but for a document-based structure like a resume, a JSON column is highly efficient and flexible.
CREATE TABLE `resumes` (
  `id` VARCHAR(50) PRIMARY KEY,
  `user_id` VARCHAR(50) NOT NULL,
  `title` VARCHAR(100) NOT NULL DEFAULT '未命名简历',
  `resume_data` JSON NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- 3. Templates Table
CREATE TABLE `templates` (
  `id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `is_vip` BOOLEAN DEFAULT FALSE,
  `readonly` BOOLEAN DEFAULT FALSE, -- 是否为系统预设模板，用户不可编辑
  `layout_data` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default Admin
INSERT INTO `users` (`id`, `username`, `password_hash`, `role`) 
VALUES ('user_admin', 'admin', '$2a$10$8KYJJJyDVXb0hL1NZt89R.a9i6eLkFaFz7aG91H0RU7qFvn935iKi', 'admin');

-- Insert Default Templates
INSERT INTO `templates` (`id`, `name`, `description`, `is_vip`, `layout_data`) VALUES 
('template1', '简约通用', '适合所有行业的标准排版，清晰明了。', FALSE, NULL),
('template2', '现代专业', '带有侧边栏的现代设计，适合互联网/设计行业。', TRUE, NULL),
('template3', '表格样式', '传统的表格布局，适合展示详细信息。', FALSE, NULL),
('template4', 'PPT风格', 'PPT风格的简历模板。', TRUE, NULL),
('template5', '自定义动态模板', '通过后台拖拽生成的动态模板示例。', FALSE, '{"layoutType":"two-column","sidebarPosition":"left","themeColor":"#0ea5e9","fontColor":"#333333","backgroundColor":"#ffffff","sidebarBackgroundColor":"#f8fafc","mainBlocks":[{"id":"1","type":"header"},{"id":"2","type":"summary"},{"id":"3","type":"work"},{"id":"4","type":"projects"}],"sidebarBlocks":[{"id":"5","type":"education"},{"id":"6","type":"skills"}]}');

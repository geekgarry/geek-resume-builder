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
INSERT INTO `templates` (`id`, `name`, `description`, `is_vip`, `layout_data`, `readonly`) VALUES 
('template1', '简约通用', '适合所有行业的标准排版，清晰明了。', FALSE, NULL, TRUE),
('template2', '现代专业', '带有侧边栏的现代设计，适合互联网/设计行业。', TRUE, NULL, TRUE),
('template3', '表格样式', '传统的表格布局，适合展示详细信息。', FALSE, NULL, TRUE),
('template4', 'PPT风格', 'PPT风格的简历模板。', TRUE, NULL, TRUE),
('template5', '自定义动态模板', '通过后台拖拽生成的动态模板示例。', FALSE, '{"layoutType":"two-column","sidebarPosition":"left","themeColor":"#0ea5e9","fontColor":"#333333","backgroundColor":"#ffffff","sidebarBackgroundColor":"#f8fafc","mainBlocks":[{"id":"1","type":"header"},{"id":"2","type":"summary"},{"id":"3","type":"work"},{"id":"4","type":"projects"}],"sidebarBlocks":[{"id":"5","type":"education"},{"id":"6","type":"skills"}]}', FALSE),
('template6', '商务蓝调', '深蓝头图与圆角色块标题，适合互联网求职展示。', FALSE, NULL, TRUE),
('template7', '清新卡片', '浅蓝背景白卡片，斜杠标题线，清爽现代。', FALSE, NULL, TRUE),
('template8', '图标专业', '圆形图标章节与侧边丝带，专业稳重。', FALSE, NULL, TRUE),
('template9', '斜切标签', '居中头像卡片与斜切色块标题，辨识度高。', TRUE, NULL, TRUE);

-- 4. PPTs Table (Storing PPT data)
CREATE TABLE `ppts` (
  `id` VARCHAR(50) PRIMARY KEY,
  `user_id` VARCHAR(50) NOT NULL,
  `title` VARCHAR(200) NOT NULL DEFAULT '未命名PPT',
  `ppt_data` JSON NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- 5. File Transfer (临时文件中转)
-- 文件中转站表（追加到已有库执行）
-- mysql -u root -p resume_builder < backend/migrations/file_transfer.sql
CREATE TABLE IF NOT EXISTS `file_transfers` (
  `id` VARCHAR(64) PRIMARY KEY COMMENT '下载令牌',
  `original_name` VARCHAR(512) NOT NULL,
  `stored_name` VARCHAR(512) NOT NULL,
  `mime_type` VARCHAR(128) DEFAULT NULL,
  `file_size` BIGINT NOT NULL DEFAULT 0,
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `max_downloads` INT NOT NULL DEFAULT 0 COMMENT '0=不限',
  `download_count` INT NOT NULL DEFAULT 0,
  `burn_after_read` TINYINT(1) NOT NULL DEFAULT 0,
  `expires_at` DATETIME NOT NULL,
  `client_fingerprint` VARCHAR(128) DEFAULT NULL,
  `client_ip` VARCHAR(64) DEFAULT NULL,
  `machine_id` VARCHAR(128) DEFAULT NULL,
  `identity_key` VARCHAR(128) DEFAULT NULL COMMENT 'fingerprint+ip+machine 哈希',
  `status` ENUM('active', 'expired', 'deleted', 'burned') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_ft_expires` (`expires_at`),
  INDEX `idx_ft_identity` (`identity_key`),
  INDEX `idx_ft_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `file_transfer_upload_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `identity_key` VARCHAR(128) NOT NULL,
  `client_ip` VARCHAR(64) DEFAULT NULL,
  `file_count` INT NOT NULL DEFAULT 1,
  `total_size` BIGINT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_ftul_identity_time` (`identity_key`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
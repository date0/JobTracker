USE jobtracker;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS companies (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    website VARCHAR(2048) NULL,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_companies_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS jobs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT UNSIGNED NULL,
    title VARCHAR(255) NOT NULL,
    description MEDIUMTEXT NULL,
    source_url VARCHAR(2048) NULL,
    normalized_url VARCHAR(2048) NULL,
    source_site VARCHAR(150) NULL,
    location VARCHAR(255) NULL,
    work_mode ENUM('onsite', 'hybrid', 'remote', 'unknown')
        NOT NULL DEFAULT 'unknown',
    employment_type VARCHAR(100) NULL,
    salary_min DECIMAL(12,2) NULL,
    salary_max DECIMAL(12,2) NULL,
    salary_currency CHAR(3) NULL,
    posted_at DATE NULL,
    expires_at DATE NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_jobs_company_title (company_id, title),
    INDEX idx_jobs_title (title),
    INDEX idx_jobs_location (location),
    INDEX idx_jobs_normalized_url (normalized_url(255)),
    CONSTRAINT fk_jobs_company
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_jobs_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS applications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    job_id BIGINT UNSIGNED NOT NULL,
    status ENUM(
        'saved', 'applied', 'interviewing',
        'offer', 'rejected', 'withdrawn'
    ) NOT NULL DEFAULT 'saved',
    applied_at DATE NULL,
    personal_notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_applications_user_job (user_id, job_id),
    INDEX idx_applications_user_status (user_id, status),
    CONSTRAINT fk_applications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_applications_job
        FOREIGN KEY (job_id) REFERENCES jobs(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS application_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT UNSIGNED NOT NULL,
    event_type ENUM(
        'note', 'follow_up', 'interview',
        'status_change', 'reminder', 'other'
    ) NOT NULL DEFAULT 'note',
    title VARCHAR(200) NOT NULL,
    details TEXT NULL,
    event_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_events_application_date (application_id, event_at),
    CONSTRAINT fk_events_application
        FOREIGN KEY (application_id) REFERENCES applications(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

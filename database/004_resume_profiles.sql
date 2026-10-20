USE jobtracker;

CREATE TABLE IF NOT EXISTS resume_profiles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    headline VARCHAR(255) NULL,
    summary TEXT NULL,
    experience MEDIUMTEXT NULL,
    skills TEXT NULL,
    education MEDIUMTEXT NULL,
    certifications TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_resume_profiles_user (user_id),
    CONSTRAINT fk_resume_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

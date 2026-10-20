USE jobtracker;

CREATE TABLE IF NOT EXISTS resume_adaptations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    job_id BIGINT UNSIGNED NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    confirmed_requirements MEDIUMTEXT NOT NULL,
    draft_content MEDIUMTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_resume_adaptations_user (user_id, created_at),
    CONSTRAINT fk_resume_adaptations_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_resume_adaptations_job
        FOREIGN KEY (job_id) REFERENCES jobs(id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

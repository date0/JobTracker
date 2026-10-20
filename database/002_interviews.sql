
CREATE TABLE interviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    application_id BIGINT UNSIGNED NOT NULL,

    scheduled_at DATETIME NOT NULL,
    duration_minutes SMALLINT UNSIGNED DEFAULT NULL,

    interview_type ENUM(
        'virtual',
        'onsite',
        'phone'
    ) NOT NULL DEFAULT 'virtual',

    meeting_url VARCHAR(2048) DEFAULT NULL,
    location VARCHAR(500) DEFAULT NULL,

    interviewer_name VARCHAR(200) DEFAULT NULL,
    interviewer_contact VARCHAR(320) DEFAULT NULL,

    status ENUM(
        'scheduled',
        'completed',
        'cancelled',
        'rescheduled'
    ) NOT NULL DEFAULT 'scheduled',

    preparation_notes TEXT DEFAULT NULL,
    questions_to_ask TEXT DEFAULT NULL,
    post_interview_notes TEXT DEFAULT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_interviews_application_date (
        application_id,
        scheduled_at
    ),

    KEY idx_interviews_status_date (
        status,
        scheduled_at
    ),

    CONSTRAINT fk_interviews_application
        FOREIGN KEY (application_id)
        REFERENCES applications (id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

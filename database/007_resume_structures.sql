USE jobtracker;

CREATE TABLE resume_structures (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,

    version INT UNSIGNED NOT NULL,
    schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,

    source_hash CHAR(64)
        CHARACTER SET ascii
        COLLATE ascii_bin
        NOT NULL,

    structure_json LONGTEXT NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NOT NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_resume_structures_user_version (
        user_id,
        version
    ),

    KEY idx_resume_structures_user_confirmed (
        user_id,
        confirmed_at
    ),

    CONSTRAINT chk_resume_structures_json
        CHECK (JSON_VALID(structure_json)),

    CONSTRAINT fk_resume_structures_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

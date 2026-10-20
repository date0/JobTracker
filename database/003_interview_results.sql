ALTER TABLE interviews
    ADD COLUMN result ENUM(
        'pending',
        'awaiting_response',
        'next_round',
        'offer_received',
        'rejected',
        'withdrawn'
    ) NOT NULL DEFAULT 'pending'
    AFTER status;

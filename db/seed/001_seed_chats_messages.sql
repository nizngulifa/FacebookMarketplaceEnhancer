BEGIN;

WITH new_chat AS (
  INSERT INTO chats (description)
  VALUES ('MVP sample chat')
  RETURNING id
)
INSERT INTO messages (chat_id, content)
SELECT id, 'Hey! Is this listing still available?'
FROM new_chat
UNION ALL
SELECT id, 'Yes, it is still available.'
FROM new_chat;

COMMIT;

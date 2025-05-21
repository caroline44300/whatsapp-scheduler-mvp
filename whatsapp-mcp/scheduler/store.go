package store

import (
	"fmt"
	"time"
	"database/sql"

	"go.mau.fi/whatsmeow"
)

type ScheduledMessage struct {
	ID        int64
	Number    string
	Message   string
	SendTime  time.Time
	Sent      bool
	CreatedAt time.Time
}

func InitSchedulerTable(db *sql.DB) error {
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS scheduled_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		number TEXT NOT NULL,
		message TEXT NOT NULL,
		send_time TIMESTAMP NOT NULL,
		sent BOOLEAN NOT NULL DEFAULT 0,
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	`)
	return err
}

func GetDueMessages(db *sql.DB) ([]ScheduledMessage, error) {
	rows, err := db.Query(`
		SELECT id, number, message, send_time FROM scheduled_messages
		WHERE sent = 0 AND send_time <= CURRENT_TIMESTAMP
		ORDER BY send_time ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []ScheduledMessage
	for rows.Next() {
		var m ScheduledMessage
		if err := rows.Scan(&m.ID, &m.Number, &m.Message, &m.SendTime); err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	return messages, nil
}

func MarkAsSent(db *sql.DB, id int64) error {
	_, err := db.Exec(`UPDATE scheduled_messages SET sent = 1 WHERE id = ?`, id)
	return err
}

func InsertScheduledMessage(db *sql.DB, number, message string, sendTime time.Time) error {
	_, err := db.Exec(`
		INSERT INTO scheduled_messages (number, message, send_time)
		VALUES (?, ?, ?)
	`, number, message, sendTime)
	return err
}

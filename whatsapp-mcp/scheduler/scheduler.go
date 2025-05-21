package scheduler

import (
	"fmt"
	"time"
	"database/sql"
	"go.mau.fi/whatsmeow"
	"github.com/caroline44300/whatsapp-mcp/scheduler" // for data access
)

func Start(client *whatsmeow.Client, db *sql.DB, logger func(string), sendFunc func(*whatsmeow.Client, string, string, string) (bool, string)) {
	go func() {
		for {
			time.Sleep(1 * time.Second)

			messages, err := scheduler.GetDueMessages(db)
			if err != nil {
				logger(fmt.Sprintf("Scheduler error: %v", err))
				continue
			}

			for _, m := range messages {
				success, status := sendFunc(client, m.Number, m.Message, "")
				logger(fmt.Sprintf("Scheduled send to %s: %v (%v)", m.Number, status, success))
				if success {
					scheduler.MarkAsSent(db, m.ID)
				}
			}
		}
	}()
}


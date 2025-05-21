package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/mdp/qrterminal"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

// ScheduledMessage represents a message to send later
type ScheduledMessage struct {
	ID       int64
	Number   string
	Message  string
	SendTime time.Time
}

// Database helpers
func initTable(db *sql.DB) error {
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS scheduled (
	    id INTEGER PRIMARY KEY AUTOINCREMENT,
	    number TEXT NOT NULL,
	    message TEXT NOT NULL,
	    send_time TIMESTAMP NOT NULL,
	    sent BOOLEAN NOT NULL DEFAULT 0
	);
	`)
	return err
}

func insertMessage(db *sql.DB, number, message string, t time.Time) error {
	_, err := db.Exec(
		"INSERT INTO scheduled (number, message, send_time) VALUES (?, ?, ?)",
		number, message, t,
	)
	return err
}

func getDue(db *sql.DB) ([]ScheduledMessage, error) {
	rows, err := db.Query(
		"SELECT id, number, message, send_time FROM scheduled WHERE sent=0 AND send_time<=CURRENT_TIMESTAMP",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ScheduledMessage
	for rows.Next() {
		var m ScheduledMessage
		if err := rows.Scan(&m.ID, &m.Number, &m.Message, &m.SendTime); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, nil
}

func markSent(db *sql.DB, id int64) error {
	_, err := db.Exec("UPDATE scheduled SET sent=1 WHERE id=?", id)
	return err
}

// sendWhatsApp sends a plain text message via WhatsApp
func sendWhatsApp(client *whatsmeow.Client, to, text string) (bool, string) {
	if !client.IsConnected() {
		return false, "not connected"
	}
	jid, err := types.ParseJID(to)
	if err != nil {
		return false, err.Error()
	}
	msg := &waProto.Message{Conversation: proto.String(text)}
	if _, err = client.SendMessage(context.Background(), jid, msg); err != nil {
		return false, err.Error()
	}
	return true, "sent"
}

// schedulerLoop polls DB every second for due messages
func schedulerLoop(client *whatsmeow.Client, db *sql.DB) {
	go func() {
		for {
			time.Sleep(time.Second)
			list, err := getDue(db)
			if err != nil {
				fmt.Println("Scheduler error:", err)
				continue
			}
			for _, m := range list {
				ok, status := sendWhatsApp(client, m.Number, m.Message)
				fmt.Printf("Scheduled send to %s: %v (%s)\n", m.Number, ok, status)
				if ok {
					if err := markSent(db, m.ID); err != nil {
						fmt.Println("Mark sent error:", err)
					}
				}
			}
		}
	}()
}

// HTTP payload for scheduling
type ScheduleRequest struct {
	Name     string `json:"name"`
	Message  string `json:"message"`
	SendTime string `json:"send_time"` // RFC3339
}

// findContactJIDByName looks up a full‐name and returns its Contact JID.
func findContactJIDByName(ctx context.Context, client *whatsmeow.Client, name string) (types.JID, bool) {
	contacts, err := client.Store.Contacts.GetAllContacts(ctx)
	if err != nil {
		return types.JID{}, false
	}
	for _, c := range contacts {
		if strings.EqualFold(strings.TrimSpace(c.FullName), strings.TrimSpace(name)) {
			return c.JID, true
		}
	}
	return types.JID{}, false
}

func main() {
	// setup SQLite
	db, err := sql.Open("sqlite3", "store.db?_foreign_keys=on")
	if err != nil {
		panic(err)
	}
	defer db.Close()
	if err := initTable(db); err != nil {
		panic(err)
	}

	// WhatsApp client setup
	logger := waLog.Stdout("WA", "INFO", true)
	ctx := context.Background()
	container, err := sqlstore.New(ctx, "sqlite3", "file:session.db?_foreign_keys=on", logger)
	if err != nil {
		panic(err)
	}
	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		device = container.NewDevice()
	}
	client := whatsmeow.NewClient(device, logger)
	if client == nil {
		panic("failed to create client")
	}

	// connect and QR
	qrChan, _ := client.GetQRChannel(ctx)
	go func() {
		for evt := range qrChan {
			if evt.Event == "code" {
				qrterminal.GenerateHalfBlock(evt.Code, qrterminal.L, os.Stdout)
			}
		}
	}()
	if err := client.Connect(); err != nil {
		panic(err)
	}

	// start scheduler
	schedulerLoop(client, db)

	// HTTP server
	srv := &http.Server{Addr: ":8080"}
	http.HandleFunc("/api/schedule", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req ScheduleRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Bad request", http.StatusBadRequest)
			return
		}

		// 1) parse the time
		when, err := time.Parse(time.RFC3339, req.SendTime)
		if err != nil {
			http.Error(w, "Invalid time format", http.StatusBadRequest)
			return
		}

		// 2) lookup the JID from the human‐readable name
		jid, found := findContactJIDByName(r.Context(), client, req.Name)
		if !found {
			http.Error(w, "Contact not found", http.StatusNotFound)
			return
		}

		// 3) schedule using jid.User (the phone number portion)
		if err := insertMessage(db, jid.User, req.Message, when); err != nil {
			http.Error(w, "DB error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"success":true}`))
	})

	// run HTTP server
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Println("HTTP error:", err)
		}
	}()
	fmt.Println("Listening on :8080")

	// wait for SIGINT
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	// shutdown
	srv.Shutdown(context.Background())
	client.Disconnect()
	fmt.Println("Exited.")
}

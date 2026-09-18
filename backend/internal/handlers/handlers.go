package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/example/pulsevote/internal/middleware"
	"github.com/example/pulsevote/internal/models"
	"github.com/example/pulsevote/internal/realtime"
	"github.com/example/pulsevote/internal/repository"
	"github.com/example/pulsevote/internal/services"
	"github.com/example/pulsevote/internal/validation"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Handler struct {
	Auth *services.AuthService
	Repo *repository.PollRepo
	Redis *realtime.RedisStore
	Secret string
}

type authRequest struct {
	Email string `json:"email"`
	Password string `json:"password"`
}

type createPollRequest struct {
	Question string `json:"question"`
	Options []string `json:"options"`
}

type voteRequest struct {
	OptionID string `json:"optionId"`
	VoterID string `json:"voterId"`
}

func (h *Handler) Signup(c *gin.Context) {
	var req authRequest
	if !bind(c, &req) { return }
	user, token, err := h.Auth.Signup(c, req.Email, req.Password)
	if err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, gin.H{"token": token, "user": user})
}

func (h *Handler) Login(c *gin.Context) {
	var req authRequest
	if !bind(c, &req) { return }
	user, token, err := h.Auth.Login(c, req.Email, req.Password)
	if err != nil { c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

func (h *Handler) Me(c *gin.Context) {
	var user models.User
	if err := h.Auth.Users.FindOne(c, bson.M{"_id": middleware.UserID(c)}).Decode(&user); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"}); return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (h *Handler) CreatePoll(c *gin.Context) {
	var req createPollRequest
	if !bind(c, &req) { return }
	req.Question = strings.TrimSpace(req.Question)
	if err := validation.Question(req.Question); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	if len(req.Options) < 2 || len(req.Options) > 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a poll needs between 2 and 6 options"}); return
	}

	seen := map[string]bool{}
	options := make([]models.PollOption, 0, len(req.Options))
	for _, raw := range req.Options {
		text := strings.TrimSpace(raw)
		if err := validation.Option(text); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
		key := strings.ToLower(text)
		if seen[key] { c.JSON(http.StatusBadRequest, gin.H{"error": "options must be unique"}); return }
		seen[key] = true
		options = append(options, models.PollOption{ID: primitive.NewObjectID().Hex(), Text: text})
	}

	now := time.Now()
	poll := &models.Poll{
		ID: primitive.NewObjectID(), OwnerID: middleware.UserID(c),
		Question: req.Question, Options: options, Status: "open",
		CreatedAt: now, UpdatedAt: now,
	}
	if err := h.Repo.Create(c, poll); err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create poll"}); return }
	if err := h.Redis.SetCounts(c, poll.ID.Hex(), map[string]int64{}); err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": "could not initialize live counter"}); return }
	c.JSON(http.StatusCreated, gin.H{"poll": poll})
}

func (h *Handler) Mine(c *gin.Context) {
	polls, err := h.Repo.Mine(c, middleware.UserID(c))
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load polls"}); return }
	c.JSON(http.StatusOK, gin.H{"polls": polls})
}

func (h *Handler) GetPoll(c *gin.Context) {
	poll, err := h.poll(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"}); return }
	counts, err := h.liveCounts(c, poll)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load live results"}); return }
	c.JSON(http.StatusOK, gin.H{"poll": poll, "counts": counts, "total": realtime.Total(counts)})
}

func (h *Handler) Vote(c *gin.Context) {
	poll, err := h.poll(c.Request.Context(), c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"}); return }
	if poll.Status != "open" { c.JSON(http.StatusConflict, gin.H{"error": "this poll is closed"}); return }

	var req voteRequest
	if !bind(c, &req) { return }
	if err := validation.VoterID(req.VoterID); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }

	validOption := false
	for _, option := range poll.Options {
		if option.ID == req.OptionID { validOption = true; break }
	}
	if !validOption { c.JSON(http.StatusBadRequest, gin.H{"error": "invalid option"}); return }

	vote := &models.Vote{
		ID: primitive.NewObjectID(), PollID: poll.ID, OptionID: req.OptionID,
		VoterID: req.VoterID, CreatedAt: time.Now(),
	}
	if err := h.Repo.AddVote(c, vote); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "you have already voted in this poll"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not record vote"}); return
	}

	// Redis is the live counter. HINCRBY is atomic, so concurrent votes are safe.
	if _, err := h.Redis.Increment(c, poll.ID.Hex(), req.OptionID); err != nil {
		// Durable vote exists; a later cache rebuild can repair Redis.
		c.JSON(http.StatusInternalServerError, gin.H{"error": "vote saved but live counter is temporarily unavailable"}); return
	}
	counts, err := h.Redis.Counts(c, poll.ID.Hex())
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read live counter"}); return }
	event := realtime.Event{Type: "update", PollID: poll.ID.Hex(), Counts: counts, Total: realtime.Total(counts)}
	if err := h.Redis.Publish(c, event); err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": "could not publish live update"}); return }

	c.JSON(http.StatusCreated, gin.H{"counts": counts, "total": event.Total})
}

func (h *Handler) ChangeStatus(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": "invalid poll id"}); return }
	var body struct { Status string `json:"status"` }
	if !bind(c, &body) { return }
	if body.Status != "open" && body.Status != "closed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status must be open or closed"}); return
	}
	if err := h.Repo.UpdateStatus(c, id, middleware.UserID(c), body.Status); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return
	}
	c.JSON(http.StatusOK, gin.H{"status": body.Status})
}

func (h *Handler) DeletePoll(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": "invalid poll id"}); return }
	if err := h.Repo.Delete(c, id, middleware.UserID(c)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return
	}
	c.JSON(http.StatusOK, gin.H{"message": "poll deleted"})
}

var upgrader = websocket.Upgrader{
	ReadBufferSize: 1024, WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool { return true },
}

func (h *Handler) WebSocket(c *gin.Context) {
	poll, err := h.poll(c.Request.Context(), c.Param("id"))
	if err != nil { c.Status(http.StatusNotFound); return }

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil { return }
	defer conn.Close()

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	counts, err := h.liveCounts(ctx, poll)
	if err == nil {
		_ = conn.WriteJSON(gin.H{"type": "snapshot", "counts": counts, "total": realtime.Total(counts)})
	}

	sub := h.Redis.Subscribe(ctx, poll.ID.Hex())
	defer sub.Close()

	go func() {
		for {
			var incoming struct {
				Type  string `json:"type"`
				Emoji string `json:"emoji"`
			}
			if err := conn.ReadJSON(&incoming); err != nil { cancel(); return }
			if incoming.Type == "reaction" && incoming.Emoji != "" {
				_ = h.Redis.Publish(ctx, realtime.Event{
					Type:   "reaction",
					PollID: poll.ID.Hex(),
					Emoji:  incoming.Emoji,
					ID:     primitive.NewObjectID().Hex(),
				})
			}
		}
	}()

	for {
		msg, err := sub.ReceiveMessage(ctx)
		if err != nil { return }
		var event realtime.Event
		if jsonErr := decodeJSON([]byte(msg.Payload), &event); jsonErr != nil { continue }
		if event.Type == "reaction" {
			if err := conn.WriteJSON(gin.H{"type": "reaction", "emoji": event.Emoji, "id": event.ID}); err != nil { return }
		} else {
			if err := conn.WriteJSON(gin.H{"type": "update", "counts": event.Counts, "total": event.Total}); err != nil { return }
		}
	}
}

func (h *Handler) poll(ctx context.Context, idStr string) (*models.Poll, error) {
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil { return nil, err }
	return h.Repo.Get(ctx, id)
}

func (h *Handler) liveCounts(c context.Context, poll *models.Poll) (map[string]int64, error) {
	counts, err := h.Redis.Counts(c, poll.ID.Hex())
	if err != nil { return nil, err }
	if len(counts) == 0 {
		counts, err = h.Repo.Counts(c, poll.ID)
		if err != nil { return nil, err }
		if err := h.Redis.SetCounts(c, poll.ID.Hex(), counts); err != nil { return nil, err }
	}
	return counts, nil
}

func bind(c *gin.Context, v interface{}) bool {
	if err := c.ShouldBindJSON(v); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON payload"})
		return false
	}
	return true
}

// Small wrapper keeps the websocket handler focused on transport logic.
func decodeJSON(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}

var _ = errors.New

package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/example/pulsevote/internal/config"
	"github.com/example/pulsevote/internal/database"
	"github.com/example/pulsevote/internal/handlers"
	"github.com/example/pulsevote/internal/middleware"
	"github.com/example/pulsevote/internal/realtime"
	"github.com/example/pulsevote/internal/repository"
	"github.com/example/pulsevote/internal/services"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	mongo, err := database.Connect(ctx, cfg.MongoURI, cfg.MongoDB)
	if err != nil { log.Fatal("mongo: ", err) }
	defer mongo.Client.Disconnect(context.Background())

	redis := realtime.New(cfg.RedisAddr, cfg.RedisPass)
	if err := redis.Client.Ping(context.Background()).Err(); err != nil { log.Fatal("redis: ", err) }

	auth := &services.AuthService{Users: mongo.DB.Collection("users"), Secret: cfg.JWTSecret}
	repo := &repository.PollRepo{Polls: mongo.DB.Collection("polls"), Votes: mongo.DB.Collection("votes")}
	h := &handlers.Handler{Auth: auth, Repo: repo, Redis: redis, Secret: cfg.JWTSecret}

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{cfg.FrontendURL},
		AllowMethods: []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},
	}))

	r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })

	api := r.Group("/api")
	api.POST("/auth/signup", h.Signup)
	api.POST("/auth/login", h.Login)
	api.GET("/polls/:id", h.GetPoll)
	api.POST("/polls/:id/vote", h.Vote)
	api.GET("/ws-placeholder", func(c *gin.Context) { c.Status(404) })

	protected := api.Group("")
	protected.Use(middleware.Auth(cfg.JWTSecret))
	protected.GET("/auth/me", h.Me)
	protected.POST("/polls", h.CreatePoll)
	protected.GET("/polls/mine", h.Mine)
	protected.PATCH("/polls/:id/status", h.ChangeStatus)
	protected.DELETE("/polls/:id", h.DeletePoll)

	r.GET("/ws/polls/:id", h.WebSocket)

	port := cfg.Port
	if os.Getenv("PORT") != "" { port = os.Getenv("PORT") }
	log.Printf("PulseVote API listening on :%s", port)
	if err := r.Run(":" + port); err != nil { log.Fatal(err) }
}

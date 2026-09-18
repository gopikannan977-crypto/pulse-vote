package config

import "os"

type Config struct {
	Port         string
	MongoURI     string
	MongoDB      string
	RedisAddr    string
	RedisPass    string
	JWTSecret    string
	FrontendURL  string
}

func Load() Config {
	return Config{
		Port:        get("PORT", "8080"),
		MongoURI:    get("MONGO_URI", "mongodb://localhost:27017"),
		MongoDB:     get("MONGO_DB", "pulsevote"),
		RedisAddr:   get("REDIS_ADDR", "localhost:6379"),
		RedisPass:   os.Getenv("REDIS_PASSWORD"),
		JWTSecret:   get("JWT_SECRET", "dev-only-secret"),
		FrontendURL: get("FRONTEND_URL", "http://localhost:5173"),
	}
}

func get(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

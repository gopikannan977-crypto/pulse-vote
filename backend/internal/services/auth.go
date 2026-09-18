package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/example/pulsevote/internal/models"
	"github.com/example/pulsevote/internal/validation"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	Users *mongo.Collection
	Secret string
}

type Claims struct {
	UserID string `json:"uid"`
	jwt.RegisteredClaims
}

func (s *AuthService) Signup(ctx context.Context, email, password string) (*models.User, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if err := validation.Email(email); err != nil {
		return nil, "", err
	}
	if err := validation.Password(password); err != nil {
		return nil, "", err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", err
	}
	user := &models.User{ID: primitive.NewObjectID(), Email: email, PasswordHash: string(hash), CreatedAt: time.Now()}
	_, err = s.Users.InsertOne(ctx, user)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return nil, "", errors.New("email is already registered")
		}
		return nil, "", err
	}
	token, err := s.token(user.ID)
	return user, token, err
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*models.User, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var user models.User
	if err := s.Users.FindOne(ctx, bson.M{"email": email}).Decode(&user); err != nil {
		return nil, "", errors.New("invalid email or password")
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return nil, "", errors.New("invalid email or password")
	}
	token, err := s.token(user.ID)
	return &user, token, err
}

func (s *AuthService) token(id primitive.ObjectID) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: id.Hex(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)),
			IssuedAt: jwt.NewNumericDate(now),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.Secret))
}

func ParseToken(raw, secret string) (primitive.ObjectID, error) {
	token, err := jwt.ParseWithClaims(raw, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return primitive.NilObjectID, errors.New("invalid token")
	}
	claims, ok := token.Claims.(*Claims)
	if !ok {
		return primitive.NilObjectID, errors.New("invalid claims")
	}
	return primitive.ObjectIDFromHex(claims.UserID)
}

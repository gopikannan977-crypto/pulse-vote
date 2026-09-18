package validation

import (
	"errors"
	"net/mail"
	"strings"
	"unicode/utf8"
)

func Email(email string) error {
	email = strings.TrimSpace(email)
	if len(email) > 254 {
		return errors.New("email is too long")
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return errors.New("enter a valid email")
	}
	return nil
}

func Password(password string) error {
	if len(password) < 8 || len(password) > 72 {
		return errors.New("password must be 8–72 characters")
	}
	return nil
}

func Question(question string) error {
	if utf8.RuneCountInString(strings.TrimSpace(question)) < 5 {
		return errors.New("question must be at least 5 characters")
	}
	if utf8.RuneCountInString(question) > 180 {
		return errors.New("question must be at most 180 characters")
	}
	return nil
}

func Option(text string) error {
	text = strings.TrimSpace(text)
	if utf8.RuneCountInString(text) < 1 {
		return errors.New("options cannot be empty")
	}
	if utf8.RuneCountInString(text) > 80 {
		return errors.New("each option must be at most 80 characters")
	}
	return nil
}

func VoterID(id string) error {
	if len(id) < 16 || len(id) > 100 {
		return errors.New("invalid voter id")
	}
	return nil
}

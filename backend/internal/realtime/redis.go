package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/redis/go-redis/v9"
)

type Event struct {
	Type   string           `json:"type,omitempty"`
	PollID string           `json:"pollId"`
	Counts map[string]int64 `json:"counts,omitempty"`
	Total  int64            `json:"total,omitempty"`
	Emoji  string           `json:"emoji,omitempty"`
	ID     string           `json:"id,omitempty"`
}

type RedisStore struct {
	Client *redis.Client
}

func New(addr, password string) *RedisStore {
	return &RedisStore{Client: redis.NewClient(&redis.Options{Addr: addr, Password: password})}
}

func countKey(pollID string) string { return "poll:" + pollID + ":counts" }
func channel(pollID string) string { return "poll:" + pollID + ":events" }

func (r *RedisStore) SetCounts(ctx context.Context, pollID string, counts map[string]int64) error {
	key := countKey(pollID)
	pipe := r.Client.TxPipeline()
	pipe.Del(ctx, key)
	if len(counts) > 0 {
		values := make(map[string]interface{}, len(counts))
		for optionID, count := range counts { values[optionID] = count }
		pipe.HSet(ctx, key, values)
	}
	_, err := pipe.Exec(ctx)
	return err
}

func (r *RedisStore) Counts(ctx context.Context, pollID string) (map[string]int64, error) {
	values, err := r.Client.HGetAll(ctx, countKey(pollID)).Result()
	if err != nil { return nil, err }
	out := map[string]int64{}
	for key, raw := range values {
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil { continue }
		out[key] = n
	}
	return out, nil
}

func (r *RedisStore) Increment(ctx context.Context, pollID, optionID string) (int64, error) {
	return r.Client.HIncrBy(ctx, countKey(pollID), optionID, 1).Result()
}

func (r *RedisStore) Publish(ctx context.Context, event Event) error {
	payload, err := json.Marshal(event)
	if err != nil { return err }
	return r.Client.Publish(ctx, channel(event.PollID), payload).Err()
}

func (r *RedisStore) Subscribe(ctx context.Context, pollID string) *redis.PubSub {
	return r.Client.Subscribe(ctx, channel(pollID))
}

func Total(counts map[string]int64) int64 {
	var total int64
	for _, count := range counts { total += count }
	return total
}

func CachePresent(counts map[string]int64) bool {
	return len(counts) > 0
}

func PollKey(pollID string) string { return fmt.Sprintf("poll:%s:counts", pollID) }

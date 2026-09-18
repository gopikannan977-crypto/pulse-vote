package repository

import (
	"context"
	"errors"
	"time"

	"github.com/example/pulsevote/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type PollRepo struct {
	Polls *mongo.Collection
	Votes *mongo.Collection
}

func (r *PollRepo) Create(ctx context.Context, poll *models.Poll) error {
	_, err := r.Polls.InsertOne(ctx, poll)
	return err
}

func (r *PollRepo) Get(ctx context.Context, id primitive.ObjectID) (*models.Poll, error) {
	var poll models.Poll
	err := r.Polls.FindOne(ctx, bson.M{"_id": id}).Decode(&poll)
	if err != nil {
		return nil, err
	}
	return &poll, nil
}

func (r *PollRepo) Mine(ctx context.Context, owner primitive.ObjectID) ([]models.Poll, error) {
	cur, err := r.Polls.Find(ctx, bson.M{"ownerId": owner}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}))
	if err != nil { return nil, err }
	defer cur.Close(ctx)
	var polls []models.Poll
	if err := cur.All(ctx, &polls); err != nil { return nil, err }
	return polls, nil
}

func (r *PollRepo) UpdateStatus(ctx context.Context, id, owner primitive.ObjectID, status string) error {
	var closed interface{}
	if status == "closed" {
		closed = time.Now()
	} else {
		closed = nil
	}
	res, err := r.Polls.UpdateOne(ctx,
		bson.M{"_id": id, "ownerId": owner},
		bson.M{"$set": bson.M{"status": status, "closedAt": closed, "updatedAt": time.Now()}},
	)
	if err != nil { return err }
	if res.MatchedCount == 0 { return errors.New("poll not found or not owned by you") }
	return nil
}

func (r *PollRepo) Delete(ctx context.Context, id, owner primitive.ObjectID) error {
	res, err := r.Polls.DeleteOne(ctx, bson.M{"_id": id, "ownerId": owner})
	if err != nil { return err }
	if res.DeletedCount == 0 { return errors.New("poll not found or not owned by you") }
	_, _ = r.Votes.DeleteMany(ctx, bson.M{"pollId": id})
	return nil
}

func (r *PollRepo) AddVote(ctx context.Context, vote *models.Vote) error {
	_, err := r.Votes.InsertOne(ctx, vote)
	return err
}

func (r *PollRepo) Counts(ctx context.Context, pollID primitive.ObjectID) (map[string]int64, error) {
	cur, err := r.Votes.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"pollId": pollID}}},
		{{Key: "$group", Value: bson.M{"_id": "$optionId", "count": bson.M{"$sum": 1}}}},
	})
	if err != nil { return nil, err }
	defer cur.Close(ctx)
	out := map[string]int64{}
	for cur.Next(ctx) {
		var row struct {
			ID string `bson:"_id"`
			Count int64 `bson:"count"`
		}
		if err := cur.Decode(&row); err != nil { return nil, err }
		out[row.ID] = row.Count
	}
	return out, cur.Err()
}

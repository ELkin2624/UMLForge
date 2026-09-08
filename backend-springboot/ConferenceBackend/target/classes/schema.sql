-- Database Schema for ConferenceBackend

CREATE TABLE IF NOT EXISTS conferences (
    id BIGSERIAL PRIMARY KEY,    name VARCHAR(255) NOT NULL,    city VARCHAR(255),    year INTEGER);

CREATE TABLE IF NOT EXISTS topic_tracks (
    id BIGSERIAL PRIMARY KEY,    topicName VARCHAR(255) NOT NULL,    difficultyLevel VARCHAR(255));

CREATE TABLE IF NOT EXISTS attendees (
    id BIGSERIAL PRIMARY KEY,    fullName VARCHAR(255) NOT NULL,    email VARCHAR(255) NOT NULL);

CREATE TABLE IF NOT EXISTS sessions (
    id BIGSERIAL PRIMARY KEY,    title VARCHAR(255) NOT NULL,    durationMinutes INTEGER,    conference_id BIGINT    ,
    FOREIGN KEY (conference_id) REFERENCES conferences(id));

CREATE TABLE IF NOT EXISTS keynote_speakers (
    id BIGSERIAL PRIMARY KEY,    biography VARCHAR(255),    organization VARCHAR(255)    ,
    FOREIGN KEY (id) REFERENCES attendees(id) ON DELETE CASCADE);

CREATE TABLE IF NOT EXISTS sessions_topic_tracks (
    session_id BIGINT NOT NULL,    topictrack_id BIGINT NOT NULL    ,
    PRIMARY KEY (session_id, topictrack_id),    FOREIGN KEY (session_id) REFERENCES sessions(id),    FOREIGN KEY (topictrack_id) REFERENCES topic_tracks(id));


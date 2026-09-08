package com.conference.app.repository;

import com.conference.app.entity.TopicTrack;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TopicTrackRepository extends JpaRepository<TopicTrack, Long> {
}
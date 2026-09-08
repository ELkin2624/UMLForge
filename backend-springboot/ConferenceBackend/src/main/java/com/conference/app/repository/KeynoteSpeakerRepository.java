package com.conference.app.repository;

import com.conference.app.entity.KeynoteSpeaker;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface KeynoteSpeakerRepository extends JpaRepository<KeynoteSpeaker, Long> {
}
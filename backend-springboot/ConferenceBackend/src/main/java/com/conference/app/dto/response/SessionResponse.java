package com.conference.app.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.List;
import java.util.ArrayList;

public class SessionResponse {

    private Long id;
    
    private String title;
    private Integer durationMinutes;

    private Long conferenceId;
    private List<Long> topicTrackIds = new ArrayList<>();

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(Integer durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public Long getConferenceId() {
        return conferenceId;
    }

    public void setConferenceId(Long conferenceId) {
        this.conferenceId = conferenceId;
    }
    public List<Long> getTopicTrackIds() {
        return topicTrackIds;
    }

    public void setTopicTrackIds(List<Long> topicTrackIds) {
        this.topicTrackIds = topicTrackIds;
    }
}
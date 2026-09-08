package com.conference.app.dto.request;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.List;
import java.util.ArrayList;

public class SessionRequest {

    @NotNull
    private String title;
    private Integer durationMinutes;

    private Long conferenceId;
    private List<Long> topicTrackIds = new ArrayList<>();

    // Getters and Setters
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
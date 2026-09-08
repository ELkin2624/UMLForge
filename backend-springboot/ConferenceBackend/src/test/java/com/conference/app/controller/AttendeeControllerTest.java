package com.conference.app.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
public class AttendeeControllerTest {

    @Autowired
    private AttendeeController controller;

    @Test
    void contextLoads() {
        assertNotNull(controller, "The controller should have been autowired");
    }
}
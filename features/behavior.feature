Feature: GlowQuest kid-friendly interactions
  Simulated Bluetooth tests validate packet construction without transmitting radio signals.

  Scenario: Blue color prepares a BLE packet
    Given GlowQuest is open on a simulated Android phone
    When I select the "Blue" color
    Then the band preview says "Blue"
    And the packet contains "E100E90500090E02B0"
    When I press Send Magic
    Then the mock radio gets "E100E90500090E02B0" for company 387

  Scenario: Five-light paint builds a packet
    Given GlowQuest is open on a simulated Android phone
    When I open the "Mix" adventure
    And I choose the five-light mixer
    And I tap the rainbow-five button
    Then the band preview says "Five-light masterpiece"
    And the packet contains five color bytes

  Scenario: Show filtering works
    Given GlowQuest is open on a simulated Android phone
    When I open the "Shows" adventure
    And I filter to fades
    And I select the "Cyan → Pink" show
    Then the band preview says "Cyan → Pink"

  Scenario: Quiz teaches BLE
    Given GlowQuest is open on a simulated Android phone
    When I open the "Learn" adventure
    And I answer Bluetooth radio
    Then I see the quiz success message

  Scenario: Color detective earns a star
    Given GlowQuest is open on a simulated Android phone
    When I open the "Quest" adventure
    And I solve the color challenge
    Then my star score is 1

  Scenario: Invalid hex cannot transmit
    Given GlowQuest is open on a simulated Android phone
    When I open the "Learn" adventure
    And I unlock the grown-up lab
    And I enter "ABC" as hex
    And I press Send test packet
    Then I see a hex validation warning
    And the mock radio has sent nothing

  Scenario: Stop signal stops advertising
    Given GlowQuest is open on a simulated Android phone
    When I press Stop signal
    Then the native stop command is requested

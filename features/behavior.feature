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


  Scenario: Effect Studio builds masked color, vibration and fade packets
    Given GlowQuest is open on a simulated Android phone
    When I open the "Shows" adventure
    And I open the Effect Studio
    And I configure a red top-right double-tap effect with a two-second fade
    Then the packet contains "E100E90500250E35B2"
    And the effect packet never enables persistent lighting
    When I press Send Magic
    Then the mock radio gets "E100E90500250E35B2" for company 387

  Scenario: Retired feedback controls are removed without disrupting effects
    Given GlowQuest is open on a simulated Android phone
    Then the effect feedback and history controls are absent
    When I press Send Magic
    Then the mock radio gets "E100E90500090E02B0" for company 387

  Scenario: Studio offers a center-safe LED spotlight and gentle vibration mode
    Given GlowQuest is open on a simulated Android phone
    When I open the "Shows" adventure
    And I open the Effect Studio
    And I turn vibration off
    Then the FX Studio has no center-only spotlight option
    And the effect packet never enables persistent lighting


  Scenario: Extended timing sends an approximately 45 second command in a short radio burst
    Given GlowQuest is open on a simulated Android phone
    When I open the "Shows" adventure
    And I open the Effect Studio
    And I choose the 45-second effect mode
    Then the displayed duration is approximately 45 seconds
    And the packet contains "E100E905005D0E02B0"
    And the effect packet never enables persistent lighting
    When I press Send Magic
    Then the mock radio gets "E100E905005D0E02B0" for company 387

  Scenario: Scout discovers two unpaired candidate watches without transmitting
    Given GlowQuest is open on a simulated Android phone
    When I open the "Scout" adventure
    And I scan for unpaired watches
    Then two candidate watches appear without pairing

  Scenario: Known serial parity previews independent colors without pretending to control watches
    Given GlowQuest is open on a simulated Android phone
    When I open the "Scout" adventure
    And I scan for unpaired watches
    And I enter serials with even and odd final digits
    Then the first watch previews blue and the second previews red


  Scenario: Fireworks Show Creator displays a fully editable sixty-second timeline
    Given GlowQuest is open on a simulated Android phone
    When I open the "Shows" adventure
    And I open the Fireworks Show Creator
    Then I see twelve timed firework cues
    And the show explains that it does not target individual watches

  Scenario: Fireworks launches timed dramatic light and vibration cues
    Given GlowQuest is open on a simulated Android phone
    When I open the "Shows" adventure
    And I open the Fireworks Show Creator
    And I launch the 60-second fireworks show
    Then the mock native sequencer gets a 12-cue dramatic show with multiple vibrations

  Scenario: Fireworks cancellation removes the pending show
    Given GlowQuest is open on a simulated Android phone
    When I open the "Shows" adventure
    And I open the Fireworks Show Creator
    And I launch the 60-second fireworks show
    And I cancel the running show
    Then the native cancellation is requested and the show becomes idle

  Scenario: Edited firework timelines can be saved and restored locally
    Given GlowQuest is open on a simulated Android phone
    When I open the "Shows" adventure
    And I open the Fireworks Show Creator
    And I edit the second cue to be a blue double vibration
    And I save then restore my firework timeline
    Then the second cue is restored as blue with double vibration

  Scenario: Walk-by color demonstration uses the known colors and no individual targeting
    Given GlowQuest is open on a simulated Android phone
    When I open the "Shows" adventure
    And I open the Fireworks Show Creator
    And I launch the walk-by demonstration
    Then the native sequencer receives the yellow orange white sweep
    And the show explains that it does not target individual watches


  Scenario: Scan diagnostics also expose anonymous BLE devices and traffic counts
    Given GlowQuest is open on a simulated Android phone
    When I open the "Scout" adventure
    And I enable all BLE diagnostics
    And I scan for unpaired watches
    Then the scanner shows received packets and a generic BLE device

  Scenario: Clearing scan data also clears native state
    Given GlowQuest is open on a simulated Android phone
    When I open the "Scout" adventure
    And I scan for unpaired watches
    And I clear the scan results
    Then the scan counts and device list are cleared

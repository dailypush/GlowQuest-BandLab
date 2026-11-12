Feature: GlowQuest app screenshots
  Parents can inspect screenshots of the actual bundled WebView UI.

  @screenshots
  Scenario Outline: Preview the <screen> adventure on a phone
    Given GlowQuest is open on a simulated Android phone
    When I open the "<screen>" adventure
    Then I save a "<file>" screenshot
    And the screen fits without horizontal scrolling

    Examples:
      | screen | file   |
      | Colors | colors |
      | Mix    | mix    |
      | Shows  | shows  |
      | Quest  | quest  |
      | Learn  | learn  |

  @screenshots
  Scenario: Preview colors on a tablet
    Given GlowQuest is open on a simulated Android phone
    When I switch to tablet size
    Then I save a "tablet-colors" screenshot
    And the screen fits without horizontal scrolling


  @readme
  Scenario: Capture the color palette for the README gallery
    Given GlowQuest is open on a simulated Android phone
    Then I capture the "colors" README interface preview

  @readme
  Scenario: Capture the light mixer for the README gallery
    Given GlowQuest is open on a simulated Android phone
    When I open the "Mix" adventure
    Then I capture the "mix" README interface preview

  @readme
  Scenario: Capture Effect Studio for the README gallery
    Given GlowQuest is open on a simulated Android phone
    When I open the "Shows" adventure
    And I open the Effect Studio
    Then I capture the "effect-studio" README interface preview

  @readme
  Scenario: Capture Fireworks Show Creator for the README gallery
    Given GlowQuest is open on a simulated Android phone
    When I open the "Shows" adventure
    And I open the Fireworks Show Creator
    Then I capture the "fireworks" README interface preview

  @readme
  Scenario: Capture Range Lab for the README gallery
    Given GlowQuest is open on a simulated Android phone
    When I open the "Shows" adventure
    And I open the Fireworks Show Creator
    Then I capture the "range-lab" README interface preview

  @readme
  Scenario: Capture Band Scout for the README gallery
    Given GlowQuest is open on a simulated Android phone
    When I open the "Scout" adventure
    Then I capture the "scout" README interface preview


  @readme
  Scenario: Capture Show Capture and Replay Lab for the README gallery
    Given GlowQuest is open on a simulated Android phone
    When I open the "Scout" adventure
    And I open Show Capture
    Then I capture the "show-capture" README interface preview

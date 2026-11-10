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

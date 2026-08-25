Feature: Hexgrid item compatibility and feature flags

  The photo compatibility layer keeps Photo-era code working on GridItem,
  and the feature-flag presets define what each runtime profile runs.
  Steps call the real compat and features modules directly.

  Scenario: A photo survives the GridItem round-trip unchanged
    Given a photo titled "Dune Meridian" in category "landform"
    When the photo is converted to a grid item and back
    Then the recovered photo is the original photo

  Scenario: The grid item mirrors the photo's identity
    Given a photo titled "Dune Meridian" in category "landform"
    When the photo is converted to a grid item
    Then the item id is the photo id
    And the item image is the photo image
    And the item type is "photo"

  Scenario: A bare item with an image constructs a fallback photo
    When a bare grid item with an image is converted back
    Then the fallback photo keeps the item id
    And the fallback photo lands in the uncategorized category

  Scenario: An item with neither data nor image converts to nothing
    When a bare grid item without an image is converted back
    Then the conversion yields no photo

  Scenario: Default flags enable every feature
    Then the default preset enables every feature

  Scenario: The minimal preset keeps only core visualization
    Then the minimal preset enables "enableWorker"
    And the minimal preset enables "enableTextures"
    And the minimal preset enables "enableInteractions"
    And the minimal preset disables "enableNarration"
    And the minimal preset disables "enableLeaderboard"
    And the minimal preset disables "enableTelemetry"

  Scenario: The performance preset trades gloss for motion
    Then the performance preset enables "enableStats"
    And the performance preset enables "enableCameraControls"
    And the performance preset enables "enableEvolution"
    And the performance preset disables "enableVisualEffects"
    And the performance preset disables "enableAutoplay"

  Scenario: User flags override defaults without touching the rest
    Then merging flags that disable "enableTelemetry" keeps "enableStats" enabled
    And merging flags that disable "enableTelemetry" disables "enableTelemetry"

  Scenario: An absent flag reads as enabled
    Then a flag object without "enableWorker" reports "enableWorker" enabled
    And a flag object where "enableWorker" is false reports "enableWorker" disabled

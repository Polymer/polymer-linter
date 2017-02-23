# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

### New Lint Rules
- `unknown-set-attribute` - included in all polymer rule collections.
  - Warns setting undeclared properties or attributes in Polymer templates.

    This rule will warn when setting an attribute or property on a custom
    element.

    This catches misspellings, forgetting to convert camelCase to kebab-case,
    and binding to attributes like class and style like they were properties.Warns when setting an unknown attribute or property on a custom element in a polymer databinding template. Catches misspellings


## [0.1.3] - 2017-02-22

- bump version of the analyzer.

## [0.1.2] - 2017-02-14

### Added

- allRules and allRuleCollections on the registry, for accessing all registered rules and collections.

## [0.1.1] - 2017-02-10

- The start of our rewrite of https://github.com/PolymerLabs/polylint on top of our new incremental static analysis framework.

### Added

- APIs for both linting by files and by package.
- Rule collections. Semantic, intent-based collections of lint rules.
- A queryable, extensible registry of rules and rule collections.

### New Lint Rules
- Rule that warns about `<style>` tags as direct children of `<dom-module>` tags (rather than being in `<template>` tags).
- Rule that warns about `is` and `name` attributes on `<dom-module>` tags.

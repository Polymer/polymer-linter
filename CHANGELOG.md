# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

### New Lint Rules
- unbalanced-polymer-delimiters: finds unbalanced delimiters in polymer databinding expressions.
- `unknown-set-attribute` - included in all polymer rule collections.
  - Warns when setting undeclared properties or attributes in HTML.

    This rule will check use of attributes in HTML on custom elements, as well
    as databinding into attributes and properties in polymer databinding
    contexts.

    This catches misspellings, forgetting to convert camelCase to kebab-case,
    and binding to attributes like class and style like they were properties.

    Currently only checks custom elements, as we don't yet have the necessary
    metadata on native elements in a convenient format.


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

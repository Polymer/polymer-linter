# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

## [1.0.0-pre.1] - 2017-02-10

### Added
- APIs for both linting by files and by package.
- Rule collections. Semantic, intent-based collections of lint rules.
- A queryable, extensible registry of rules and rule collections.

### New Lint Rules
- Rule that warns about `<style>` tags as direct children of `<dom-module>` tags (rather than being in `<template>` tags).
- Rule that warns about `is` and `name` attributes on `<dom-module>` tags.
